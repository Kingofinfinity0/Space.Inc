export const SPACE_THEMES = {
  obsidian: {
    id: 'obsidian',
    name: 'Obsidian',
    accent: '#190019',
    accentHover: '#2B124C',
    accentSoft: '#522B5B',
    accentMuted: '#854F6C',
    accentSurface: '#DFB6B2',
    accentTint: '#FBE4D8',
    onAccent: '#FBE4D8',
  },
  plum: {
    id: 'plum',
    name: 'Plum',
    accent: '#2B124C',
    accentHover: '#522B5B',
    accentSoft: '#854F6C',
    accentMuted: '#DFB6B2',
    accentSurface: '#FBE4D8',
    accentTint: '#F7EAEC',
    onAccent: '#FBE4D8',
  },
  rosewood: {
    id: 'rosewood',
    name: 'Rosewood',
    accent: '#522B5B',
    accentHover: '#854F6C',
    accentSoft: '#DFB6B2',
    accentMuted: '#2B124C',
    accentSurface: '#FBE4D8',
    accentTint: '#FBF0EF',
    onAccent: '#FBE4D8',
  },
  mauve: {
    id: 'mauve',
    name: 'Mauve',
    accent: '#854F6C',
    accentHover: '#522B5B',
    accentSoft: '#DFB6B2',
    accentMuted: '#2B124C',
    accentSurface: '#FBE4D8',
    accentTint: '#FCF1F2',
    onAccent: '#FBE4D8',
  },
  blush: {
    id: 'blush',
    name: 'Blush',
    accent: '#DFB6B2',
    accentHover: '#854F6C',
    accentSoft: '#FBE4D8',
    accentMuted: '#522B5B',
    accentSurface: '#FFF5F2',
    accentTint: '#FFF8F6',
    onAccent: '#190019',
  },
  porcelain: {
    id: 'porcelain',
    name: 'Porcelain',
    accent: '#FBE4D8',
    accentHover: '#DFB6B2',
    accentSoft: '#FFF3EC',
    accentMuted: '#854F6C',
    accentSurface: '#FFFFFF',
    accentTint: '#FFF9F6',
    onAccent: '#190019',
  },
} as const;

export type SpaceThemeId = keyof typeof SPACE_THEMES;

export const DEFAULT_SPACE_THEME: SpaceThemeId = 'obsidian';
export const SPACE_THEME_STORAGE_KEY = 'space.inc.theme';

export const applySpaceTheme = (themeId: string) => {
  const theme = SPACE_THEMES[(themeId as SpaceThemeId)] || SPACE_THEMES[DEFAULT_SPACE_THEME];
  const root = document.documentElement;

  root.style.setProperty('--theme-accent', theme.accent);
  root.style.setProperty('--theme-accent-hover', theme.accentHover);
  root.style.setProperty('--theme-accent-soft', theme.accentSoft);
  root.style.setProperty('--theme-accent-muted', theme.accentMuted);
  root.style.setProperty('--theme-accent-surface', theme.accentSurface);
  root.style.setProperty('--theme-accent-tint', theme.accentTint);
  root.style.setProperty('--theme-on-accent', theme.onAccent);
  root.setAttribute('data-space-theme', theme.id);
};

export const getStoredSpaceTheme = (): SpaceThemeId => {
  if (typeof window === 'undefined') return DEFAULT_SPACE_THEME;
  const storedTheme = window.localStorage.getItem(SPACE_THEME_STORAGE_KEY) as SpaceThemeId | null;
  return storedTheme && SPACE_THEMES[storedTheme] ? storedTheme : DEFAULT_SPACE_THEME;
};

export const initializeSpaceTheme = () => {
  if (typeof window === 'undefined') return DEFAULT_SPACE_THEME;
  const themeId = getStoredSpaceTheme();
  applySpaceTheme(themeId);
  return themeId;
};

export const persistSpaceTheme = (themeId: SpaceThemeId) => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(SPACE_THEME_STORAGE_KEY, themeId);
  applySpaceTheme(themeId);
};
