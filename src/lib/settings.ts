import { getDb } from './database';
import path from 'path';

export interface SettingDefaults {
  ORIGINALS_DIR: string;
  TRANSLATIONS_DIR: string;
  OPENROUTER_API_KEY: string;
  LANG: string;
  AUTHOR: string;
}

function parseLangAuthorFromDir(dir: string): { lang: string; author: string } {
  const basename = path.basename(dir);
  const underscoreIndex = basename.indexOf('_');
  if (underscoreIndex > 0 && underscoreIndex < basename.length - 1) {
    return {
      lang: basename.slice(0, underscoreIndex),
      author: basename.slice(underscoreIndex + 1),
    };
  }
  return { lang: '', author: '' };
}

const DEFAULTS: SettingDefaults = (() => {
  const translationsDir = import.meta.env.TRANSLATIONS_DIR || '';
  const { lang, author } = parseLangAuthorFromDir(translationsDir);
  return {
    ORIGINALS_DIR: import.meta.env.ORIGINALS_DIR || '',
    TRANSLATIONS_DIR: translationsDir,
    OPENROUTER_API_KEY: import.meta.env.OPENROUTER_API_KEY || '',
    LANG: lang,
    AUTHOR: author,
  };
})();

export function getDefaults(): SettingDefaults {
  return { ...DEFAULTS };
}

export function getSetting<K extends keyof SettingDefaults>(key: K): SettingDefaults[K] {
  const db = getDb();
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined;
  if (row) {
    return row.value as SettingDefaults[K];
  }
  return DEFAULTS[key];
}

export function getAllSettings(): SettingDefaults {
  const db = getDb();
  const rows = db.prepare('SELECT key, value FROM settings').all() as { key: string; value: string }[];
  const overrides: Record<string, string> = {};
  for (const row of rows) {
    overrides[row.key] = row.value;
  }
  return {
    ORIGINALS_DIR: overrides.ORIGINALS_DIR ?? DEFAULTS.ORIGINALS_DIR,
    TRANSLATIONS_DIR: overrides.TRANSLATIONS_DIR ?? DEFAULTS.TRANSLATIONS_DIR,
    OPENROUTER_API_KEY: overrides.OPENROUTER_API_KEY ?? DEFAULTS.OPENROUTER_API_KEY,
    LANG: overrides.LANG ?? DEFAULTS.LANG,
    AUTHOR: overrides.AUTHOR ?? DEFAULTS.AUTHOR,
  };
}

export function setSetting(key: keyof SettingDefaults, value: string): void {
  const db = getDb();
  db.prepare(`
    INSERT INTO settings (key, value) VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `).run(key, value);
}

export function resetSetting(key: keyof SettingDefaults): void {
  const db = getDb();
  db.prepare('DELETE FROM settings WHERE key = ?').run(key);
}

export function resetAllSettings(): void {
  const db = getDb();
  db.prepare('DELETE FROM settings').run();
}

/**
 * Get the directory name used for metadata, constructed from LANG and AUTHOR settings.
 * Falls back to TRANSLATIONS_DIR basename if LANG/AUTHOR are not set.
 */
export function getMetadataDirectory(): string {
  const lang = getSetting('LANG');
  const author = getSetting('AUTHOR');
  if (lang && author) {
    return `${lang}_${author}`;
  }
  // Fallback: parse from TRANSLATIONS_DIR
  const translationsDir = getSetting('TRANSLATIONS_DIR');
  return path.basename(translationsDir);
}
