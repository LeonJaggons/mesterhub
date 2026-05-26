export type SignupData = {
  fullName?: string
  email?: string
  phone?: string
  phoneVerified?: boolean
  password?: string
  categoryId?: string
  categoryName?: string
  regulated?: boolean
  insuranceRequired?: boolean
  services?: string[]
  districts?: number[]
  radius?: number
  postcode?: string
  bio?: string
  yearsExp?: string
  pricingType?: 'hourly' | 'fixed' | 'quote'
  hourlyRate?: string
  availability?: string[]
  socialLinks?: {
    website?: string
    facebook?: string
    instagram?: string
    linkedin?: string
    tiktok?: string
  }
  paymentMethods?: string[]
  faqs?: {
    pricing?: string
    process?: string
    advice?: string
  }
  backgroundCheck?: boolean
  licenceNumber?: string
  iban?: string
  // Storage download URLs
  avatarUrl?: string
  workPhotoUrls?: string[]
  pastProjects?: PastProject[]
  idDocumentUrl?: string
  selfieUrl?: string
  certificateUrl?: string
  insuranceUrl?: string
}

export type PastProject = {
  id: string
  jobType: string
  location: string
  duration: string
  year: string
  description: string
  beforeUrl?: string
  afterUrl?: string
}

const KEY = 'mh_pro_signup'
const stagedFiles = new Map<string, File>()

export function load(): SignupData {
  if (typeof window === 'undefined') return {}
  try { return JSON.parse(localStorage.getItem(KEY) ?? '{}') }
  catch { return {} }
}

export function save(patch: Partial<SignupData>): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(KEY, JSON.stringify({ ...load(), ...patch }))
}

export function clear(): void {
  if (typeof window === 'undefined') return
  localStorage.removeItem(KEY)
  stagedFiles.clear()
}

export function stageFile(key: string, file: File): void {
  stagedFiles.set(key, file)
}

export function getStagedFile(key: string): File | undefined {
  return stagedFiles.get(key)
}

export function getStagedFiles(): Map<string, File> {
  return stagedFiles
}
