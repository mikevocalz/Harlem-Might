'use client';
/**
 * §7 semantic primitives over Expo HTML Elements — packages/ui/primitives.
 * Real semantic HTML on web; RN primitives with correct accessibility roles
 * on native. Pure props→view (the css() shim is the one styling boundary).
 *
 * Internal navigation uses solito/link in screens — the Link here is the
 * semantic anchor primitive (external/document links).
 */
import '../rn-globals-shim';
import React from 'react';
import {
  Div, Main as EMain, Header as EHeader, Footer as EFooter, Nav as ENav,
  Section as ESection, Article as EArticle, Aside as EAside,
  H1, H2, H3, H4, H5, H6, P as EP, Span, Time as ETime, A,
  UL, LI, Table as ETable, THead, TBody, TR, TD, TH,
} from '@expo/html-elements';
import type { Role } from 'react-native';
import { css, type CN } from './css';
import {
  FigcaptionBase, AddressBase, DetailsBase, SummaryBase,
  FieldsetBase, LegendBase, SelectBase,
  ButtonBase, InputBase, TextareaBase, LabelBase, FormBase,
} from './dom';

// ---- layout -------------------------------------------------------------

export const Page = css(
  (props: React.ComponentProps<typeof Div>) => <Div {...props} />,
  'Page',
);
export const Main = css(EMain, 'Main');
export const Header = css(EHeader, 'Header');
export const Footer = css(EFooter, 'Footer');
export const Nav = css(ENav, 'Nav');
export const Section = css(ESection, 'Section');
export const Article = css(EArticle, 'Article');
export const Aside = css(EAside, 'Aside');

// figure = Div with the figure role; figcaption needs the fork
export const Figure = css(
  (props: React.ComponentProps<typeof Div>) => (
    <Div role={'figure' as Role} {...props} />
  ),
  'Figure',
);
export const Figcaption = css(FigcaptionBase, 'Figcaption');
export const Address = css(AddressBase, 'Address');
export const Details = css(DetailsBase, 'Details');
export const Summary = css(SummaryBase, 'Summary');

// ---- content ------------------------------------------------------------

const HEADINGS = {
  1: css(H1, 'H1'), 2: css(H2, 'H2'), 3: css(H3, 'H3'),
  4: css(H4, 'H4'), 5: css(H5, 'H5'), 6: css(H6, 'H6'),
} as const;
export type HeadingProps = React.ComponentProps<typeof H1> & CN & {
  level?: 1 | 2 | 3 | 4 | 5 | 6;
};
export function Heading({ level = 1, ...props }: HeadingProps) {
  const Tag = HEADINGS[level];
  return <Tag {...props} />;
}

// RNW maps role="paragraph" to a real <p>; RN's Role type lags behind, hence the cast.
export const Paragraph = css(
  (props: React.ComponentProps<typeof EP>) => <EP role={'paragraph' as Role} {...props} />,
  'Paragraph',
);
export const Text = css(Span, 'Text');
export const Time = css(ETime, 'Time');

// ---- lists ----------------------------------------------------------------

export const List = css(UL, 'List');
export const ListItem = css(LI, 'ListItem');

// ---- interactive / forms ---------------------------------------------------

// A real <button> on web; Pressable with role="button" on native (dom fork).
export const Button = css(ButtonBase, 'Button');
export const Link = css(A, 'Link');
export const Form = css(FormBase, 'Form');
export const Fieldset = css(FieldsetBase, 'Fieldset');
export const Legend = css(LegendBase, 'Legend');
// A real <label> on web (dom fork).
export const Label = css(LabelBase, 'Label');
// A real <input> on web; single-line TextInput on native (dom fork).
export const Input = css(InputBase, 'Input');
// A real <textarea> on web; multiline TextInput on native (dom fork).
export const Textarea = css(TextareaBase, 'Textarea');
export const Select = css(SelectBase, 'Select');

// ---- table -----------------------------------------------------------------

export const Table = css(ETable, 'Table');
export const TableHeader = css(THead, 'TableHeader');
export const TableBody = css(TBody, 'TableBody');
export const TableRow = css(TR, 'TableRow');
export const TableCell = css(TD, 'TableCell');
export const TableHeaderCell = css(TH, 'TableHeaderCell');
