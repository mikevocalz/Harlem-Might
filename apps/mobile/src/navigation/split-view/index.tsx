// TypeScript resolution anchor. Platform bundlers select index.ios.tsx,
// index.android.tsx, or index.web.tsx.
//
// Web now has a real adaptive implementation. It uses the same width-class
// policy as native and augments it with Device Posture + Viewport Segments when
// those experimental browser APIs exist.
export * from './index.ios';
