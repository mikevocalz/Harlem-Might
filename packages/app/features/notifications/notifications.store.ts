import { create } from 'zustand';
import {
  UserPlus, Package, MessageCircle, Wallet, Flag, Shield, BarChart3,
} from '@acme/ui/icons';

export interface Notification {
  id: string;
  title: string;
  body: string;
  time: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  tone: 'primary' | 'accent' | 'gold';
  read: boolean;
}

const SEED: Notification[] = [
  { id: '1', title: 'New follower', body: 'Sarah Chen started following you', time: '2m ago', icon: UserPlus, tone: 'primary', read: false },
  { id: '2', title: 'Order shipped', body: 'Your order #1042 is on its way', time: '18m ago', icon: Package, tone: 'accent', read: false },
  { id: '3', title: 'Comment on your post', body: 'alex: "Great work on the UI!"', time: '1h ago', icon: MessageCircle, tone: 'primary', read: false },
  { id: '4', title: 'Payment received', body: '$149.00 · Invoice #1029', time: '3h ago', icon: Wallet, tone: 'gold', read: true },
  { id: '5', title: 'Project milestone', body: 'Mobile app v2 reached 80%', time: 'Yesterday', icon: Flag, tone: 'accent', read: true },
  { id: '6', title: 'Security alert', body: 'New sign-in from Safari on MacBook', time: 'Yesterday', icon: Shield, tone: 'primary', read: true },
  { id: '7', title: 'Weekly digest', body: 'Your stats are up 12% this week', time: '2 days ago', icon: BarChart3, tone: 'gold', read: true },
];

// Notification state — zustand always (repo rule).
export const useNotifications = create<{
  items: Notification[];
  markRead: (id: string) => void;
  markAllRead: () => void;
}>((set) => ({
  items: SEED,
  markRead: (id) => set((s) => ({ items: s.items.map((n) => (n.id === id ? { ...n, read: true } : n)) })),
  markAllRead: () => set((s) => ({ items: s.items.map((n) => ({ ...n, read: true })) })),
}));
