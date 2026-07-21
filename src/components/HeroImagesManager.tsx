'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { compressImage, formatBytes } from '@/lib/compressImage'
import { toast } from 'sonner'
import { ImagePlus, Trash2, Loader2 } from 'lucide-react'

interface HeroImage {
  id: string
  image_url: string
  sort_order: number
}

const BUCKET = 'hero'
const MAX_BYTES = 2 * 1024 * 1024 // 2 MB — keep the banner light

// Pull the storage path back out of a public URL so we can delete the file
function storagePathFromUrl(url: string): string | null {
  const marker = `/storage/v1/object/public/${BUCKET}/`
  const i = url.indexOf(marker)
  return i === -1 ? null : url.slice(i + marker.length)
}

export default function HeroImagesManager() {
  const [images, setImages] = useState<HeroImage[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()

  useEffect(() => {
    supabase
      .from('hero_images')
      .select('id, image_url, sort_order')
      .order('sort_order', { ascending: true })
      .then(({ data }) => {
        if (data) setImages(data)
        setLoading(false)
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (fileRef.current) fileRef.current.value = '' // allow re-selecting same file
    if (!file) return

    if (!file.type.startsWith('image/')) {
      toast.error('Please choose an image file')
      return
    }

    setUploading(true)
    try {
      // Shrink camera originals before they ever reach Storage
      const compressed = await compressImage(file)
      if (compressed.size < file.size) {
        toast.success(`Compressed ${formatBytes(file.size)} → ${formatBytes(compressed.size)}`)
      }
      if (compressed.size > MAX_BYTES) {
        toast.error(`Still too large (${formatBytes(compressed.size)}) — please use a smaller photo.`)
        return
      }

      const ext = compressed.name.split('.').pop()?.toLowerCase() || 'jpg'
      const path = `${crypto.randomUUID()}.${ext}`

      const { error: upErr } = await supabase.storage
        .from(BUCKET)
        .upload(path, compressed, { contentType: compressed.type, upsert: false })
      if (upErr) throw upErr

      const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path)

      const nextOrder = images.length
        ? Math.max(...images.map((i) => i.sort_order)) + 1
        : 0

      const { data: row, error: insErr } = await supabase
        .from('hero_images')
        .insert({ image_url: pub.publicUrl, sort_order: nextOrder })
        .select('id, image_url, sort_order')
        .single()
      if (insErr) throw insErr

      setImages((prev) => [...prev, row as HeroImage])
      toast.success('Banner image added')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Upload failed'
      toast.error(msg)
    } finally {
      setUploading(false)
    }
  }

  async function handleDelete(img: HeroImage) {
    setDeletingId(img.id)
    try {
      const { error: delErr } = await supabase.from('hero_images').delete().eq('id', img.id)
      if (delErr) throw delErr

      // Best-effort removal of the underlying file
      const path = storagePathFromUrl(img.image_url)
      if (path) await supabase.storage.from(BUCKET).remove([path])

      setImages((prev) => prev.filter((i) => i.id !== img.id))
      toast.success('Banner image removed')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Delete failed'
      toast.error(msg)
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="mb-4 rounded-2xl border-2 border-gray-100 bg-white p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-sm font-extrabold text-gray-900">Home Banner Images</h2>
          <p className="text-[11px] text-gray-400 font-medium mt-0.5">
            These rotate on the customer home screen
          </p>
        </div>
        <button
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="flex items-center gap-1.5 bg-[#c0392b] hover:bg-[#a93226] text-white text-xs font-bold px-3 py-2 rounded-xl disabled:opacity-50 transition-colors"
        >
          {uploading ? <Loader2 className="size-4 animate-spin" /> : <ImagePlus className="size-4" />}
          {uploading ? 'Uploading…' : 'Add Image'}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          onChange={handleUpload}
          className="hidden"
        />
      </div>

      {loading ? (
        <p className="text-xs text-gray-400 py-4 text-center">Loading…</p>
      ) : images.length === 0 ? (
        <p className="text-xs text-gray-400 py-6 text-center">
          No banner images yet. Add one — until then the app shows its defaults.
        </p>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          {images.map((img) => (
            <div key={img.id} className="relative aspect-video rounded-xl overflow-hidden bg-gray-100 group">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img.image_url} alt="Banner" className="w-full h-full object-cover" />
              <button
                onClick={() => handleDelete(img)}
                disabled={deletingId === img.id}
                className="absolute top-1 right-1 w-7 h-7 rounded-full bg-black/60 hover:bg-red-600 flex items-center justify-center transition-colors disabled:opacity-50"
                aria-label="Delete image"
              >
                {deletingId === img.id
                  ? <Loader2 className="size-3.5 text-white animate-spin" />
                  : <Trash2 className="size-3.5 text-white" />}
              </button>
            </div>
          ))}
        </div>
      )}

      <p className="text-[10px] text-gray-400 mt-3 leading-relaxed">
        Tip: use wide (landscape) photos under 2 MB for fast loading.
      </p>
    </div>
  )
}
