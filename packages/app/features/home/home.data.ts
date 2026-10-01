// Dashboard demo data — generic, replace with real queries.
import {
  TrendingUp, Users, ShoppingCart, BarChart3,
  LineChart, MessageCircle, Calendar, CheckSquare,
} from '@acme/ui/icons';
export const STATS = [
  { label: 'Revenue', value: '$24.8k', change: '+12%', up: true, icon: TrendingUp, tone: 'primary' },
  { label: 'Users', value: '1,284', change: '+8%', up: true, icon: Users, tone: 'accent' },
  { label: 'Orders', value: '342', change: '-3%', up: false, icon: ShoppingCart, tone: 'gold' },
  { label: 'Growth', value: '18.2%', change: '+2%', up: true, icon: BarChart3, tone: 'primary' },
] as const;

export const QUICK_ACTIONS = [
  { label: 'Analytics', icon: LineChart, tone: 'primary' },
  { label: 'Messages', icon: MessageCircle, tone: 'accent' },
  { label: 'Calendar', icon: Calendar, tone: 'gold' },
  { label: 'Tasks', icon: CheckSquare, tone: 'primary' },
] as const;

export const PROJECTS = [
  { name: 'Mobile app v2', progress: 82, tone: 'primary', members: 4 },
  { name: 'Design system', progress: 61, tone: 'accent', members: 3 },
  { name: 'Marketing site', progress: 95, tone: 'gold', members: 2 },
] as const;

export type Tone = 'primary' | 'accent' | 'gold';
export const WELL: Record<Tone, string> = {
  primary: 'bg-primary/10',
  accent: 'bg-accent/10',
  gold: 'bg-gold-400/15',
};
export const INK: Record<Tone, string> = {
  primary: 'text-primary',
  accent: 'text-accent',
  gold: 'text-gold-600',
};
export const BAR: Record<Tone, string> = {
  primary: 'bg-primary',
  accent: 'bg-accent',
  gold: 'bg-gold-500',
};
