import { notch } from './geometry';

// A framed editorial image with a caption. Generated images are always
// captioned as generated so they are never mistaken for documentary
// photographs of a real place or person. Renders nothing until there is an image.
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
      <div className={`bg-rule-rail p-[2px] ${notch}`}>
        <div className={`overflow-hidden bg-surface-raised ${notch} ${ratio === 'wide' ? 'aspect-[16/9]' : 'aspect-[4/3]'}`}>
          {/* eslint-disable-next-line @next/next/no-img-element -- static file in /public, sized by its frame */}
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
      <figcaption className="text-[13px] text-text-muted">{caption ?? 'Generated image'}</figcaption>
    </figure>
  );
}
