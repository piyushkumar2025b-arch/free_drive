export interface TagColorDef {
  id: string;
  label: string;
  dotBg: string;
  badgeBg: string;
  badgeBorder: string;
  badgeText: string;
  fullBadge: string;
}

export const TAG_COLORS: Record<string, TagColorDef> = {
  blue: {
    id: 'blue',
    label: 'Blue',
    dotBg: 'bg-blue-500',
    badgeBg: 'bg-blue-50 dark:bg-blue-950/60',
    badgeBorder: 'border-blue-200 dark:border-blue-800/60',
    badgeText: 'text-blue-700 dark:text-blue-300',
    fullBadge: 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border-blue-200 dark:border-blue-800/60',
  },
  emerald: {
    id: 'emerald',
    label: 'Emerald',
    dotBg: 'bg-emerald-500',
    badgeBg: 'bg-emerald-50 dark:bg-emerald-950/60',
    badgeBorder: 'border-emerald-200 dark:border-emerald-800/60',
    badgeText: 'text-emerald-700 dark:text-emerald-300',
    fullBadge: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/60',
  },
  amber: {
    id: 'amber',
    label: 'Amber',
    dotBg: 'bg-amber-500',
    badgeBg: 'bg-amber-50 dark:bg-amber-950/60',
    badgeBorder: 'border-amber-200 dark:border-amber-800/60',
    badgeText: 'text-amber-700 dark:text-amber-300',
    fullBadge: 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200 dark:border-amber-800/60',
  },
  rose: {
    id: 'rose',
    label: 'Rose',
    dotBg: 'bg-rose-500',
    badgeBg: 'bg-rose-50 dark:bg-rose-950/60',
    badgeBorder: 'border-rose-200 dark:border-rose-800/60',
    badgeText: 'text-rose-700 dark:text-rose-300',
    fullBadge: 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border-rose-200 dark:border-rose-800/60',
  },
  purple: {
    id: 'purple',
    label: 'Purple',
    dotBg: 'bg-purple-500',
    badgeBg: 'bg-purple-50 dark:bg-purple-950/60',
    badgeBorder: 'border-purple-200 dark:border-purple-800/60',
    badgeText: 'text-purple-700 dark:text-purple-300',
    fullBadge: 'bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border-purple-200 dark:border-purple-800/60',
  },
  cyan: {
    id: 'cyan',
    label: 'Cyan',
    dotBg: 'bg-cyan-500',
    badgeBg: 'bg-cyan-50 dark:bg-cyan-950/60',
    badgeBorder: 'border-cyan-200 dark:border-cyan-800/60',
    badgeText: 'text-cyan-700 dark:text-cyan-300',
    fullBadge: 'bg-cyan-50 text-cyan-700 dark:bg-cyan-950/60 dark:text-cyan-300 border-cyan-200 dark:border-cyan-800/60',
  },
  indigo: {
    id: 'indigo',
    label: 'Indigo',
    dotBg: 'bg-indigo-500',
    badgeBg: 'bg-indigo-50 dark:bg-indigo-950/60',
    badgeBorder: 'border-indigo-200 dark:border-indigo-800/60',
    badgeText: 'text-indigo-700 dark:text-indigo-300',
    fullBadge: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800/60',
  },
  orange: {
    id: 'orange',
    label: 'Orange',
    dotBg: 'bg-orange-500',
    badgeBg: 'bg-orange-50 dark:bg-orange-950/60',
    badgeBorder: 'border-orange-200 dark:border-orange-800/60',
    badgeText: 'text-orange-700 dark:text-orange-300',
    fullBadge: 'bg-orange-50 text-orange-700 dark:bg-orange-950/60 dark:text-orange-300 border-orange-200 dark:border-orange-800/60',
  },
};

export function getTagColorDef(colorName?: string): TagColorDef {
  if (colorName && TAG_COLORS[colorName]) {
    return TAG_COLORS[colorName];
  }
  return TAG_COLORS.blue;
}
