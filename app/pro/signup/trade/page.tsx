'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  MdCleaningServices, MdPlumbing, MdElectricalServices, MdFormatPaint,
  MdCarpenter, MdAir, MdYard, MdLocalShipping, MdHandyman, MdCameraAlt,
  MdSchool, MdFitnessCenter,
} from 'react-icons/md'
import type { IconType } from 'react-icons'
import { useTranslations } from '@/lib/i18n/client'
import { translateCategory, translateLicenceNote, translateService } from '@/lib/i18n/taxonomy'
import { save } from '../store'
import styles from '../signup.module.css'

const dg = { fontFamily: 'var(--font-darker-grotesque)' } as const
const MAX_SERVICES = 6

// Icons live client-side only — cannot be serialised in JSON
const CATEGORY_ICONS: Record<string, IconType> = {
  Cleaning: MdCleaningServices,
  Plumbing: MdPlumbing,
  Electrical: MdElectricalServices,
  Painting: MdFormatPaint,
  Carpentry: MdCarpenter,
  HVAC: MdAir,
  Gardening: MdYard,
  Moving: MdLocalShipping,
  Handyman: MdHandyman,
  Photography: MdCameraAlt,
  Tutoring: MdSchool,
  Fitness: MdFitnessCenter,
}

type CategorySummary = {
  name: string
  total_services: number
  featured: string[]
  regulated: boolean
  licenceNote?: string
  insuranceRequired: boolean
}

type CategoryDetail = CategorySummary & { services: string[] }

export default function TradePage() {
  const t = useTranslations()
  const router = useRouter()

  const [categories, setCategories] = useState<CategorySummary[]>([])
  const [loading, setLoading] = useState(true)

  const [selected, setSelected] = useState<CategorySummary | null>(null)
  const [detail, setDetail] = useState<CategoryDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  const [chosenServices, setChosenServices] = useState<string[]>([])

  useEffect(() => {
    fetch('/api/categories')
      .then(r => r.json())
      .then(data => {
        setCategories(data.categories)
        setLoading(false)
      })
  }, [])

  function selectCategory(cat: CategorySummary) {
    setSelected(cat)
    setChosenServices([])
    setDetail(null)
    setDetailLoading(true)
    fetch(`/api/categories?name=${encodeURIComponent(cat.name)}`)
      .then(r => r.json())
      .then((d: CategoryDetail) => {
        setDetail(d)
        setDetailLoading(false)
      })
  }

  function toggleService(s: string) {
    setChosenServices(prev =>
      prev.includes(s)
        ? prev.filter(x => x !== s)
        : prev.length < MAX_SERVICES ? [...prev, s] : prev
    )
  }

  function handleContinue() {
    if (!selected) return
    save({
      categoryId: selected.name.toLowerCase().replace(/\s+/g, '-'),
      categoryName: selected.name,
      regulated: selected.regulated,
      insuranceRequired: selected.insuranceRequired,
      services: chosenServices,
    })
    router.push('/pro/signup/area')
  }

  if (loading) {
    return (
      <div className={styles.stepPage} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '40vh' }}>
        <p style={{ color: '#9ca3af' }}>{t('proSignup.trade.loading')}</p>
      </div>
    )
  }

  return (
    <div className={styles.stepPage}>
      <button className={styles.back} onClick={() => router.back()}>{t('proSignup.common.back')}</button>
      <h1 className={styles.stepTitle} style={dg}>{t('proSignup.trade.title')}</h1>
      <p className={styles.stepSubtitle}>
        {t('proSignup.trade.subtitle')}
      </p>

      {!selected ? (
        <div className={styles.categoryGrid}>
          {categories.map(cat => {
            const Icon = CATEGORY_ICONS[cat.name]
            return (
              <button
                key={cat.name}
                className={styles.categoryCard}
                onClick={() => selectCategory(cat)}
              >
                {Icon && <Icon size={28} color="#0ea5e9" />}
                <span className={styles.categoryCardName}>{translateCategory(t, cat.name)}</span>
                {cat.regulated && <span className={styles.regulatedBadge}>{t('proSignup.trade.licensed')}</span>}
              </button>
            )
          })}
        </div>
      ) : (
        <>
          <button className={styles.back} style={{ marginBottom: '1rem' }} onClick={() => setSelected(null)}>
            {t('proSignup.trade.changeCategory')}
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
            {CATEGORY_ICONS[selected.name] && (() => {
              const Icon = CATEGORY_ICONS[selected.name]
              return <Icon size={28} color="#0ea5e9" />
            })()}
            <span style={{ fontWeight: 700, fontSize: '1.125rem', color: '#111827', ...dg }}>{translateCategory(t, selected.name)}</span>
          </div>

          {selected.regulated && selected.licenceNote && (
            <div className={styles.infoBox}>
              <p className={styles.infoBoxTitle}>{t('proSignup.trade.licensedTrade')}</p>
              {t('proSignup.trade.certificateLater', { note: translateLicenceNote(t, selected.licenceNote) })}
              {selected.insuranceRequired && t('proSignup.trade.insuranceRequired')}
            </div>
          )}

          {detailLoading ? (
            <p style={{ color: '#9ca3af', fontSize: '0.9375rem', marginBottom: '1.5rem' }}>{t('proSignup.trade.loadingServices')}</p>
          ) : (
            <>
              <p className={styles.serviceCount}>
                {t('proSignup.trade.serviceCount', { selected: chosenServices.length, max: MAX_SERVICES })}
              </p>
              <div className={styles.serviceList}>
                {detail?.services.map(s => {
                  const isSelected = chosenServices.includes(s)
                  const isDisabled = !isSelected && chosenServices.length >= MAX_SERVICES
                  return (
                    <button
                      key={s}
                      className={`${styles.serviceItem} ${isSelected ? styles.serviceItemSelected : ''}`}
                      onClick={() => !isDisabled && toggleService(s)}
                      style={{ opacity: isDisabled ? 0.4 : 1 }}
                    >
                      <div className={styles.serviceCheckbox}>
                        {isSelected && (
                          <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                            <path d="M1 4l2.5 2.5L9 1" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                      </div>
                      <span className={styles.serviceItemName}>{translateService(t, s)}</span>
                    </button>
                  )
                })}
              </div>
            </>
          )}

          <button
            className={styles.continueBtn}
            style={dg}
            disabled={chosenServices.length === 0 || detailLoading}
            onClick={handleContinue}
          >
            {t('proSignup.trade.continueWithServices', {
              count: chosenServices.length,
              countLabel: chosenServices.length === 1 ? t('proSignup.trade.serviceSingular') : t('proSignup.trade.servicePlural'),
            })}
          </button>
        </>
      )}
    </div>
  )
}
