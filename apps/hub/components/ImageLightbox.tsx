import { useEffect } from 'react'
import { X } from 'lucide-react'

// Full-screen image preview. 500×500 white modal on a dimmed, blurred backdrop.
// Closes on the X button, a backdrop click, or Escape.
export default function ImageLightbox({
  url,
  caption,
  onClose,
}: {
  url: string
  caption?: string
  onClose: () => void
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      onClick={onClose}
      data-testid="lightbox-backdrop"
      className="fixed inset-0 z-[600] flex items-center justify-center backdrop-blur-[4px]"
      style={{ background: 'rgba(0,0,0,0.85)' }}
      role="dialog"
      aria-modal="true"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        data-testid="lightbox-modal"
        className="relative h-[500px] w-[500px] max-w-[92vw] overflow-hidden rounded-xl bg-white shadow-2xl"
      >
        <button
          onClick={onClose}
          title="Đóng"
          aria-label="Đóng"
          className="absolute right-2 top-2 z-10 grid h-8 w-8 place-items-center rounded-full border border-line bg-white/90 text-muted transition hover:text-fg"
        >
          <X size={16} />
        </button>
        <img src={url} alt={caption ?? ''} className="h-full w-full object-contain" />
        {caption && (
          <div className="absolute inset-x-0 bottom-0 truncate bg-black/55 px-3 py-1.5 text-center text-[11px] text-white">
            {caption}
          </div>
        )}
      </div>
    </div>
  )
}
