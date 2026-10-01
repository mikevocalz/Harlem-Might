import { create } from 'zustand';
import {
  LayoutGrid, Palette, Code, Briefcase, Brush,
  Smartphone, LineChart, Star, Box, Navigation,
  Moon, ShieldCheck, Layers, ArrowRight,
} from '@acme/ui/icons';

export const CATEGORIES = [
  { label: 'All', icon: LayoutGrid },
  { label: 'Design', icon: Palette },
  { label: 'Dev', icon: Code },
  { label: 'Business', icon: Briefcase },
  { label: 'Art', icon: Brush },
] as const;

export const FEATURED = [
  { title: 'Mobile UI Kit', subtitle: '120+ components', icon: Smartphone, bg: 'bg-primary' },
  { title: 'Dashboard Pro', subtitle: 'Admin templates', icon: LineChart, bg: 'bg-burgundy-500' },
  { title: 'Brand Kit', subtitle: 'Logos & assets', icon: Star, bg: 'bg-accent' },
] as const;

export const CARDS = [
  { title: 'Universal Starter', tag: 'Template', icon: Box, tone: 'primary', likes: 284, views: '1.2k', category: 'Dev' },
  { title: 'Native Navigation', tag: 'Component', icon: Navigation, tone: 'accent', likes: 97, views: '640', category: 'Dev' },
  { title: 'Dark UI System', tag: 'Design', icon: Moon, tone: 'primary', likes: 431, views: '3.1k', category: 'Design' },
  { title: 'Auth Flow Kit', tag: 'Template', icon: ShieldCheck, tone: 'gold', likes: 156, views: '890', category: 'Business' },
  { title: 'Card Components', tag: 'UI Kit', icon: Layers, tone: 'accent', likes: 208, views: '1.4k', category: 'Design' },
  { title: 'Onboarding Flow', tag: 'Template', icon: ArrowRight, tone: 'primary', likes: 312, views: '2.2k', category: 'Art' },
] as const;

// Search + filter state — zustand always (repo rule).
export const useExplore = create<{
  query: string;
  category: string;
  setQuery: (query: string) => void;
  setCategory: (category: string) => void;
}>((set) => ({
  query: '',
  category: 'All',
  setQuery: (query) => set({ query }),
  setCategory: (category) => set({ category }),
}));
