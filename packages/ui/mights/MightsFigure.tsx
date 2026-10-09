import { Image } from '../Image';
import { Figcaption, Figure } from '../html';
import { View } from '../tw';
import { notch } from './geometry';

// A framed editorial image with an optional caption (use it for credits on
// documentary or archival photographs). Renders nothing until there is an image.
// Kit primitives only, so the same file serves web and native; on native the
// notch class is inert and the frame reads as a rail-coloured border.
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
    <Figure className={`flex flex-col gap-2 ${className}`}>
      <View className={`bg-rule-rail p-rail ${notch}`}>
        <View className={`overflow-hidden bg-surface-raised ${notch} ${ratio === 'wide' ? 'aspect-video' : 'aspect-4/3'}`}>
          <Image src={src} alt={alt} fill priority={priority} sizes="(min-width: 768px) 60vw, 100vw" className="h-full w-full" />
        </View>
      </View>
      {caption ? <Figcaption className="text-label text-text-muted">{caption}</Figcaption> : null}
    </Figure>
  );
}
