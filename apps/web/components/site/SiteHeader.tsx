'use client';

import Image from 'next/image';
import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { Link } from 'solito/link';
import { usePathname } from 'solito/navigation';
import { create } from 'zustand';
import { Avatar } from '@acme/ui';
import { Header, Nav, Pressable, View, Text as TWText } from '@acme/ui/tw';
import { useBrowserReducedMotion } from 'kinetrell/web/react';
import { AVATAR_URI, useProfile } from '@acme/app';
import { NAV_ITEMS, PROFILE, useMobileMenu } from './nav';

const isActive = (pathname: string, href: string) =>
  href === '/' ? pathname === '/' : pathname.startsWith(href);

const useScrolled = create<{ scrolled: boolean; set: (scrolled: boolean) => void }>((set) => ({
  scrolled: false,
  set: (scrolled) => set({ scrolled }),
}));

export function SiteHeader() {
  const pathname = usePathname() ?? '/';
  const { open, toggle, close } = useMobileMenu();
  const scrolled = useScrolled((state) => state.scrolled);
  const name = useProfile((state) => state.name);
  const profileActive = isActive(pathname, PROFILE.href);
  const reducedMotion = useBrowserReducedMotion('system');
  const innerRef = useRef<HTMLElement | null>(null);
  const mobileRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const onScroll = () => useScrolled.getState().set(window.scrollY > 10);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const inner = innerRef.current;
    if (!inner || reducedMotion) return;

    const context = gsap.context(() => {
      gsap.fromTo(
        inner,
        { y: -18, autoAlpha: 0 },
        {
          y: 0,
          autoAlpha: 1,
          duration: 0.56,
          ease: 'power3.out',
          clearProps: 'transform,opacity,visibility',
        },
      );
    }, inner);

    return () => context.revert();
  }, [reducedMotion]);

  useEffect(() => {
    const mobile = mobileRef.current;
    if (!open || !mobile || reducedMotion) return;

    gsap.fromTo(
      mobile,
      { y: -12, autoAlpha: 0 },
      { y: 0, autoAlpha: 1, duration: 0.28, ease: 'power2.out' },
    );
  }, [open, reducedMotion]);

  return (
    <Header
      className={`sticky top-0 z-50 border-b backdrop-blur-xl transition-colors duration-300 ${
        scrolled
          ? 'border-border bg-surface/95 shadow-card'
          : 'border-border/70 bg-surface/82'
      }`}
    >
      <View
        ref={innerRef as never}
        className="mx-auto w-full max-w-screen-2xl flex-row items-center justify-between gap-4 px-4 py-3 sm:px-6"
      >
        <Link
          href="/"
          onClick={close}
          aria-label="Harlem Might home"
          className="flex min-w-0 items-center gap-3 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus/40"
        >
          <View className="h-11 w-11 shrink-0 overflow-hidden rounded-xl border border-border bg-surface-raised shadow-card">
            <Image
              src="/icon.png"
              alt=""
              width={44}
              height={44}
              priority
              className="h-full w-full object-cover"
            />
          </View>
          <View className="min-w-0">
            <TWText className="truncate font-display text-base font-bold tracking-[-0.025em] text-text sm:text-lg">
              Harlem Might
            </TWText>
            <TWText className="hidden text-[11px] font-medium tracking-wide text-text-muted sm:block">
              Harlem, mapped with context
            </TWText>
          </View>
        </Link>

        <View className="flex-row items-center gap-3">
          <Nav aria-label="Primary" className="hidden flex-row items-center gap-1 md:flex">
            {NAV_ITEMS.map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  className={`rounded-lg px-3.5 py-2 text-sm font-medium transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus/40 ${
                    active
                      ? 'bg-primary/10 font-semibold text-primary'
                      : 'text-text-muted hover:bg-surface-sunken hover:text-text'
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </Nav>

          <Link
            href={PROFILE.href}
            aria-label="Your profile and settings"
            aria-current={profileActive ? 'page' : undefined}
            className={`rounded-full transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus/40 ${
              profileActive ? 'ring-2 ring-primary ring-offset-2 ring-offset-surface' : ''
            }`}
          >
            <Avatar name={name} imageUri={AVATAR_URI} size="md" />
          </Link>

          <Pressable
            role="button"
            aria-label={open ? 'Close menu' : 'Open menu'}
            aria-expanded={open}
            aria-controls="mobile-menu"
            onPress={toggle}
            className="h-10 w-10 items-center justify-center rounded-lg border border-border bg-surface-raised active:opacity-75 md:hidden"
          >
            <TWText className="text-xl leading-none text-text">{open ? '✕' : '☰'}</TWText>
          </Pressable>
        </View>
      </View>

      {open ? (
        <View
          ref={mobileRef as never}
          id="mobile-menu"
          className="absolute inset-x-0 top-full border-b border-border bg-surface/98 px-4 pb-5 pt-2 shadow-overlay backdrop-blur-xl md:hidden"
        >
          <Nav aria-label="Mobile primary" className="mx-auto w-full max-w-screen-2xl gap-1">
            {NAV_ITEMS.map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={close}
                  aria-current={active ? 'page' : undefined}
                  className={`rounded-xl px-4 py-3.5 text-base font-medium ${
                    active ? 'bg-primary/10 text-primary' : 'text-text hover:bg-surface-sunken'
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </Nav>
        </View>
      ) : null}
    </Header>
  );
}
