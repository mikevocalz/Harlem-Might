'use client';
/**
 * PLATFORM FORK — on web the kit's press feedback lives in CSS
 * (active:scale / hover: classes on the real <button>), so PressScale is
 * just the button base; outerClassName is a native-only concept.
 */
import { Button as PrimitiveButton } from './primitives';

export interface PressScaleProps extends React.ComponentProps<typeof PrimitiveButton> {
  /** Native-only: classes for the outer pressable (alignment/sizing). */
  outerClassName?: string;
}

export function PressScale({ outerClassName: _o, ...props }: PressScaleProps) {
  return <PrimitiveButton {...props} />;
}
