const DEFAULT_MAX_DIMENSION = 1800
const DEFAULT_MAX_BYTES = 2.5 * 1024 * 1024
const MIN_QUALITY = 0.62

type CompressOptions = {
  maxBytes?: number
  maxDimension?: number
  mimeType?: 'image/jpeg' | 'image/webp'
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const image = new Image()
    image.onload = () => {
      URL.revokeObjectURL(url)
      resolve(image)
    }
    image.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Could not read image.'))
    }
    image.src = url
  })
}

function canvasBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => {
      if (blob) resolve(blob)
      else reject(new Error('Could not compress image.'))
    }, type, quality)
  })
}

export async function compressImageFile(file: File, options: CompressOptions = {}): Promise<File> {
  if (!file.type.startsWith('image/') || file.type === 'image/gif') return file

  const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES
  const maxDimension = options.maxDimension ?? DEFAULT_MAX_DIMENSION
  if (file.size <= maxBytes) return file

  const image = await loadImage(file)
  const scale = Math.min(1, maxDimension / Math.max(image.naturalWidth, image.naturalHeight))
  const width = Math.max(1, Math.round(image.naturalWidth * scale))
  const height = Math.max(1, Math.round(image.naturalHeight * scale))
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height

  const context = canvas.getContext('2d')
  if (!context) return file

  context.drawImage(image, 0, 0, width, height)

  const type = options.mimeType ?? 'image/jpeg'
  let quality = 0.82
  let blob = await canvasBlob(canvas, type, quality)

  while (blob.size > maxBytes && quality > MIN_QUALITY) {
    quality = Math.max(MIN_QUALITY, quality - 0.08)
    blob = await canvasBlob(canvas, type, quality)
  }

  if (blob.size >= file.size) return file

  const extension = type === 'image/webp' ? 'webp' : 'jpg'
  const filename = file.name.replace(/\.[^.]+$/, '') || 'image'
  return new File([blob], `${filename}.${extension}`, {
    type,
    lastModified: Date.now(),
  })
}

export async function compressImageFiles(files: File[], options?: CompressOptions): Promise<File[]> {
  return Promise.all(files.map(file => compressImageFile(file, options)))
}
