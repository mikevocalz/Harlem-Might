'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'expo-router';
import { Directory, File, Paths } from 'expo-file-system';
import { Image } from 'expo-image';
import { PdfView } from '@kishannareshpal/expo-pdf';
import {
  SecureWebView,
  type SecureWebViewRef,
} from 'react-native-secure-webview';
import {
  ChevronLeft,
  ChevronRight,
  RotateCw,
  ShieldAlert,
  X,
} from 'lucide-react-native';
import { SafeArea } from '@acme/ui';
import { Pressable, ScrollView, Text, View } from '@acme/ui/tw';
import { useWindowDimensions } from 'react-native';
import {
  menuImageUrls,
  menuPdfUrl,
  webMenuOrigins,
  type MenuRecord,
  type PlaceWithMenus,
} from './types';
import { useMenuViewerStore } from './store';

export function MenuContent({
  place,
  menu,
}: {
  place: PlaceWithMenus;
  menu: MenuRecord;
}) {
  const router = useRouter();
  const webView = useRef<SecureWebViewRef>(null);
  const { width } = useWindowDimensions();

  const canGoBack = useMenuViewerStore((state) => state.canGoBack);
  const canGoForward = useMenuViewerStore((state) => state.canGoForward);
  const currentUrl = useMenuViewerStore((state) => state.currentUrl);
  const loadingWeb = useMenuViewerStore((state) => state.loadingWeb);
  const securityMessage = useMenuViewerStore((state) => state.securityMessage);
  const setNavigation = useMenuViewerStore((state) => state.setNavigation);
  const setSecurityMessage = useMenuViewerStore((state) => state.setSecurityMessage);
  const pdfUri = useMenuViewerStore((state) => state.pdfUri);
  const pdfLoading = useMenuViewerStore((state) => state.pdfLoading);
  const pdfError = useMenuViewerStore((state) => state.pdfError);
  const pdfPage = useMenuViewerStore((state) => state.pdfPage);
  const pdfPageCount = useMenuViewerStore((state) => state.pdfPageCount);
  const setPdfLoading = useMenuViewerStore((state) => state.setPdfLoading);
  const setPdfUri = useMenuViewerStore((state) => state.setPdfUri);
  const setPdfError = useMenuViewerStore((state) => state.setPdfError);
  const setPdfPage = useMenuViewerStore((state) => state.setPdfPage);

  const pdfSource = menu.format === 'pdf' ? menuPdfUrl(menu) : null;

  useEffect(() => {
    if (!pdfSource) return;

    let active = true;
    const download = async () => {
      setPdfLoading(true);
      setPdfError(null);

      try {
        const directory = new Directory(Paths.cache, 'harlem-mights-menus');
        directory.create({ idempotent: true, intermediates: true });
        const destination = new File(
          directory,
          `menu-${String(place.id)}-${menu.id}.pdf`,
        );
        const file = await File.downloadFileAsync(pdfSource, destination, {
          idempotent: true,
        });
        if (active) setPdfUri(file.uri);
      } catch (error) {
        if (active) {
          setPdfError(
            error instanceof Error ? error.message : 'Could not download this PDF.',
          );
        }
      }
    };

    void download();
    return () => {
      active = false;
    };
  }, [
    menu.id,
    pdfSource,
    place.id,
    setPdfError,
    setPdfLoading,
    setPdfUri,
  ]);

  const host = (() => {
    try {
      return currentUrl ? new URL(currentUrl).host : place.name;
    } catch {
      return place.name;
    }
  })();

  const images = menu.format === 'image_gallery' ? menuImageUrls(menu) : [];
  const pageWidth = Math.max(280, width);

  return (
    <SafeArea edges={['top', 'bottom']} className="flex-1 bg-surface">
      <View className="flex-row items-center gap-2 border-b border-border bg-surface-raised px-2 py-2">
        <Pressable
          onPress={() => router.back()}
          aria-label="Close menu viewer"
          className="h-11 w-11 items-center justify-center rounded-full active:bg-surface-sunken"
        >
          <X size={22} color="currentColor" />
        </Pressable>

        <View className="min-w-0 flex-1">
          <Text className="truncate text-sm font-semibold text-text">{menu.label}</Text>
          <Text className="truncate text-xs text-text-muted">{host}</Text>
        </View>

        {menu.format === 'web' ? (
          <View className="flex-row items-center gap-1">
            <Pressable
              onPress={() => webView.current?.goBack()}
              disabled={!canGoBack}
              aria-label="Go back"
              className="h-10 w-10 items-center justify-center rounded-full active:bg-surface-sunken disabled:opacity-30"
            >
              <ChevronLeft size={20} color="currentColor" />
            </Pressable>
            <Pressable
              onPress={() => webView.current?.goForward()}
              disabled={!canGoForward}
              aria-label="Go forward"
              className="h-10 w-10 items-center justify-center rounded-full active:bg-surface-sunken disabled:opacity-30"
            >
              <ChevronRight size={20} color="currentColor" />
            </Pressable>
            <Pressable
              onPress={() => webView.current?.reload()}
              aria-label="Reload"
              className="h-10 w-10 items-center justify-center rounded-full active:bg-surface-sunken"
            >
              <RotateCw size={17} color="currentColor" />
            </Pressable>
          </View>
        ) : null}
      </View>

      {securityMessage ? (
        <View className="flex-row items-start gap-2 border-b border-border bg-surface-sunken px-4 py-3">
          <ShieldAlert size={18} color="currentColor" />
          <Text className="flex-1 text-xs leading-5 text-text-muted">
            {securityMessage}
          </Text>
        </View>
      ) : null}

      {menu.format === 'web' && menu.url ? (
        <View className="relative flex-1 bg-surface-raised">
          <SecureWebView
            ref={webView}
            style={{ flex: 1 }}
            source={{ uri: menu.url }}
            allowedOrigins={webMenuOrigins(menu)}
            session="persistent"
            onNavigation={(event) =>
              setNavigation({
                canGoBack: event.canGoBack,
                canGoForward: event.canGoForward,
                url: event.url,
                loading: event.loading,
              })
            }
            onSecurityViolation={(event) =>
              setSecurityMessage(
                `Blocked a navigation outside this menu's approved origins (${event.type}).`,
              )
            }
            onError={(event) =>
              setSecurityMessage(
                event.message || 'The restaurant menu page could not be loaded.',
              )
            }
          />
          {loadingWeb ? (
            <View pointerEvents="none" className="absolute left-0 right-0 top-0 h-0.5 bg-primary" />
          ) : null}
        </View>
      ) : null}

      {menu.format === 'pdf' ? (
        <View className="flex-1 bg-surface-sunken">
          {pdfUri ? (
            <>
              <PdfView
                style={{ flex: 1 }}
                uri={pdfUri}
                fitMode="width"
                autoScale
                doubleTapToZoom
                onLoadComplete={({ pageCount }) => setPdfPage(1, pageCount)}
                onPageChanged={({ pageIndex, pageCount }) =>
                  setPdfPage(pageIndex + 1, pageCount)
                }
                onError={(event) => setPdfError(event.message)}
              />
              <View className="border-t border-border bg-surface-raised px-4 py-2">
                <Text className="text-center text-xs tabular-nums text-text-muted">
                  {pdfPageCount ? `Page ${pdfPage} of ${pdfPageCount}` : 'PDF menu'}
                </Text>
              </View>
            </>
          ) : (
            <View className="flex-1 items-center justify-center gap-2 px-6">
              <Text className="text-sm font-semibold text-text">
                {pdfError ? 'Could not open this PDF' : 'Preparing PDF menu…'}
              </Text>
              <Text className="max-w-md text-center text-xs leading-5 text-text-muted">
                {pdfError ?? (pdfLoading ? 'Downloading a temporary in-app copy.' : 'Starting download…')}
              </Text>
            </View>
          )}
        </View>
      ) : null}

      {menu.format === 'image_gallery' ? (
        images.length ? (
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            className="flex-1 bg-surface-sunken"
          >
            {images.map((uri, index) => (
              <View
                key={uri}
                className="flex-1 items-center justify-center bg-surface-sunken"
                style={{ width: pageWidth }}
              >
                <Image
                  source={{ uri }}
                  contentFit="contain"
                  accessibilityLabel={`${menu.label} menu page ${index + 1} of ${images.length}`}
                  style={{ width: pageWidth, height: '100%' }}
                />
              </View>
            ))}
          </ScrollView>
        ) : (
          <View className="flex-1 items-center justify-center px-6">
            <Text className="text-sm text-text-muted">No menu images are attached yet.</Text>
          </View>
        )
      ) : null}
    </SafeArea>
  );
}
