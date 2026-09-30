/**
 * User settings that affect rendering: theme, language, font scale, low-data
 * mode, and the permanent AI-mode banner.
 *
 * Settings are applied to the document element as well as stored, so the CSS
 * and the React tree never disagree.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useTranslation } from 'react-i18next';
import { appApi, profileApi } from '@/lib/endpoints';

type Theme = 'light' | 'dark' | 'system';

interface SettingsState {
  theme: Theme;
  fontScale: number;
  lowDataMode: boolean;
  language: string;
  weeklyStudyHours: number;
  aiMode: string;
  aiNotice: string | null;
  setTheme: (theme: Theme) => void;
  setFontScale: (scale: number) => void;
  setLowDataMode: (enabled: boolean) => void;
  setLanguage: (code: string) => void;
  apply: (patch: Partial<Record<string, unknown>>) => Promise<void>;
}

const SettingsContext = createContext<SettingsState | null>(null);

const STORAGE_KEY = 'skillmap.preferences';

function readStored(): { theme: Theme; fontScale: number; lowDataMode: boolean; language: string } {
  const fallback = { theme: 'system' as Theme, fontScale: 1, lowDataMode: false, language: 'en' };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return fallback;
    return { ...fallback, ...(JSON.parse(raw) as typeof fallback) };
  } catch {
    return fallback;
  }
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const { i18n } = useTranslation();
  const initial = useMemo(readStored, []);
  const [theme, setThemeState] = useState<Theme>(initial.theme);
  const [fontScale, setFontScaleState] = useState(initial.fontScale);
  const [lowDataMode, setLowDataModeState] = useState(initial.lowDataMode);
  const [language, setLanguageState] = useState(initial.language);
  const [weeklyStudyHours, setWeeklyStudyHours] = useState(5);
  const [aiMode, setAiMode] = useState('demo');
  const [aiNotice, setAiNotice] = useState<string | null>(null);

  // Apply to the document so CSS variables and Tailwind dark: agree.
  useEffect(() => {
    const root = document.documentElement;
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const isDark = theme === 'dark' || (theme === 'system' && prefersDark);
    root.classList.toggle('dark', isDark);
    root.style.setProperty('--font-scale', String(fontScale));
    root.classList.toggle('low-data', lowDataMode);
    root.lang = language;
  }, [theme, fontScale, lowDataMode, language]);

  useEffect(() => {
    if (i18n.language !== language) void i18n.changeLanguage(language);
  }, [language, i18n]);

  const persist = useCallback(
    (next: Partial<SettingsState>) => {
      const merged = {
        theme: next.theme ?? theme,
        fontScale: next.fontScale ?? fontScale,
        lowDataMode: next.lowDataMode ?? lowDataMode,
        language: next.language ?? language,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
    },
    [theme, fontScale, lowDataMode, language],
  );

  /**
   * Applies a change locally, mirrors it to localStorage, and saves it to the
   * server so it follows the student to another device.
   *
   * Local state is updated first so the UI responds immediately, and a failed
   * save does not block the interaction: the local copy still holds for this
   * device and the next explicit save will reconcile it.
   */
  const commit = useCallback(
    (patch: Partial<Record<string, unknown>>, localPatch: Partial<SettingsState>) => {
      if (localPatch.theme !== undefined) setThemeState(localPatch.theme);
      if (localPatch.fontScale !== undefined) setFontScaleState(localPatch.fontScale);
      if (localPatch.lowDataMode !== undefined) setLowDataModeState(localPatch.lowDataMode);
      if (localPatch.language !== undefined) setLanguageState(localPatch.language);
      persist(localPatch);
      void profileApi.updatePreferences(patch).catch(() => undefined);
    },
    [persist],
  );

  const setTheme = useCallback((next: Theme) => commit({ theme: next }, { theme: next }), [commit]);

  const setFontScale = useCallback(
    (next: number) => commit({ fontScale: next }, { fontScale: next }),
    [commit],
  );

  const setLowDataMode = useCallback(
    (next: boolean) => commit({ lowDataMode: next }, { lowDataMode: next }),
    [commit],
  );

  const setLanguage = useCallback(
    (next: string) => commit({ language: next }, { language: next }),
    [commit],
  );

  /** Explicit save from the settings page, which reports failure to the user. */
  const apply = useCallback(async (patch: Partial<Record<string, unknown>>) => {
    await profileApi.updatePreferences(patch);
    if (patch['theme']) setThemeState(patch['theme'] as Theme);
    if (typeof patch['fontScale'] === 'number') setFontScaleState(patch['fontScale'] as number);
    if (typeof patch['lowDataMode'] === 'boolean')
      setLowDataModeState(patch['lowDataMode'] as boolean);
    if (typeof patch['language'] === 'string') setLanguageState(patch['language'] as string);
    if (typeof patch['weeklyStudyHours'] === 'number') {
      setWeeklyStudyHours(patch['weeklyStudyHours'] as number);
    }
  }, []);

  // Load the student's saved preferences and the server's AI mode on start.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        // The AI mode is public and always safe to read. The profile is not, so
        // it is only fetched when there is a session to send.
        const hasSession = localStorage.getItem('skillmap.accessToken') !== null;
        const [profile, mode] = await Promise.all([
          hasSession ? profileApi.get() : Promise.resolve(null),
          appApi.aiMode(),
        ]);
        if (cancelled) return;
        if (!profile) return;
        setThemeState(profile.preferences.theme);
        setFontScaleState(profile.preferences.fontScale);
        setLowDataModeState(profile.preferences.lowDataMode);
        setLanguage(profile.preferences.language);
        setWeeklyStudyHours(profile.preferences.weeklyStudyHours);
        setAiMode(mode.mode);
        setAiNotice(mode.notice);
        persist({
          theme: profile.preferences.theme,
          fontScale: profile.preferences.fontScale,
          lowDataMode: profile.preferences.lowDataMode,
          language: profile.preferences.language,
        });
      } catch {
        // Signed out, or the server is unreachable. Local settings still apply.
      }
    })();
    return () => {
      cancelled = true;
    };
    // Intentionally runs once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value = useMemo<SettingsState>(
    () => ({
      theme,
      fontScale,
      lowDataMode,
      language,
      weeklyStudyHours,
      aiMode,
      aiNotice,
      setTheme,
      setFontScale,
      setLowDataMode,
      setLanguage,
      apply,
    }),
    [
      theme,
      fontScale,
      lowDataMode,
      language,
      weeklyStudyHours,
      aiMode,
      aiNotice,
      setTheme,
      setFontScale,
      setLowDataMode,
      setLanguage,
      apply,
    ],
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): SettingsState {
  const context = useContext(SettingsContext);
  if (!context) throw new Error('useSettings must be used inside a SettingsProvider');
  return context;
}
