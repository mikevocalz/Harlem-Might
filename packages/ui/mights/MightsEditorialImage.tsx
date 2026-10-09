'use client';

import {
  editorialImageContentFit,
  editorialImageStateKey,
  isDisplayableEditorialImage,
  useEditorialImageStore,
  type EditorialImage,
} from '@acme/assets';
import { Image } from '../Image';
import { Figure, Figcaption, Link } from '../html';
import { Text, View } from '../tw';

export interface MightsEditorialImageProps {
  image: EditorialImage;
  screenId: string;
  ratio?: 'wide' | 'standard';
  sizes?: string;
  priority?: boolean;
  /** False inside linked cards, where nested source/license links would be invalid HTML. */
  interactiveCredit?: boolean;
}

export function MightsEditorialImage({
  image,
  screenId,
  ratio = 'wide',
  sizes = '100vw',
  priority = false,
  interactiveCredit = true,
}: MightsEditorialImageProps) {
  const key = editorialImageStateKey(screenId, image.id);
  const status = useEditorialImageStore((state) => state.statuses[key] ?? 'loading');
  const setStatus = useEditorialImageStore((state) => state.setStatus);

  if (!isDisplayableEditorialImage(image)) return null;
  const portrait = image.aspect !== undefined && image.aspect < 1;

  return (
    <Figure aria-label={image.altText} className="flex flex-col gap-2">
      <View className={`relative overflow-hidden bg-surface-sunken ${ratio === 'wide' ? 'aspect-video' : 'aspect-4/3'}`}>
        <Image
          src={image.url}
          alt={image.altText}
          fill
          sizes={sizes}
          loading={priority ? 'eager' : 'lazy'}
          priority={priority}
          contentFit={editorialImageContentFit(image)}
          // A portrait-shaped photo is usually a person, and the face sits
          // about a third of the way down: anchor the crop there so a wide
          // frame keeps the face (centre cuts at the eyes, top keeps only hair).
          contentPosition={portrait ? { top: '30%', left: '50%' } : 'center'}
          style={portrait ? { objectPosition: '50% 30%' } : undefined}
          className="absolute inset-0 h-full w-full"
          onLoadingComplete={() => setStatus(screenId, image.id, 'loaded')}
          onError={() => setStatus(screenId, image.id, 'error')}
        />
        {status !== 'loaded' ? (
          <View className="absolute bottom-0 left-0 bg-surface-raised/95 px-3 py-2">
            <Text accessibilityLiveRegion="polite" aria-live="polite" className="font-sans text-label text-text">
              {status === 'error'
                ? `The ${image.role === 'historical' ? 'archival photograph' : 'photograph'} could not be loaded.`
                : `Loading ${image.role === 'historical' ? 'archival photograph' : 'photograph'}.`}
            </Text>
          </View>
        ) : null}
      </View>
      <Figcaption className="flex flex-col gap-1 text-label text-text-muted">
        {image.caption ? <Text className="font-sans text-text">{image.caption}</Text> : null}
        <Text className="font-sans text-text-muted">
          {image.capturedAt ? `${image.capturedAt}. ` : ''}
          {image.creator && image.creator !== image.credit ? `${image.creator} · ${image.credit}. ` : `${image.creator ?? image.credit}. `}
          {interactiveCredit ? (
            <>
              <Link href={image.sourceUrl} target="_blank" rel="noreferrer" className="underline underline-offset-2">
                {image.attributionText}
              </Link>
              {' · '}
              <Link href={image.licenseUrl} target="_blank" rel="noreferrer" className="underline underline-offset-2">
                Rights statement
              </Link>
            </>
          ) : (
            `${image.attributionText} · ${image.license}`
          )}
          {image.shareAlike ? ' · Share-alike terms apply.' : ''}
        </Text>
      </Figcaption>
    </Figure>
  );
}
