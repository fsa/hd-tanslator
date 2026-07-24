import fs from 'fs';
import path from 'path';

function getOriginalsDir(): string {
  return import.meta.env.ORIGINALS_DIR || '/path/to/originals';
}

function getTranslationsDir(): string {
  return import.meta.env.TRANSLATIONS_DIR || '/path/to/translations';
}

function validatePath(filePath: string, baseDir: string): boolean {
  const resolved = path.resolve(filePath);
  const resolvedBase = path.resolve(baseDir);
  return resolved.startsWith(resolvedBase);
}

export function readOriginalFile(filename: string): string | null {
  const dir = getOriginalsDir();
  const filePath = path.join(dir, filename);

  if (!validatePath(filePath, dir)) {
    throw new Error('Invalid file path');
  }

  if (!fs.existsSync(filePath)) {
    return null;
  }

  return fs.readFileSync(filePath, 'utf-8');
}

export function readTranslationFile(filename: string): string | null {
  const dir = getTranslationsDir();
  const filePath = path.join(dir, filename);

  if (!validatePath(filePath, dir)) {
    throw new Error('Invalid file path');
  }

  if (!fs.existsSync(filePath)) {
    return null;
  }

  return fs.readFileSync(filePath, 'utf-8');
}

export function writeTranslationFile(filename: string, content: string): void {
  const dir = getTranslationsDir();
  const filePath = path.join(dir, filename);

  if (!validatePath(filePath, dir)) {
    throw new Error('Invalid file path');
  }

  // Ensure directory exists
  const fileDir = path.dirname(filePath);
  if (!fs.existsSync(fileDir)) {
    fs.mkdirSync(fileDir, { recursive: true });
  }

  fs.writeFileSync(filePath, content, 'utf-8');
}

export function getOriginalFileSize(filename: string): number | null {
  const dir = getOriginalsDir();
  const filePath = path.join(dir, filename);

  if (!validatePath(filePath, dir)) {
    throw new Error('Invalid file path');
  }

  if (!fs.existsSync(filePath)) {
    return null;
  }

  const stats = fs.statSync(filePath);
  return stats.size;
}

export function getTranslationFileSize(filename: string): number | null {
  const dir = getTranslationsDir();
  const filePath = path.join(dir, filename);

  if (!validatePath(filePath, dir)) {
    throw new Error('Invalid file path');
  }

  if (!fs.existsSync(filePath)) {
    return null;
  }

  const stats = fs.statSync(filePath);
  return stats.size;
}

export function translationFileExists(filename: string): boolean {
  const dir = getTranslationsDir();
  const filePath = path.join(dir, filename);

  if (!validatePath(filePath, dir)) {
    throw new Error('Invalid file path');
  }

  return fs.existsSync(filePath);
}
