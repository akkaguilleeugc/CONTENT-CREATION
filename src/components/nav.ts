import {
  BarChart3,
  CalendarDays,
  Clapperboard,
  FolderOpen,
  LayoutDashboard,
  Lightbulb,
  ListChecks,
  Palette,
  Settings,
  Target,
  type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  group: 'workspace' | 'growth' | 'brand' | 'system';
  key: string;
}

export const NAV: NavItem[] = [
  { to: '/', label: 'Overview', icon: LayoutDashboard, group: 'workspace', key: 'o' },
  { to: '/ideas', label: 'My Ideas', icon: Lightbulb, group: 'workspace', key: 'i' },
  { to: '/studio', label: 'Content Studio', icon: Clapperboard, group: 'workspace', key: 's' },
  { to: '/calendar', label: 'Calendar', icon: CalendarDays, group: 'workspace', key: 'c' },
  { to: '/tasks', label: 'Tasks', icon: ListChecks, group: 'workspace', key: 't' },
  { to: '/trackers', label: 'Trackers', icon: Target, group: 'growth', key: 'r' },
  { to: '/analytics', label: 'Analytics', icon: BarChart3, group: 'growth', key: 'a' },
  { to: '/brand', label: 'Brand Kit', icon: Palette, group: 'brand', key: 'b' },
  { to: '/assets', label: 'Asset Library', icon: FolderOpen, group: 'brand', key: 'l' },
  { to: '/settings', label: 'Settings', icon: Settings, group: 'system', key: ',' },
];

export const NAV_GROUPS: { id: NavItem['group']; label: string }[] = [
  { id: 'workspace', label: 'Workspace' },
  { id: 'growth', label: 'Growth' },
  { id: 'brand', label: 'Brand' },
];

export const titleFor = (path: string) => {
  if (path.startsWith('/studio/')) return 'Content Studio';
  return NAV.find((n) => n.to === path)?.label ?? 'KROOPY';
};
