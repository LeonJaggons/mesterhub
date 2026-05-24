"""
Thumbtack full taxonomy scraper.
Run locally: pip install requests beautifulsoup4 && python3 scrape_thumbtack.py
"""

import json
import sys

try:
    import requests
    from bs4 import BeautifulSoup
except ImportError:
    print("Install deps first: pip install requests beautifulsoup4")
    sys.exit(1)

URL = "https://www.thumbtack.com/services/"

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "en-US,en;q=0.9",
}


def scrape(url=URL):
    print(f"Fetching {url} ...", file=sys.stderr)
    resp = requests.get(url, headers=HEADERS, timeout=15)
    resp.raise_for_status()
    return resp.text


def parse(html):
    soup = BeautifulSoup(html, "html.parser")
    taxonomy = {"source": "Thumbtack", "url": URL, "categories": []}

    # Each category group lives in a div with id="category-group-*"
    groups = soup.find_all("div", id=lambda x: x and x.startswith("category-group-"))

    for group in groups:
        # Group name from h1 or h3
        heading = group.find(["h1", "h3"])
        if not heading:
            continue
        group_name = heading.get_text(strip=True)

        # Featured (hero card labels)
        featured = []
        for label in group.find_all("div", class_=lambda c: c and "categories__label" in c):
            text = label.get_text(strip=True)
            if text and text not in featured:
                featured.append(text)

        # All services (link list)
        services = []
        for link in group.find_all("a", class_=lambda c: c and "more-services-page__category__link" in c):
            text = link.get_text(strip=True)
            if text and text not in services:
                services.append(text)

        taxonomy["categories"].append({
            "name": group_name,
            "featured": featured,
            "services": services,
            "total_services": len(services),
        })

    taxonomy["total_categories"] = len(taxonomy["categories"])
    taxonomy["grand_total_services"] = sum(c["total_services"] for c in taxonomy["categories"])
    return taxonomy


if __name__ == "__main__":
    # Optionally pass a saved HTML file as argument: python3 scrape_thumbtack.py page.html
    if len(sys.argv) > 1:
        with open(sys.argv[1], encoding="utf-8") as f:
            html = f.read()
    else:
        html = scrape()

    result = parse(html)

    out_file = "thumbtack_taxonomy.json"
    with open(out_file, "w", encoding="utf-8") as f:
        json.dump(result, f, indent=2, ensure_ascii=False)

    print(f"Done! {result['total_categories']} categories, "
          f"{result['grand_total_services']} services → {out_file}", file=sys.stderr)
    print(json.dumps(result, indent=2, ensure_ascii=False))
