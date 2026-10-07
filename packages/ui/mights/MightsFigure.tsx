import { notch } from './geometry';

// A framed editorial image with an optional caption (use it for credits on
// documentary or archival photographs). Renders nothing until there is an image.
export function MightsFigure({
  src,
  alt,
  caption,
  ratio = 'wide',
  priority,
  className = '',
}: {
  src: string | null;
  alt: string;
  caption?: string;
  ratio?: 'wide' | 'standard';
  priority?: boolean;
  className?: string;
}) {
  if (!src) return null;
  return (
    <figure className={`flex flex-col gap-2 ${className}`}>
      <div className={`bg-rule-rail p-rail ${notch}`}>
        <div className={`overflow-hidden bg-surface-raised ${notch} ${ratio === 'wide' ? 'aspect-video' : 'aspect-4/3'}`}>
          {/* Plain <img>: this package lints outside the Next plugin; static /public file sized by its frame */}
          <img
            src={src}
            alt={alt}
            loading={priority ? 'eager' : 'lazy'}
            fetchPriority={priority ? 'high' : 'auto'}
            decoding="async"
            className="block h-full w-full object-cover"
          />
        </div>
      </div>
      {caption ? <figcaption className="text-label text-text-muted">{caption}</figcaption> : null}
    </figure>
  );
}
