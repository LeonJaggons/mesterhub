'use client'

import React from 'react'
import { useEffect, useRef, useState } from 'react'
import { useLocale } from '@/lib/i18n/client'

type AddressAutocompleteInputProps = {
  id?: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
  required?: boolean
  disabled?: boolean
  country?: string | string[]
}

type Place = {
  fetchFields?: (options: { fields: string[] }) => Promise<void>
  formattedAddress?: string
  displayName?: string | { text?: string }
}

type PlacePrediction = {
  text?: string | { text?: string; toString?: () => string }
  toPlace?: () => Place
}

type GooglePlaceAutocompleteElement = HTMLElement & {
  includedRegionCodes?: string[]
  requestedLanguage?: string
  placeholder?: string
  value?: string
  disabled?: boolean
}

type GoogleMapsWindow = Window & {
  google?: {
    maps?: {
      importLibrary?: (libraryName: 'places') => Promise<unknown>
    }
  }
}

let googlePlacesPromise: Promise<void> | null = null

function loadGooglePlaces(locale: string): Promise<void> {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
  if (!apiKey) return Promise.reject(new Error('Missing NEXT_PUBLIC_GOOGLE_MAPS_API_KEY.'))

  const win = window as GoogleMapsWindow
  if (win.google?.maps?.importLibrary) {
    return win.google.maps.importLibrary('places').then(() => undefined)
  }
  if (googlePlacesPromise) return googlePlacesPromise

  googlePlacesPromise = new Promise<void>((resolve, reject) => {
    const existing = document.getElementById('google-places-script') as HTMLScriptElement | null
    if (existing) {
      if ((window as GoogleMapsWindow).google?.maps?.importLibrary) {
        ;(window as GoogleMapsWindow).google?.maps?.importLibrary?.('places').then(() => resolve()).catch(reject)
        return
      }
      existing.addEventListener('load', () => {
        ;(window as GoogleMapsWindow).google?.maps?.importLibrary?.('places').then(() => resolve()).catch(reject)
      }, { once: true })
      existing.addEventListener('error', () => reject(new Error('Google Places failed to load.')), { once: true })
      return
    }

    const script = document.createElement('script')
    const params = new URLSearchParams({
      key: apiKey,
      libraries: 'places',
      language: locale,
      loading: 'async',
    })
    script.id = 'google-places-script'
    script.src = `https://maps.googleapis.com/maps/api/js?${params.toString()}`
    script.async = true
    script.defer = true
    script.addEventListener('load', () => {
      ;(window as GoogleMapsWindow).google?.maps?.importLibrary?.('places').then(() => resolve()).catch(reject)
    }, { once: true })
    script.addEventListener('error', () => reject(new Error('Google Places failed to load.')), { once: true })
    document.head.appendChild(script)
  })

  return googlePlacesPromise
}

export default function AddressAutocompleteInput({
  id,
  value,
  onChange,
  placeholder,
  className,
  required,
  disabled,
  country = 'hu',
}: AddressAutocompleteInputProps) {
  const locale = useLocale()
  const placeElementRef = useRef<GooglePlaceAutocompleteElement | null>(null)
  const onChangeRef = useRef(onChange)
  const [scriptFailed, setScriptFailed] = useState(false)

  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  useEffect(() => {
    let cancelled = false
    const placeElement = placeElementRef.current
    if (!placeElement) return

    placeElement.id = id ?? ''
    placeElement.className = className ?? ''
    placeElement.placeholder = placeholder ?? ''
    placeElement.includedRegionCodes = Array.isArray(country) ? country : [country]
    placeElement.requestedLanguage = locale
    placeElement.value = value
    placeElement.disabled = Boolean(disabled)

    const placeElementHandler = (event: Event) => {
      const selection = event as Event & {
        placePrediction?: PlacePrediction
        detail?: { placePrediction?: PlacePrediction }
      }
      const prediction = selection.placePrediction ?? selection.detail?.placePrediction
      const place = prediction?.toPlace?.()
      if (!place) return
      void place.fetchFields?.({ fields: ['formattedAddress', 'displayName'] })
        .then(() => {
          const displayName = typeof place.displayName === 'string'
            ? place.displayName
            : place.displayName?.text
          onChangeRef.current(place.formattedAddress || displayName || '')
        })
    }
    placeElement.addEventListener('gmp-select', placeElementHandler)

    if (process.env.NODE_ENV !== 'production') {
      console.info('Google Places autocomplete mounting.', {
        hasKey: Boolean(process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY),
        locale,
        country,
      })
    }

    loadGooglePlaces(locale)
      .then(() => {
        if (cancelled) return
        if (process.env.NODE_ENV !== 'production') {
          console.info('Google Places autocomplete script is ready.')
        }
      })
      .catch((error: unknown) => {
        if (process.env.NODE_ENV !== 'production') {
          console.warn(
            'Google Places autocomplete is unavailable. Check NEXT_PUBLIC_GOOGLE_MAPS_API_KEY, enabled APIs, billing, and HTTP referrer restrictions.',
            error,
          )
        }
        if (!cancelled) setScriptFailed(true)
      })

    return () => {
      cancelled = true
      placeElement.removeEventListener('gmp-select', placeElementHandler)
    }
  }, [className, country, disabled, id, locale, placeholder, value])

  useEffect(() => {
    if (!placeElementRef.current) return
    placeElementRef.current.value = value
  }, [value])

  useEffect(() => {
    if (!placeElementRef.current) return
    placeElementRef.current.disabled = Boolean(disabled)
  }, [disabled])

  return (
    <div className="relative">
      {scriptFailed ? (
        <input
          id={id}
          type="text"
          value={value}
          onChange={event => onChange(event.target.value)}
          placeholder={placeholder}
          className={className}
          required={required}
          disabled={disabled}
          autoComplete="street-address"
        />
      ) : React.createElement('gmp-place-autocomplete', { ref: placeElementRef })}
    </div>
  )
}
