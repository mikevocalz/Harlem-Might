import { forwardRef, type ComponentRef } from 'react';
import type { StyleProp, View, ViewStyle } from 'react-native';
import { motion, MotionView, MotionText, FadeIn, ScaleIn, SlideUp } from '../motion';

type CardProps = {
  label: string;
  tone?: 'quiet' | 'loud';
  style?: StyleProp<ViewStyle>;
  onSelect?: (label: string) => void;
};
const Card = (_props: CardProps) => null;
const MotionCard = motion(Card);
const ExplicitMotionCard = motion<CardProps>(Card, 'Card');
const ForwardCard = forwardRef<ComponentRef<typeof View>, CardProps>(function ForwardCard(_props, _ref) { return null; });
const MotionForwardCard = motion(ForwardCard);

export const card = <MotionCard label="Apollo" tone="quiet" className="p-4"
  style={[{ padding: 4 }, false, { opacity: 0.9 }]}
  initial={{ y: 12 }} animate={{ y: 0 }} exit={{ opacity: 0 }}
  whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
  transition={{ type: 'spring', damping: 18 }}
  transformOrigin={{ x: '50%', y: 0 }}
  onAnimationComplete={key => { const name: string = key; void name; }}
  onSelect={label => { const name: string = label; void name; }} />;
export const explicitCard = <ExplicitMotionCard label="Apollo" animate={{ opacity: 1 }} />;
export const forwardCard = <MotionForwardCard label="Apollo" ref={view => { view?.measure(() => {}); }} />;
export const perValueTransitions = <MotionCard label="Apollo" animate={{ opacity: 1, x: 0 }}
  transition={{ opacity: { type: 'timing', duration: 200 }, x: { type: 'spring' } }} />;
export const animatedProps = <MotionCard label="Apollo" initialProps={{ label: 'Initial' }}
  animateProps={{ label: 'Final' }} transition={{ label: { type: 'timing', duration: 100 } }} />;

// @ts-expect-error Required custom props must survive both wrappers.
export const missingLabel = <MotionCard />;
// @ts-expect-error Explicit generic arguments must preserve required props too.
export const missingExplicitLabel = <ExplicitMotionCard className="p-4" />;
// @ts-expect-error The required prop is still a string.
export const invalidLabel = <MotionCard label={42} />;
// @ts-expect-error Custom unions must not be widened.
export const invalidTone = <MotionCard label="Apollo" tone="other" />;
// @ts-expect-error Unknown props do not become valid through motion or css.
export const unknownProp = <MotionCard label="Apollo" missingProp />;
// @ts-expect-error className is the styling shim's string prop.
export const invalidClass = <MotionCard label="Apollo" className={12} />;
// @ts-expect-error Callback parameters keep the wrapped component's type.
export const invalidCallback = <MotionCard label="Apollo" onSelect={(_value: number) => {}} />;
// @ts-expect-error Legend's non-generic initial style validates known transform values.
export const invalidInitial = <MotionCard label="Apollo" initial={{ y: 'up' }} />;
// @ts-expect-error Transform origins preserve Legend's number / percent / pixel contract.
export const invalidOrigin = <MotionCard label="Apollo" transformOrigin={{ x: 'middle' }} />;
// @ts-expect-error Animation completion receives the animated key, not a number.
export const invalidComplete = <MotionCard label="Apollo" onAnimationComplete={(_key: number) => {}} />;
// @ts-expect-error Forwarded refs must remain refs to the wrapped native view.
export const invalidRef = <MotionForwardCard label="Apollo" ref={(_value: HTMLDivElement | null) => {}} />;

// A required style and className must not become optional when the shim adds its props.
const RequiredStyle = (_props: { style: StyleProp<ViewStyle>; className: 'panel' }) => null;
const MotionRequiredStyle = motion(RequiredStyle);
export const requiredStyle = <MotionRequiredStyle style={{ padding: 4 }} className="panel" />;
// @ts-expect-error A required style remains required.
export const missingStyle = <MotionRequiredStyle className="panel" />;
// @ts-expect-error A required className remains required.
export const missingClass = <MotionRequiredStyle style={{ padding: 4 }} />;
// @ts-expect-error Interop must not widen the original className values.
export const widenedClass = <MotionRequiredStyle style={{ padding: 4 }} className="other" />;
// @ts-expect-error Native style values remain typed.
export const invalidStyle = <MotionCard label="Apollo" style={{ opacity: 'visible' }} />;
// @ts-expect-error Initial non-style props preserve the original prop types.
export const invalidInitialProps = <MotionCard label="Apollo" initialProps={{ label: 12 }} />;

// Existing preset/primitive consumers keep their animation, style and a11y props.
export const pane = <MotionView animate={{ width: 300 }} style={{ flexGrow: 1 }}
  className="overflow-hidden" transition={{ type: 'timing', duration: 0 }} />;
export const text = <MotionText className="text-primary" initial={{ opacity: 0 }}
  animate={{ opacity: 1 }} numberOfLines={1}>Harlem</MotionText>;
export const emptyState = <FadeIn className="p-10"><ScaleIn aria-hidden delay={80}>Icon</ScaleIn></FadeIn>;
export const toast = <SlideUp role="status" delay={50}>Saved</SlideUp>;
