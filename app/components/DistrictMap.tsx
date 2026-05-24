'use client'

import { MapContainer, TileLayer, Circle, Popup } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

// Fix Leaflet default marker icon paths broken by webpack
// eslint-disable-next-line @typescript-eslint/no-explicit-any
delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

type Props = {
  lat: number
  lng: number
  districtLabel: string
  height?: number
  radius?: number
  popupText?: string
}

export default function DistrictMap({
  lat,
  lng,
  districtLabel,
  height = 260,
  radius = 700,
  popupText,
}: Props) {
  return (
    <MapContainer
      center={[lat, lng]}
      zoom={13}
      scrollWheelZoom={false}
      style={{ height, width: '100%', borderRadius: '12px', zIndex: 0 }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <Circle
        center={[lat, lng]}
        radius={radius}
        pathOptions={{ color: '#f97316', fillColor: '#f97316', fillOpacity: 0.15, weight: 2 }}
      >
        <Popup>{popupText ?? `${districtLabel} — approximate service area`}</Popup>
      </Circle>
    </MapContainer>
  )
}
