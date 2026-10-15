'use client';

import { useEffect, useRef } from 'react';
import { tv } from './tv';
import { DropSurface } from './html/dom.web';
import { View } from './tw';
import { CloudUpload } from './icons';
import { Text } from './Text';
import type { Assets, DropAsset, DropZoneProps } from './DropZone.types';
import { useInstanceStore, useStore } from './use-instance-store';

export type { Assets, DropAsset };

const dropZone = tv({
  slots: {
    root:
      'flex items-center justify-center gap-3 rounded-sheet border-2 border-dashed border-border-strong ' +
      'bg-surface-sunken p-10 transition-all duration-base ' +
      'hover:border-focus/60 hover:bg-surface-raised motion-reduce:transition-none',
    well:
      'h-16 w-16 items-center justify-center rounded-md border-2 border-border bg-surface-raised shadow-card ' +
      'transition-all duration-base motion-reduce:transition-none',
    title: 'text-center font-semibold',
    description: 'max-w-content-form text-center',
  },
  variants: {
    active: {
      true: {
        root: 'border-focus bg-surface-raised shadow-card ring-4 ring-focus/10',
        well: '-translate-y-0.5 scale-105 bg-ember-50 shadow-raised',
      },
    },
  },
});

function accepts(type: string, allowed?: (string | RegExp)[]) {
  if (allowed === undefined) return true;
  if (allowed.length === 0) return false;
  return allowed.some((rule) => {
    if (typeof rule === 'string') return rule === type;
    rule.lastIndex = 0;
    return rule.test(type);
  });
}

function toBase64(file: File, signal: AbortSignal) {
  return new Promise<string>((resolve, reject) => {
    if (signal.aborted) return reject(signal.reason);
    const reader = new FileReader();
    const cleanup = () => {
      signal.removeEventListener('abort', abort);
      reader.onload = reader.onerror = reader.onabort = null;
    };
    const abort = () => {
      cleanup();
      reader.abort();
      reject(signal.reason);
    };
    reader.onerror = () => {
      cleanup();
      reject(reader.error ?? new Error('Could not read dropped file'));
    };
    reader.onabort = () => {
      cleanup();
      reject(new Error('Dropped file reading was cancelled'));
    };
    reader.onload = () => { cleanup(); resolve(String(reader.result ?? '')); };
    signal.addEventListener('abort', abort, { once: true });
    try {
      reader.readAsDataURL(file);
    } catch (error) {
      cleanup();
      reject(error);
    }
  });
}

async function fileToAsset(
  file: File,
  includeBase64: boolean,
  disableObjectUrl: boolean,
  signal: AbortSignal,
): Promise<DropAsset> {
  const base64 = includeBase64 ? await toBase64(file, signal) : undefined;
  if (signal.aborted) throw signal.reason;
  const uri = disableObjectUrl ? undefined : URL.createObjectURL(file);
  let released = false;
  return {
    uri,
    type: file.type || 'application/octet-stream',
    file,
    fileName: file.name,
    base64,
    release: uri ? () => {
      if (!released) { released = true; URL.revokeObjectURL(uri); }
    } : undefined,
  };
}

/**
 * Web-native drop zone.
 *
 * The published expo-drag-drop-content-view 0.9.2 web bundle contains JSX in a
 * .js file, which Vite 8/Rolldown intentionally parses as JavaScript. Keeping
 * that package native-only avoids a bundler exception while preserving the
 * public payload contract on web.
 */
export function DropZone({
  className,
  active,
  title = 'Drag and drop a file here',
  description = 'Or browse from your device. Images, documents and audio.',
  glyph,
  children,
  onDrop,
  onEnter,
  onExit,
  onDragStart,
  onDragEnd,
  includeBase64 = false,
  disableObjectUrl = false,
  allowedMimeTypes,
  draggableSources,
  style,
  ...rest
}: DropZoneProps) {
  const s = dropZone({ active });
  const dragDepth = useRef(0);
  const pendingDrops = useRef(new Set<AbortController>());
  const feedback = useInstanceStore(() => ({ readFailed: false }));
  const readFailed = useStore(feedback, (state) => state.readFailed);

  useEffect(() => {
    const pending = pendingDrops.current;
    return () => {
      for (const request of pending) request.abort();
      pending.clear();
    };
  }, []);

  return (
    <DropSurface
      className={s.root({ className })}
      style={style as never}
      draggable={Boolean(draggableSources?.length)}
      onDragStart={(event) => {
        onDragStart?.();
        for (const source of draggableSources ?? []) {
          const mime =
            source.type === 'text'
              ? 'text/plain'
              : source.type === 'image'
                ? 'text/uri-list'
                : source.type === 'video'
                  ? 'text/uri-list'
                  : 'text/uri-list';
          event.dataTransfer.setData(mime, source.value);
        }
      }}
      onDragEnd={() => onDragEnd?.()}
      onDragEnter={(event) => {
        event.preventDefault();
        dragDepth.current += 1;
        if (dragDepth.current === 1) onEnter?.();
      }}
      onDragOver={(event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'copy';
      }}
      onDragLeave={(event) => {
        event.preventDefault();
        dragDepth.current = Math.max(0, dragDepth.current - 1);
        if (dragDepth.current === 0) onExit?.();
      }}
      onDrop={async (event) => {
        event.preventDefault();
        dragDepth.current = 0;
        onExit?.();
        if (!onDrop) return;
        feedback.setState({ readFailed: false });

        const files = Array.from(event.dataTransfer.files).filter((file) =>
          accepts(file.type || 'application/octet-stream', allowedMimeTypes),
        );
        // Drag data is only readable during dispatch; snapshot it before await.
        const text = event.dataTransfer.getData('text/plain');
        const request = new AbortController();
        pendingDrops.current.add(request);
        try {
          const prepared = await Promise.allSettled(
            files.map((file) => fileToAsset(file, includeBase64, disableObjectUrl, request.signal)),
          );
          const assets = prepared.flatMap((result) => result.status === 'fulfilled' ? [result.value] : []);
          const failed = prepared.some((result) => result.status === 'rejected');
          if (request.signal.aborted || failed) {
            assets.forEach((asset) => asset.release?.());
            if (!request.signal.aborted) feedback.setState({ readFailed: true });
            return;
          }

          if (assets.length === 0 && text && accepts('text', allowedMimeTypes)) {
            assets.push({ type: 'text', text });
          }
          // Ownership transfers to the consumer only after the whole batch is ready.
          onDrop({ assets });
        } finally {
          pendingDrops.current.delete(request);
        }
      }}
      {...(rest as Omit<React.HTMLAttributes<HTMLDivElement>, 'children'>)}
    >
      {children ?? (
        <>
          <View className={s.well()}>
            {glyph ?? <CloudUpload size={28} className="text-text-muted" />}
          </View>
          <Text className={s.title()}>{title}</Text>
          <Text variant="caption" tone="muted" className={s.description()}>
            {description}
          </Text>
        </>
      )}
      {readFailed ? <Text role="alert" tone="danger">Could not read dropped files. Try again.</Text> : null}
    </DropSurface>
  );
}
