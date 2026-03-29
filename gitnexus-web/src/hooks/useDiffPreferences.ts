import { useState, useCallback } from 'react';

export interface DiffPreferences {
  viewMode: 'unified' | 'split';
  hideFormatting: boolean;
  collapseThreshold: number; // context lines before collapsing (0 = no collapse)
  groupBySymbol: boolean;
  showAISummary: boolean;
  fileTypeFilters: string[]; // empty = show all
  searchTerm: string;
}

const STORAGE_KEY = 'gitnexus-diff-prefs';

const DEFAULTS: DiffPreferences = {
  viewMode: 'unified',
  hideFormatting: false,
  collapseThreshold: 8,
  groupBySymbol: false,
  showAISummary: true,
  fileTypeFilters: [],
  searchTerm: '',
};

function loadPreferences(): DiffPreferences {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    return DEFAULTS;
  }
}

function savePreferences(prefs: DiffPreferences) {
  try {
    // Don't persist transient state like searchTerm
    const { searchTerm: _, ...persistable } = prefs;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(persistable));
  } catch { /* non-fatal */ }
}

export function useDiffPreferences() {
  const [prefs, setPrefs] = useState<DiffPreferences>(loadPreferences);

  const setPreference = useCallback(<K extends keyof DiffPreferences>(
    key: K,
    value: DiffPreferences[K],
  ) => {
    setPrefs(prev => {
      const next = { ...prev, [key]: value };
      savePreferences(next);
      return next;
    });
  }, []);

  const togglePreference = useCallback((key: keyof DiffPreferences) => {
    setPrefs(prev => {
      const next = { ...prev, [key]: !prev[key] };
      savePreferences(next);
      return next;
    });
  }, []);

  return { prefs, setPreference, togglePreference };
}
