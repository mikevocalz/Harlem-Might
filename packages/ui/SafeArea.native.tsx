'use client';
// className-capable SafeAreaView (third-party component → css shim).
import React from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { css } from './html/css';

export type SafeAreaProps = React.ComponentProps<typeof SafeAreaView> & { className?: string };

export const SafeArea = css(
  SafeAreaView as React.ComponentType<object>,
  'SafeAreaView',
) as React.FC<SafeAreaProps>;
