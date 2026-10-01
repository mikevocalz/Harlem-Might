// TypeScript resolution anchor: bundlers never load this file —
// Metro resolves screen.native.tsx, web bundlers resolve screen.web.tsx.
// Keep it a re-export so types stay single-source.
export { HomeScreen } from './screen.web';
