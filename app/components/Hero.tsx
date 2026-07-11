'use client'

import Link from 'next/link'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Autocomplete } from '@base-ui/react/autocomplete'
import { Button } from '@base-ui/react/button'
import { useLocale, useTranslations } from '@/lib/i18n/client'
import { LogoMark } from './Header'
import styles from './Hero.module.css'

const CAROUSEL_KEYS = ['cleaning', 'repairs', 'painting', 'moving'] as const
const POPULAR_SEARCH_KEYS = ['houseCleaning', 'handyman', 'plumbing', 'moving'] as const

type District = { id: number; roman: string; name: string }

function StarIcon() {
  return (
    <svg aria-label="star rating" height="14" width="14" fill="currentColor" viewBox="0 0 14 14" xmlns="http://www.w3.org/2000/svg">
      <path d="M8.627 5.246L7.342 1.258a.356.356 0 00-.684 0L5.373 5.244l-4.015.049c-.346.004-.489.466-.212.682l3.222 2.513-1.197 4.018c-.103.345.272.63.553.421L7 10.494l3.276 2.435c.282.209.656-.076.553-.422L9.632 8.49l3.222-2.513c.277-.216.134-.677-.211-.682l-4.016-.048z" />
    </svg>
  )
}

function SearchIcon() {
  return (
    <svg height="17" width="17" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <circle cx="11" cy="11" r="7" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  )
}

function MapPinIcon() {
  return (
    <svg height="16" width="16" fill="currentColor" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
      <path d="M3.002 7.25c0 3.248 4.342 7.756 5.23 8.825l.769.925.769-.926c.888-1.068 5.234-5.553 5.234-8.824C15.004 4.145 13 1 9.001 1c-3.999 0-6 3.145-6 6.25zm1.994 0C4.995 5.135 6.175 3 9 3s4.002 2.135 4.002 4.25c0 1.777-2.177 4.248-4.002 6.59C7.1 11.4 4.996 9.021 4.996 7.25zM8.909 5.5c-.827 0-1.5.673-1.5 1.5s.673 1.5 1.5 1.5 1.5-.673 1.5-1.5-.673-1.5-1.5-1.5z" />
    </svg>
  )
}

function ChevronDownIcon() {
  return (
    <svg height="14" width="14" fill="currentColor" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg">
      <path d="M1.646 4.646a.5.5 0 01.708 0L8 10.293l5.646-5.647a.5.5 0 01.708.708l-6 6a.5.5 0 01-.708 0l-6-6a.5.5 0 010-.708z" />
    </svg>
  )
}

function DistrictSelect({
  value,
  onChange,
  districts,
  placeholder,
}: {
  value: District | null
  onChange: (d: District) => void
  districts: District[]
  placeholder: string
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [open])

  return (
    <div ref={ref} className={styles.districtSelect}>
      <button
        type="button"
        className={styles.districtTrigger}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <span className={styles.districtPin}><MapPinIcon /></span>
        <span className={value ? styles.districtValue : styles.districtPlaceholder}>
          {value ? `${value.roman}. ${value.name}` : placeholder}
        </span>
        <span className={`${styles.districtChevron} ${open ? styles.districtChevronOpen : ''}`}>
          <ChevronDownIcon />
        </span>
      </button>
      <div
        role="listbox"
        className={styles.districtDropdown}
        data-open={open ? '' : undefined}
      >
        {districts.map((d) => (
          <button
            key={d.id}
            type="button"
            role="option"
            aria-selected={value?.id === d.id}
            className={`${styles.districtOption} ${value?.id === d.id ? styles.districtOptionSelected : ''}`}
            onClick={() => { onChange(d); setOpen(false) }}
          >
            <span className={styles.districtRoman}>{d.roman}.</span>
            {d.name}
          </button>
        ))}
      </div>
    </div>
  )
}

