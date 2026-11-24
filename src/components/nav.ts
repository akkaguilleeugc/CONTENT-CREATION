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
  Sparkles,
  Target,
  type LucideIcon,
} from 'lucide-react';

import { $t } from '@/lib/i18n';
export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  group: 'workspace' | 'growth' | 'brand' | 'system';
  key: string;
}

export const NAV: NavItem[] = [
  { to: '/', label: $t("Overview"), icon: LayoutDashboard, group: 'workspace', key: 'o' },
  { to: '/ai', label: 'KROOPY AI', icon: Sparkles, group: 'workspace', key: 'k' },
  { to: '/ideas', label: $t("My Ideas"), icon: Lightbulb, group: 'workspace', key: 'i' },
  { to: '/studio', label: $t("Content Studio"), icon: Clapperboard, group: 'workspace', key: 's' },
  { to: '/calendar', label: $t("Calendar"), icon: CalendarDays, group: 'workspace', key: 'c' },
  { to: '/tasks', label: $t("Tasks"), icon: ListChecks, group: 'workspace', key: 't' },
  { to: '/trackers', label: $t("Trackers"), icon: Target, group: 'growth', key: 'r' },
  { to: '/analytics', label: $t("Analytics"), icon: BarChart3, group: 'growth', key: 'a' },
  { to: '/brand', label: $t("Brand Kit"), icon: Palette, group: 'brand', key: 'b' },
  { to: '/assets', label: $t("Asset Library"), icon: FolderOpen, group: 'brand', key: 'l' },
  { to: '/settings', label: $t("Settings"), icon: Settings, group: 'system', key: ',' },
];

export const NAV_GROUPS: { id: NavItem['group']; label: string }[] = [
  { id: 'workspace', label: $t("Workspace") },
  { id: 'growth', label: $t("Growth") },
  { id: 'brand', label: $t("Brand") },
];

export const titleFor = (path: string) => {
  if (path.startsWith('/studio/')) return $t('Content Studio');
  const extra: Record<string, string> = { '/account': $t('Account & sync'), '/privacy': $t('Privacy Policy'), '/terms': $t('Terms of Use'), '/cookies': $t('Cookies & storage'), '/support': $t('Support') };
  if (extra[path]) return extra[path]!;
  return NAV.find((n) => n.to === path)?.label ?? 'KROOPY';
};
