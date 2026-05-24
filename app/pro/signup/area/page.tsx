'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { save } from '../store'
import styles from '../signup.module.css'

const dg = { fontFamily: 'var(--font-darker-grotesque)' } as const

const DISTRICTS = [
  { id: 1, roman: 'I', name: 'Budavár' },
  { id: 2, roman: 'II', name: 'Budai hegyvidék' },
  { id: 3, roman: 'III', name: 'Óbuda-Békásmegyer' },
  { id: 4, roman: 'IV', name: 'Újpest' },
  { id: 5, roman: 'V', name: 'Belváros-Lipótváros' },
  { id: 6, roman: 'VI', name: 'Terézváros' },
  { id: 7, roman: 'VII', name: 'Erzsébetváros' },
  { id: 8, roman: 'VIII', name: 'Józsefváros' },
  { id: 9, roman: 'IX', name: 'Ferencváros' },
  { id: 10, roman: 'X', name: 'Kőbánya' },
  { id: 11, roman: 'XI', name: 'Újbuda' },
  { id: 12, roman: 'XII', name: 'Hegyvidék' },
  { id: 13, roman: 'XIII', name: 'Angyalföld' },
  { id: 14, roman: 'XIV', name: 'Zugló' },
  { id: 15, roman: 'XV', name: 'Rákospalota' },
  { id: 16, roman: 'XVI', name: 'Rákosszentmihály' },
  { id: 17, roman: 'XVII', name: 'Rákosmente' },
  { id: 18, roman: 'XVIII', name: 'Pestszentlőrinc' },
  { id: 19, roman: 'XIX', name: 'Kispest' },
  { id: 20, roman: 'XX', name: 'Pesterzsébet' },
  { id: 21, roman: 'XXI', name: 'Csepel' },
  { id: 22, roman: 'XXII', name: 'Budafok-Tétény' },
  { id: 23, roman: 'XXIII', name: 'Soroksár' },
]

export default function AreaPage() {
  const router = useRouter()
  const [selected, setSelected] = useState<number[]>([])
  const [radius, setRadius] = useState(10)
  const [postcode, setPostcode] = useState('')

  function toggle(id: number) {
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  function selectAll() { setSelected(DISTRICTS.map(d => d.id)) }
  function clearAll() { setSelected([]) }

  function handleContinue() {
    save({ districts: selected, radius, postcode })
    router.push('/pro/signup/profile')
  }

  return (
    <div className={styles.stepPage}>
      <button className={styles.back} onClick={() => router.back()}>← Back</button>
      <h1 className={styles.stepTitle} style={dg}>Where do you work?</h1>
      <p className={styles.stepSubtitle}>
        Pick the Budapest districts you cover. Customers can only find you in the districts you select — so choose all that you&apos;re happy to travel to.
      </p>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
        <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#374151' }}>
          {selected.length} district{selected.length !== 1 ? 's' : ''} selected
        </span>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button onClick={selectAll} style={{ fontSize: '0.8125rem', color: '#f97316', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
            Select all
          </button>
          <button onClick={clearAll} style={{ fontSize: '0.8125rem', color: '#9ca3af', background: 'none', border: 'none', cursor: 'pointer' }}>
            Clear
          </button>
        </div>
      </div>

      <div className={styles.districtGrid}>
        {DISTRICTS.map(d => (
          <button
            key={d.id}
            className={`${styles.districtBtn} ${selected.includes(d.id) ? styles.districtBtnSelected : ''}`}
            onClick={() => toggle(d.id)}
            title={d.name}
          >
            <div style={{ fontWeight: 700 }}>{d.roman}.</div>
            <div style={{ fontSize: '0.625rem', marginTop: '0.1rem', fontWeight: 500 }}>{d.name.split('-')[0]}</div>
          </button>
        ))}
      </div>

      <hr className={styles.separator} />

      <div className={styles.field}>
        <div className={styles.sliderLabel}>
          <label className={styles.label} style={{ marginBottom: 0 }}>Radius from home base</label>
          <span className={styles.sliderValue}>{radius} km</span>
        </div>
        <input
          type="range"
          min={5}
          max={50}
          value={radius}
          onChange={e => setRadius(Number(e.target.value))}
          className={styles.slider}
        />
        <p style={{ fontSize: '0.8125rem', color: '#9ca3af', marginTop: '0.375rem' }}>
          We&apos;ll also show you jobs within this radius of your home postcode.
        </p>
      </div>

      <div className={styles.field}>
        <label className={styles.label}>Home postcode <span className={styles.labelHint}>for routing</span></label>
        <input
          className={styles.input}
          placeholder="e.g. 1051"
          value={postcode}
          onChange={e => setPostcode(e.target.value.replace(/\D/g, '').slice(0, 4))}
          maxLength={4}
          inputMode="numeric"
        />
      </div>

      <button
        className={styles.continueBtn}
        style={dg}
        disabled={selected.length === 0 || !postcode}
        onClick={handleContinue}
      >
        Continue
      </button>
    </div>
  )
}