function SearchBar({ variant = 'hero' }: { variant?: 'hero' | 'sticky' }) {
  const t = useTranslations()
  const locale = useLocale()
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [district, setDistrict] = useState<District | null>(null)
  const [districts, setDistricts] = useState<District[]>([])
  const [items, setItems] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const abortRef = useRef<AbortController | null>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const itemsRef = useRef<string[]>(items)

  useEffect(() => {
    itemsRef.current = items
  }, [items])

  useEffect(() => {
    fetch('/api/districts')
      .then((r) => r.json())
      .then((data: { districts: District[] }) => setDistricts(data.districts))
  }, [])

  useEffect(() => {
    return () => {
      abortRef.current?.abort()
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [])

  function handleSearch(value: string | number) {
    const q = String(value).trim()
    setQuery(q)
    if (itemsRef.current.includes(q)) return

    abortRef.current?.abort()
    if (timeoutRef.current) clearTimeout(timeoutRef.current)

    if (!q) {
      setItems([])
      setLoading(false)
      return
    }

    timeoutRef.current = setTimeout(() => {
      const controller = new AbortController()
      abortRef.current = controller
      setLoading(true)
      const params = new URLSearchParams({ q, locale })
      fetch(`/api/search?${params.toString()}`, { signal: controller.signal })
        .then((r) => r.json())
        .then((data: { results: string[] }) => {
          setItems(data.results)
          setLoading(false)
        })
        .catch((err: Error) => {
          if (err.name !== 'AbortError') setLoading(false)
        })
    }, 180)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const q = query.trim()
    const params = new URLSearchParams()
    if (q) params.set('q', q)
    if (district) params.set('district', district.roman)
    const queryString = params.toString()
    router.push(queryString ? `/instant-results?${queryString}` : '/instant-results')
  }

  return (
    <form
      className={variant === 'sticky' ? styles.searchBarSticky : styles.searchBar}
      onSubmit={handleSubmit}
    >
      <div className={styles.searchFields}>
        <div className={styles.autocompleteRoot}>
          <span className={styles.queryIcon} aria-hidden="true"><SearchIcon /></span>
          <Autocomplete.Root items={items} filteredItems={items} onValueChange={handleSearch}>
            <Autocomplete.Input
              className={styles.queryInput}
              placeholder={t('home.hero.searchPlaceholder')}
            />
            <Autocomplete.Portal>
              <Autocomplete.Positioner className={styles.autocompletePositioner} sideOffset={4}>
                <Autocomplete.Popup className={styles.autocompletePopup}>
                  <Autocomplete.Status className={styles.autocompleteStatus}>
                    {loading && <span>{t('home.hero.searching')}</span>}
                  </Autocomplete.Status>
                  <Autocomplete.List className={styles.autocompleteList}>
                    {(item: string) => (
                      <Autocomplete.Item key={item} value={item} className={styles.autocompleteItem}>
                        {item}
                      </Autocomplete.Item>
                    )}
                  </Autocomplete.List>
                  <Autocomplete.Empty className={styles.autocompleteEmpty}>
                    {t('home.hero.noServicesFound')}
                  </Autocomplete.Empty>
                </Autocomplete.Popup>
              </Autocomplete.Positioner>
            </Autocomplete.Portal>
          </Autocomplete.Root>
        </div>
        <div className={styles.districtField}>
          <DistrictSelect value={district} onChange={setDistrict} districts={districts} placeholder={t('home.hero.districtPlaceholder')} />
        </div>
      </div>
      <Button type="submit" className={styles.searchBtn}>
        {t('home.hero.searchButton')}
      </Button>
    </form>
  )
}

export default function Hero() {
  const t = useTranslations()
  const searchRef = useRef<HTMLDivElement>(null)
  const [stickyVisible, setStickyVisible] = useState(false)
  const carouselItems = CAROUSEL_KEYS.map(key => t(`home.hero.carousel.${key}`))
  const popularSearches = POPULAR_SEARCH_KEYS.map(key => t(`home.hero.popularSearches.${key}`))

  useEffect(() => {
    const el = searchRef.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => setStickyVisible(!entry.isIntersecting),
      { threshold: 0 }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <>
      <section className={styles.hero}>
        <div className={styles.heroInner}>
          <h1 className={styles.heading}>
            <div className={styles.carouselWrapper}>
              <ul className={styles.carouselList}>
                {carouselItems.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
                <li aria-hidden="true">{carouselItems[0]}</li>
              </ul>
            </div>
            {t('home.hero.madeEasy')}
          </h1>
          <div ref={searchRef} className={styles.searchBarContainer}>
            <SearchBar />
          </div>
          <div className={styles.popularRow} aria-label={t('home.hero.popularSearchesLabel')}>
            <span className={styles.popularLabel}>{t('home.hero.popularNow')}</span>
            <div className={styles.popularLinks}>
              {popularSearches.map(service => (
                <Link key={service} href={`/instant-results?q=${encodeURIComponent(service)}`}>
                  {service}
                </Link>
              ))}
            </div>
          </div>
          <p className={styles.trustText}>
            {t('home.hero.trustPrefix')} &middot; 4.9/5{' '}
            <span className={styles.starGreen}><StarIcon /></span>{' '}
            {t('home.hero.trustSuffix')}
          </p>
        </div>
      </section>

      <div className={`${styles.stickyBar} ${stickyVisible ? styles.stickyBarVisible : ''}`}>
        <div className={styles.stickyBarInner}>
          <Link href="/" aria-label={t('header.aria.home')} className={styles.stickyBarLogo}>
            <LogoMark />
          </Link>
          <SearchBar variant="sticky" />
        </div>
      </div>
    </>
  )
}
