"""
Qjob executor scraper.

Run locally:
  python3 -m pip install selenium
  python3 scripts/scrape_qjob_executors.py --output qjob_executors.json

The script opens Chrome visibly so you can sign in manually. After you finish
signing in, return to the terminal and press Enter.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib.parse import urljoin, urlparse

from selenium import webdriver
from selenium.common.exceptions import (
    ElementClickInterceptedException,
    ElementNotInteractableException,
    JavascriptException,
    NoSuchElementException,
    StaleElementReferenceException,
    TimeoutException,
)
from selenium.webdriver import ChromeOptions
from selenium.webdriver.common.action_chains import ActionChains
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.remote.webdriver import WebDriver
from selenium.webdriver.remote.webelement import WebElement
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import WebDriverWait


BASE_URL = "https://qjob.hu"
EXECUTORS_URL = f"{BASE_URL}/executors"
CARD_SELECTOR = "qj-executor-card-v2"
DEFAULT_TAXONOMY_MAP = Path(__file__).with_name("qjob_category_map.json")
PHONE_RE = re.compile(
    r"(?:\+?36|06)[\s\-/.()]*(?:\d[\s\-/.()]*){8,10}\d|"
    r"\+\d{1,3}[\s\-/.()]*(?:\d[\s\-/.()]*){6,14}\d"
)
MASKED_PHONE_RE = re.compile(
    r"(?:\+?36|06)?[\s\-/.()]*(?:\d|[*xX•●])(?:[\s\-/.()]*(?:\d|[*xX•●])){6,}"
)
PHONE_TRIGGER_RE = re.compile(
    r"telefon|phone|szám|number|hív|call|mutat|show|elérhetőség|contact", re.I
)
CHALLENGE_RE = re.compile(
    r"captcha|too many requests|rate limit|cloudflare|access denied|"
    r"checking your browser|verify you are human|unusual traffic|"
    r"ellenőrizze, hogy nem robot|nem vagyok robot|túl sok kérés|tul sok keres",
    re.I,
)

def normalize_text(value: str | None) -> str:
    if not value:
        return ""
    return re.sub(r"\s+", " ", value).strip()


def dedupe_keep_order(values: list[str]) -> list[str]:
    seen: set[str] = set()
    result: list[str] = []
    for value in values:
        cleaned = normalize_text(value)
        if cleaned and cleaned not in seen:
            seen.add(cleaned)
            result.append(cleaned)
    return result


def absolute_url(value: str | None) -> str | None:
    if not value:
        return None
    return urljoin(BASE_URL, value)


def user_id_from_url(url: str | None) -> str | None:
    if not url:
        return None
    match = re.search(r"/user/(\d+)", urlparse(url).path)
    return match.group(1) if match else None


def load_taxonomy_mapping(path: Path) -> dict[str, Any]:
    if not path.exists():
        print(f"Taxonomy map not found at {path}; writing raw Qjob categories only.", file=sys.stderr)
        return {}
    return json.loads(path.read_text(encoding="utf-8"))


def add_mapping_values(target: dict[str, list[str]], mapping: dict[str, Any]) -> None:
    target["categories"].extend(mapping.get("categories") or [])
    target["services"].extend(mapping.get("services") or [])


def coerce_taxonomy_for_row(row: dict[str, Any], taxonomy_mapping: dict[str, Any]) -> dict[str, Any]:
    if not taxonomy_mapping:
        return row

    qjob_categories = row.get("categories") or []
    direct_mappings = taxonomy_mapping.get("qjob_categories") or {}
    matched = {"categories": [], "services": []}
    unmapped_qjob_categories = []

    for category in qjob_categories:
        mapping = direct_mappings.get(category)
        if mapping:
            add_mapping_values(matched, mapping)
        else:
            unmapped_qjob_categories.append(category)

    searchable_text = normalize_text(
        " ".join(
            [
                row.get("name") or "",
                row.get("description") or "",
                " ".join(qjob_categories),
            ]
        )
    ).lower()

    for rule in taxonomy_mapping.get("keyword_rules") or []:
        keywords = [keyword.lower() for keyword in rule.get("contains") or []]
        if any(keyword in searchable_text for keyword in keywords):
            add_mapping_values(matched, rule)

    row["qjob_categories"] = qjob_categories
    row["mestermind_categories"] = dedupe_keep_order(matched["categories"])
    row["mestermind_services"] = dedupe_keep_order(matched["services"])
    row["unmapped_qjob_categories"] = dedupe_keep_order(unmapped_qjob_categories)
    return row


def apply_taxonomy_mapping(
    rows: list[dict[str, Any]],
    taxonomy_mapping: dict[str, Any],
) -> list[dict[str, Any]]:
    return [coerce_taxonomy_for_row(row, taxonomy_mapping) for row in rows]


def wait_for_cards(driver: WebDriver, timeout: int) -> None:
    WebDriverWait(driver, timeout).until(
        EC.presence_of_all_elements_located((By.CSS_SELECTOR, CARD_SELECTOR))
    )


def is_challenge_page(driver: WebDriver) -> bool:
    text = visible_text(driver)
    title = normalize_text(driver.title)
    return bool(CHALLENGE_RE.search(f"{title} {text}"))


def wait_or_stop_on_challenge(driver: WebDriver, timeout: int) -> None:
    WebDriverWait(driver, timeout).until(EC.presence_of_element_located((By.TAG_NAME, "body")))
    if is_challenge_page(driver):
        raise RuntimeError("Challenge or block page detected; stopping for manual review.")


def wait_for_manual_listing_load(driver: WebDriver) -> int:
    current_count = len(driver.find_elements(By.CSS_SELECTOR, CARD_SELECTOR))
    print(
        f"Currently seeing {current_count} executor cards. "
        "Click 'Több mutatása' in Chrome until you are done, then press Enter here...",
        file=sys.stderr,
    )
    input()
    final_count = len(driver.find_elements(By.CSS_SELECTOR, CARD_SELECTOR))
    print(f"Confirmed {final_count} loaded executor cards. Starting scrape.", file=sys.stderr)
    driver.execute_script("window.scrollTo(0, 0);")
    return final_count


def extract_card_data(driver: WebDriver, card: WebElement, index: int) -> dict[str, Any]:
    data = driver.execute_script(
        """
        const card = arguments[0];
        const text = (selector) => {
          const node = card.querySelector(selector);
          return node ? node.innerText.trim().replace(/\\s+/g, " ") : "";
        };
        const texts = (selector) => Array.from(card.querySelectorAll(selector))
          .map((node) => node.innerText.trim().replace(/\\s+/g, " "))
          .filter(Boolean);
        const hrefFrom = (selector) => {
          const node = card.querySelector(selector);
          return node ? node.getAttribute("href") : null;
        };
        const profileHref = hrefFrom("a.name[href]") ||
          hrefFrom("qj-contractor-avatar-v2[href]") ||
          hrefFrom("ui-button[href]");
        const image = card.querySelector("img[src]");
        return {
          name: text("a.name"),
          profile_url: profileHref,
          photo_url: image ? image.getAttribute("src") : null,
          pro_subscription: !!card.querySelector(".pro-badge"),
          rating: text(".rating-value"),
          review_count: text(".review-count"),
          address: text(".executor-top-right.hide-for-mobile .executor-address") ||
            text(".executor-top-right .executor-address"),
          categories_text: text(".executor-cats"),
          facts: texts("ul.executor-desc li"),
          description: text(".executor-description"),
          card_text: card.innerText.trim().replace(/\\s+/g, " "),
        };
        """,
        card,
    )

    profile_url = absolute_url(data.get("profile_url"))
    categories = [
        part.strip()
        for part in re.split(r"\s*[•·]\s*", data.get("categories_text") or "")
        if part.strip()
    ]

    return {
        "list_index": index,
        "user_id": user_id_from_url(profile_url),
        "name": normalize_text(data.get("name")),
        "profile_url": profile_url,
        "photo_url": absolute_url(data.get("photo_url")),
        "pro_subscription": bool(data.get("pro_subscription")),
        "rating": normalize_text(data.get("rating")),
        "review_count": normalize_text(data.get("review_count")).strip("()"),
        "address": normalize_text(data.get("address")),
        "categories": dedupe_keep_order(categories),
        "facts": dedupe_keep_order(data.get("facts") or []),
        "description": normalize_text(data.get("description")),
        "phone": None,
        "masked_phone": None,
        "phone_source": None,
        "scrape_error": None,
    }


def write_json(
    path: Path,
    rows: list[dict[str, Any]],
    taxonomy_mapping: dict[str, Any] | None = None,
) -> None:
    rows = dedupe_rows(rows)
    if taxonomy_mapping:
        rows = apply_taxonomy_mapping(rows, taxonomy_mapping)
    payload = {
        "source": EXECUTORS_URL,
        "scraped_at": datetime.now(timezone.utc).isoformat(),
        "count": len(rows),
        "executors": rows,
    }
    tmp_path = path.with_suffix(f"{path.suffix}.tmp")
    tmp_path.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")
    os.replace(tmp_path, path)


def load_existing_rows(path: Path) -> list[dict[str, Any]]:
    if not path.exists():
        return []
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return []
    rows = payload.get("executors", [])
    return dedupe_rows(rows) if isinstance(rows, list) else []


def row_identity(row: dict[str, Any]) -> str | None:
    """Stable key used to prevent duplicate executor records."""
    user_id = row.get("user_id")
    profile_url = row.get("profile_url")
    if user_id:
        return f"user_id:{user_id}"
    if profile_url:
        return f"profile_url:{profile_url}"

    name = normalize_text(row.get("name"))
    address = normalize_text(row.get("address"))
    if name and address:
        return f"name_address:{name.lower()}|{address.lower()}"
    return None


def merge_rows(existing: dict[str, Any], incoming: dict[str, Any]) -> dict[str, Any]:
    """Keep useful data from both rows when a duplicate is found."""
    merged = dict(existing)
    for key, value in incoming.items():
        if value not in (None, "", [], {}):
            merged[key] = value
    return merged


def dedupe_rows(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    unique_rows: list[dict[str, Any]] = []
    identity_to_index: dict[str, int] = {}

    for row in rows:
        key = row_identity(row)
        if not key:
            unique_rows.append(row)
            continue

        existing_index = identity_to_index.get(key)
        if existing_index is None:
            identity_to_index[key] = len(unique_rows)
            unique_rows.append(row)
        else:
            unique_rows[existing_index] = merge_rows(unique_rows[existing_index], row)

    return unique_rows


def processed_keys(rows: list[dict[str, Any]]) -> set[str]:
    return {key for row in rows if (key := row_identity(row))}


def visible_text(driver: WebDriver) -> str:
    try:
        return normalize_text(driver.find_element(By.TAG_NAME, "body").text)
    except NoSuchElementException:
        return ""


def extract_phone_candidates(text: str) -> list[str]:
    return dedupe_keep_order(match.group(0) for match in PHONE_RE.finditer(text))


def extract_masked_phone_candidates(text: str) -> list[str]:
    return [
        value
        for value in dedupe_keep_order(match.group(0) for match in MASKED_PHONE_RE.finditer(text))
        if any(char in value for char in "*xX•●")
    ]


def click_element(driver: WebDriver, element: WebElement) -> bool:
    try:
        driver.execute_script("arguments[0].scrollIntoView({block: 'center'});", element)
        time.sleep(0.2)
        ActionChains(driver).move_to_element(element).pause(0.2).click().perform()
        return True
    except (ElementClickInterceptedException, ElementNotInteractableException, JavascriptException, StaleElementReferenceException):
        pass

    try:
        element.click()
        return True
    except (ElementClickInterceptedException, ElementNotInteractableException, StaleElementReferenceException):
        try:
            driver.execute_script("arguments[0].click();", element)
            return True
        except (JavascriptException, StaleElementReferenceException):
            return False


def collect_tel_links(driver: WebDriver) -> list[str]:
    links = []
    for link in driver.find_elements(By.CSS_SELECTOR, "a[href^='tel:']"):
        href = link.get_attribute("href") or ""
        text = link.text or ""
        value = href.replace("tel:", "").strip() or text
        if value:
            links.append(value)
    return dedupe_keep_order(links)


def possible_phone_triggers(driver: WebDriver) -> list[WebElement]:
    selectors = [
        "button",
        "a",
        "[role='button']",
        "ui-button button",
        ".phone",
        ".contacts",
        ".contact",
    ]
    candidates: list[WebElement] = []
    seen_ids: set[str] = set()

    for selector in selectors:
        for element in driver.find_elements(By.CSS_SELECTOR, selector):
            try:
                if not element.is_displayed():
                    continue
                key = element.id
                if key in seen_ids:
                    continue
                text = normalize_text(
                    " ".join(
                        [
                            element.text,
                            element.get_attribute("aria-label") or "",
                            element.get_attribute("title") or "",
                            element.get_attribute("href") or "",
                            element.get_attribute("class") or "",
                        ]
                    )
                )
                if PHONE_TRIGGER_RE.search(text) or MASKED_PHONE_RE.search(text):
                    candidates.append(element)
                    seen_ids.add(key)
            except StaleElementReferenceException:
                continue

    return candidates


def close_modal_if_open(driver: WebDriver) -> None:
    close_selectors = [
        "button[aria-label*='close' i]",
        "button[title*='close' i]",
        "button[aria-label*='bezár' i]",
        "button[title*='bezár' i]",
        ".close",
        ".modal-close",
    ]
    for selector in close_selectors:
        for element in driver.find_elements(By.CSS_SELECTOR, selector):
            if element.is_displayed() and click_element(driver, element):
                time.sleep(0.2)
                return

    try:
        ActionChains(driver).send_keys(Keys.ESCAPE).perform()
    except Exception:
        pass


def find_phone_on_profile(driver: WebDriver, timeout: int) -> dict[str, str | None]:
    wait_or_stop_on_challenge(driver, timeout)

    tel_links = collect_tel_links(driver)
    if tel_links:
        return {"phone": tel_links[0], "masked_phone": None, "phone_source": "tel_link"}

    page_text = visible_text(driver)
    phones = extract_phone_candidates(page_text)
    masked = extract_masked_phone_candidates(page_text)

    # Some Qjob profiles expose a masked phone first; clicking it or its nearby
    # button opens a modal with the revealed phone after login.
    for trigger in possible_phone_triggers(driver):
        before = visible_text(driver)
        if not click_element(driver, trigger):
            continue
        time.sleep(1.0)

        tel_links = collect_tel_links(driver)
        after = visible_text(driver)
        new_text = after if after != before else visible_text(driver)
        new_phones = extract_phone_candidates(new_text)
        new_masked = extract_masked_phone_candidates(new_text)

        if tel_links or new_phones:
            return {
                "phone": (tel_links or new_phones)[0],
                "masked_phone": (new_masked or masked or [None])[0],
                "phone_source": "phone_modal_or_reveal",
            }

        if new_masked and not masked:
            masked = new_masked

        close_modal_if_open(driver)

    return {
        "phone": phones[0] if phones else None,
        "masked_phone": masked[0] if masked else None,
        "phone_source": "profile_text" if phones else ("masked_only" if masked else None),
    }


def scrape_profile(driver: WebDriver, profile_url: str, timeout: int) -> dict[str, str | None]:
    original_handle = driver.current_window_handle
    driver.execute_script("window.open(arguments[0], '_blank');", profile_url)
    driver.switch_to.window(driver.window_handles[-1])

    try:
        wait_or_stop_on_challenge(driver, timeout)
        return find_phone_on_profile(driver, timeout)
    finally:
        driver.close()
        driver.switch_to.window(original_handle)


def build_driver(headless: bool) -> WebDriver:
    options = ChromeOptions()
    options.add_argument("--start-maximized")
    if headless:
        options.add_argument("--headless=new")
    return webdriver.Chrome(options=options)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Scrape qjob.hu executor cards to JSON.")
    parser.add_argument("--url", default=EXECUTORS_URL, help="Executors listing URL to scrape.")
    parser.add_argument("--output", default="qjob_executors.json", help="JSON output path.")
    parser.add_argument("--max-cards", type=int, default=0, help="Limit cards processed; 0 means all loaded cards.")
    parser.add_argument("--timeout", type=int, default=25, help="Selenium wait timeout in seconds.")
    parser.add_argument("--profile-delay", type=float, default=5.0, help="Seconds to pause between profile visits.")
    parser.add_argument(
        "--taxonomy-map",
        default=str(DEFAULT_TAXONOMY_MAP),
        help="JSON map used to coerce Qjob categories to Mestermind categories/services.",
    )
    parser.add_argument(
        "--normalize-existing",
        action="store_true",
        help="Apply the taxonomy map to the existing output JSON and exit without opening Chrome.",
    )
    parser.add_argument(
        "--max-consecutive-errors",
        type=int,
        default=3,
        help="Stop after this many profile errors in a row; 0 disables this stop.",
    )
    parser.add_argument("--fresh", action="store_true", help="Ignore any existing output file instead of resuming.")
    parser.add_argument("--skip-login-prompt", action="store_true", help="Do not pause for manual login.")
    parser.add_argument("--headless", action="store_true", help="Run Chrome headless; not useful for manual login.")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    output_path = Path(args.output)
    taxonomy_mapping = load_taxonomy_mapping(Path(args.taxonomy_map))
    rows: list[dict[str, Any]] = [] if args.fresh else load_existing_rows(output_path)
    rows = apply_taxonomy_mapping(rows, taxonomy_mapping)
    already_processed = processed_keys(rows)
    consecutive_errors = 0

    if args.normalize_existing:
        write_json(output_path, rows, taxonomy_mapping)
        print(f"Normalized {len(rows)} existing executors in {output_path}", file=sys.stderr)
        return 0

    driver = build_driver(args.headless)
    try:
        driver.get(args.url)
        wait_for_cards(driver, args.timeout)
        if is_challenge_page(driver):
            raise RuntimeError("Challenge or block page detected on the listing page; stopping for manual review.")

        if not args.skip_login_prompt and not args.headless:
            print(
                "Chrome is open. Sign in to Qjob if needed, return here, then press Enter...",
                file=sys.stderr,
            )
            input()
            driver.get(args.url)
            wait_for_cards(driver, args.timeout)
            if is_challenge_page(driver):
                raise RuntimeError("Challenge or block page detected after login; stopping for manual review.")

        total_cards = wait_for_manual_listing_load(driver)
        limit = args.max_cards or total_cards
        print(f"Found {total_cards} loaded executor cards; processing {min(limit, total_cards)}.", file=sys.stderr)
        if rows:
            print(f"Resuming with {len(rows)} existing rows from {output_path}.", file=sys.stderr)

        for index in range(min(limit, total_cards)):
            cards = driver.find_elements(By.CSS_SELECTOR, CARD_SELECTOR)
            if index >= len(cards):
                break

            card = cards[index]
            driver.execute_script("arguments[0].scrollIntoView({block: 'center'});", card)
            time.sleep(0.2)
            record = extract_card_data(driver, card, index + 1)
            record = coerce_taxonomy_for_row(record, taxonomy_mapping)
            print(f"[{index + 1}/{min(limit, total_cards)}] {record.get('name') or record.get('profile_url')}", file=sys.stderr)

            record_key = row_identity(record)
            if record_key and record_key in already_processed:
                print("  already in output; skipping", file=sys.stderr)
                continue

            profile_url = record.get("profile_url")
            if profile_url:
                try:
                    record.update(scrape_profile(driver, profile_url, args.timeout))
                    consecutive_errors = 0
                except TimeoutException as exc:
                    record["scrape_error"] = f"Timed out opening profile: {exc}"
                    consecutive_errors += 1
                except RuntimeError as exc:
                    record["scrape_error"] = str(exc)
                    rows.append(record)
                    write_json(output_path, rows, taxonomy_mapping)
                    raise
                except Exception as exc:  # Keep long scrapes from dying on one profile.
                    record["scrape_error"] = f"{type(exc).__name__}: {exc}"
                    consecutive_errors += 1
            else:
                record["scrape_error"] = "No profile URL found on card"
                consecutive_errors += 1

            rows.append(record)
            if record_key:
                already_processed.add(record_key)
            write_json(output_path, rows, taxonomy_mapping)

            if args.max_consecutive_errors and consecutive_errors >= args.max_consecutive_errors:
                raise RuntimeError(
                    f"Stopping after {consecutive_errors} consecutive profile errors. "
                    "Review the browser/output before continuing."
                )

            if args.profile_delay > 0 and index < min(limit, total_cards) - 1:
                time.sleep(args.profile_delay)

        print(f"Done. Wrote {len(rows)} executors to {output_path}", file=sys.stderr)
        return 0
    except KeyboardInterrupt:
        write_json(output_path, rows, taxonomy_mapping)
        print(f"Stopped manually. Saved {len(rows)} executors to {output_path}", file=sys.stderr)
        return 130
    finally:
        driver.quit()


if __name__ == "__main__":
    raise SystemExit(main())
