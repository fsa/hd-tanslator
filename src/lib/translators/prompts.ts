import fs from 'fs';
import path from 'path';
import { getDb } from '../database';

/** Path to the prompts directory (project root/prompts/) */
const PROMPTS_DIR = path.resolve(process.cwd(), 'prompts');

/** Default system prompt filename */
const SYSTEM_PROMPT_FILE = 'system-default.txt';

/** Provider-specific prompt key prefix in the DB */
const PROMPT_DB_PREFIX = 'translator_prompt_';

/**
 * Read a prompt file from the prompts/ directory at the project root.
 * These files are the immutable defaults shipped with the application.
 */
function readPromptFile(filename: string): string {
  const filePath = path.join(PROMPTS_DIR, filename);
  try {
    return fs.readFileSync(filePath, 'utf-8');
  } catch {
    console.error(`Prompt file not found: ${filePath}`);
    return '';
  }
}

/**
 * Get the effective system prompt for a translator provider.
 *
 * Resolution order:
 * 1. If a DB override exists for this provider, use it
 * 2. Otherwise, read the default from the file in prompts/
 *
 * The prompt contains `{sourceLang}`, `{targetLang}`, and `{userInstructions}`
 * placeholders that should be substituted before use.
 *
 * @param providerId - Translator provider ID (e.g. 'openrouter')
 * @returns The raw prompt template with placeholders
 */
export function getSystemPrompt(providerId: string): string {
  const db = getDb();

  // Try DB override first
  const row = db
    .prepare('SELECT value FROM settings WHERE key = ?')
    .get(`${PROMPT_DB_PREFIX}${providerId}`) as { value: string } | undefined;

  if (row && row.value.trim()) {
    return row.value;
  }

  // Fall back to file default
  return readPromptFile(SYSTEM_PROMPT_FILE);
}

/**
 * Save a custom system prompt override for a provider to the DB.
 * Pass an empty string to clear the override and revert to file default.
 *
 * @param providerId - Translator provider ID (e.g. 'openrouter')
 * @param prompt - The custom prompt text, or empty to reset
 */
export function setSystemPrompt(providerId: string, prompt: string): void {
  const db = getDb();
  const key = `${PROMPT_DB_PREFIX}${providerId}`;

  if (prompt.trim()) {
    db.prepare(
      `INSERT INTO settings (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`
    ).run(key, prompt);
  } else {
    // Clear override — revert to file default
    db.prepare('DELETE FROM settings WHERE key = ?').run(key);
  }
}

/**
 * Get the default system prompt from the file (ignoring DB overrides).
 * Useful for the "Reset to default" button in the UI.
 */
export function getDefaultSystemPrompt(): string {
  return readPromptFile(SYSTEM_PROMPT_FILE);
}

/**
 * Build the final system prompt by substituting placeholders.
 *
 * @param providerId - Translator provider ID
 * @param sourceLang - Source language code
 * @param targetLang - Target language code
 * @param userInstructions - Optional user-provided additional instructions
 * @returns The fully resolved prompt string
 */
export function buildSystemPrompt(
  providerId: string,
  sourceLang: string,
  targetLang: string,
  userInstructions?: string,
): string {
  const template = getSystemPrompt(providerId);
  return template
    .replace(/\{sourceLang\}/g, sourceLang)
    .replace(/\{targetLang\}/g, targetLang)
    .replace(/\{userInstructions\}/g, userInstructions?.trim() || '');
}

/**
 * Get the user instructions override for a provider from the DB.
 * These are additional instructions the user wants to append to every prompt.
 */
export function getUserInstructions(providerId: string): string {
  const db = getDb();
  const row = db
    .prepare('SELECT value FROM settings WHERE key = ?')
    .get(`${PROMPT_DB_PREFIX}${providerId}_user_instructions`) as { value: string } | undefined;

  return row?.value || '';
}

/**
 * Get the model override for a provider from the DB.
 * Returns the model string or null if not set (use default).
 */
export function getModel(providerId: string): string | null {
  const db = getDb();
  const row = db
    .prepare('SELECT value FROM settings WHERE key = ?')
    .get(`translator_model_${providerId}`) as { value: string } | undefined;

  return row?.value || null;
}

/**
 * Save a model override for a provider to the DB.
 * Pass an empty string to clear the override.
 */
export function setModel(providerId: string, model: string): void {
  const db = getDb();
  const key = `translator_model_${providerId}`;

  if (model.trim()) {
    db.prepare(
      `INSERT INTO settings (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`
    ).run(key, model);
  } else {
    db.prepare('DELETE FROM settings WHERE key = ?').run(key);
  }
}

/**
 * Clear the model override for a provider (revert to default).
 */
export function resetModel(providerId: string): void {
  const db = getDb();
  db.prepare('DELETE FROM settings WHERE key = ?').run(`translator_model_${providerId}`);
}

/**
 * Get the base URL override for a provider from the DB.
 * Returns the URL string or null if not set (use provider default).
 */
export function getBaseUrl(providerId: string): string | null {
  const db = getDb();
  const row = db
    .prepare('SELECT value FROM settings WHERE key = ?')
    .get(`translator_base_url_${providerId}`) as { value: string } | undefined;

  return row?.value || null;
}

/**
 * Save a base URL override for a provider to the DB.
 * Pass an empty string to clear the override.
 */
export function setBaseUrl(providerId: string, url: string): void {
  const db = getDb();
  const key = `translator_base_url_${providerId}`;

  if (url.trim()) {
    db.prepare(
      `INSERT INTO settings (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`
    ).run(key, url);
  } else {
    db.prepare('DELETE FROM settings WHERE key = ?').run(key);
  }
}

/**
 * Clear the base URL override for a provider (revert to default).
 */
export function resetBaseUrl(providerId: string): void {
  const db = getDb();
  db.prepare('DELETE FROM settings WHERE key = ?').run(`translator_base_url_${providerId}`);
}

/**
 * Save user instructions override for a provider.
 */
export function setUserInstructions(providerId: string, instructions: string): void {
  const db = getDb();
  const key = `${PROMPT_DB_PREFIX}${providerId}_user_instructions`;

  if (instructions.trim()) {
    db.prepare(
      `INSERT INTO settings (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`
    ).run(key, instructions);
  } else {
    db.prepare('DELETE FROM settings WHERE key = ?').run(key);
  }
}