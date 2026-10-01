'use client';
/**
 * Uniwind element wrappers (docs.uniwind.dev/api/with-uniwind). The ONLY place
 * the styling boundary is crossed for the generic elements — components and
 * screens import from here (or from the primitives that compose these).
 *
 * Every generic wrapper is backed by @expo/html-elements — real semantic HTML
 * on web, native views with correct accessibility roles on native. Interactive
 * controls (Pressable, TextInput) come from the primitives dom fork: real
 * <button>/<input> elements on web, the platform's Pressable/TextInput on
 * native. The ONLY react-native value import left is ScrollView (behavioral,
 * no HTML counterpart — renders an overflow <div> on web).
 *
 * Wrappers go through the forked css() shim rather than calling the styling
 * library directly: on native that is Uniwind's withUniwind HOC, on web it is
 * still react-native-css (Uniwind does not support Next.js). Keeping the call
 * shape identical is what lets one file serve both.
 */
import './rn-globals-shim';
import React from 'react';
import type { Role } from 'react-native';
import { ScrollView as RNScrollView } from 'react-native';
import { css, type CN } from './html/css';
import { ButtonBase, InputBase } from './html/dom';
import {
  Div as EDiv,
  Span as ESpan,
  Main as EMain,
  Section as ESection,
  Article as EArticle,
  Nav as ENav,
  Header as EHeader,
  Footer as EFooter,
  H1 as EH1,
  H2 as EH2,
  H3 as EH3,
  P as EP,
} from '@expo/html-elements';

/**
 * RNW's text defaults to black regardless of theme — the token default makes
 * every text node adapt; explicit text-* classes still override (they come
 * later in the class list).
 */
function withBodyText<P extends object>(Component: React.FC<P & CN>, displayName: string) {
  const Wrapped = ({ className, ...props }: P & CN) => (
    <Component className={`text-body-default ${className ?? ''}`} {...(props as P)} />
  );
  Wrapped.displayName = displayName;
  return Wrapped;
}

// ---- generic containers (html-elements backed) ------------------------------

// <div> on web, View on native.
export const View = css(EDiv, 'View');

// <span> on web, Text on native.
export const Text = withBodyText(css(ESpan, 'Text'), 'CSS(Text)');

// Real <button> on web; the platform's Pressable (role="button") on native.
export const Pressable = css(ButtonBase, 'Pressable');

// Real <input> on web; the platform's TextInput on native.
export const TextInput = css(InputBase, 'TextInput');

// Behavioral, not semantic — RNW renders an overflow <div>.
export const ScrollView = css(RNScrollView, 'ScrollView', {
  contentContainerClassName: 'contentContainerStyle',
}) as React.FC<
  React.ComponentProps<typeof RNScrollView> & CN & { contentContainerClassName?: string }
>;

// ---- semantic landmarks (@expo/html-elements) --------------------------------
// Real HTML landmarks on web, correct accessibility roles on native.

export const Main = css(EMain, 'Main');
export const Section = css(ESection, 'Section');
export const Article = css(EArticle, 'Article');
export const Nav = css(ENav, 'Nav');
export const Header = css(EHeader, 'Header');
export const Footer = css(EFooter, 'Footer');

export const H1 = withBodyText(css(EH1, 'H1'), 'CSS(H1)');
export const H2 = withBodyText(css(EH2, 'H2'), 'CSS(H2)');
export const H3 = withBodyText(css(EH3, 'H3'), 'CSS(H3)');

// RNW maps role="paragraph" to a real <p>; RN's Role type lags behind, hence the cast.
const PWithRole = (props: React.ComponentProps<typeof EP>) => (
  <EP role={'paragraph' as Role} {...props} />
);
export const P = withBodyText(css(PWithRole, 'P'), 'CSS(P)');
