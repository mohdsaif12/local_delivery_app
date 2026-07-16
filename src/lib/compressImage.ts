// Shrink an image in the browser before uploading it.
//
// Phone cameras produce 10–30 MB originals, but the app never displays them
// larger than a few hundred pixels. Compressing before upload keeps Storage
// small and pages fast — a ~17 MB photo becomes ~200 KB with no visible
// difference at display size.

interface CompressOptions {
  /** Longest edge of the output, in pixels. */
  maxWidth?: number
  /** JPEG quality, 0–1. */
  quality?: number
}

export async function compressImage(
  file: File,
  { maxWidth = 1600, quality = 0.8 }: CompressOptions = {}
): Promise<File> {
  if (!file.type.startsWith('image/')) return file
  // GIFs would lose animation, SVGs are already tiny vectors — leave them be.
  if (file.type === 'image/gif' || file.type === 'image/svg+xml') return file

  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file)
  } catch {
    return file // undecodable — let the caller deal with the original
  }

  const scale = Math.min(1, maxWidth / bitmap.width)
  const width = Math.round(bitmap.width * scale)
  const height = Math.round(bitmap.height * scale)

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height

  const ctx = canvas.getContext('2d')
  if (!ctx) {
    bitmap.close()
    return file
  }

  ctx.drawImage(bitmap, 0, 0, width, height)
  bitmap.close()

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/jpeg', quality)
  )

  // If compression didn't actually help (e.g. already-optimised small image),
  // keep the original rather than re-encoding it for nothing.
  if (!blob || blob.size >= file.size) return file

  const name = file.name.replace(/\.[^.]+$/, '') + '.jpg'
  return new File([blob], name, { type: 'image/jpeg', lastModified: Date.now() })
}

/** Human-readable byte size, e.g. "16.3 MB". */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}
