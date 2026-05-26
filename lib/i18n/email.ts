import { getMessages } from './messages'
import { createTranslator } from './translator'
import { translateCategory } from './taxonomy'

export const huEmailT = createTranslator(getMessages('hu'))

function emailKey(value: string): string {
  return value
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

function humanizeKey(key: string): string {
  return key
    .replaceAll('_', ' ')
    .replace(/\b\w/g, letter => letter.toUpperCase())
}

export function huCategory(categoryName: string): string {
  return translateCategory(huEmailT, categoryName)
}

export function huAnswerLabel(key: string): string {
  return huEmailT(`projects.answers.keys.${emailKey(key)}`, { defaultValue: humanizeKey(key) })
}

export function huAnswerValue(value: string): string {
  return huEmailT(`projects.answers.values.${emailKey(value)}`, { defaultValue: value })
}

export function huRole(role: string): string {
  if (role === 'pro') return 'szakember'
  if (role === 'customer') return 'ügyfél'
  if (role === 'admin') return 'admin'
  return role
}

export function huStatus(status: string): string {
  const labels: Record<string, string> = {
    active: 'aktív',
    suspended: 'felfüggesztve',
    rejected: 'elutasítva',
    pending: 'függőben',
    quoted: 'ajánlat elküldve',
    accepted: 'elfogadva',
    declined: 'elutasítva',
    completed: 'befejezve',
    cancelled: 'törölve',
  }
  return labels[status] ?? status
}
