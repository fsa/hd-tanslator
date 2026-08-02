import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { getSetting } from './settings';

function getOriginalsDir(): string {
  return getSetting('ORIGINALS_DIR');
}

function getTranslationsDir(): string {
  return getSetting('TRANSLATIONS_DIR');
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

/**
 * Compute a simple checksum for a file.
 * Uses the first 8 bytes of SHA-256 (hex-encoded) for a good balance of
 * speed and collision resistance. Returns null if the file is empty or doesn't exist.
 */
export function computeFileChecksum(filepath: string): string | null {
  if (!fs.existsSync(filepath)) return null;

  const stats = fs.statSync(filepath);
  if (stats.size === 0) return null;

  const fd = fs.openSync(filepath, 'r');
  // Read first 8KB for checksum — enough for reliable dedup of text files
  const buffer = Buffer.alloc(8192);
  const bytesRead = fs.readSync(fd, buffer, 0, 8192, 0);
  fs.closeSync(fd);

  if (bytesRead === 0) return null;

  const hash = crypto.createHash('sha256').update(buffer.subarray(0, bytesRead)).digest('hex');
  // Use first 16 hex chars (8 bytes) for a compact but reliable checksum
  return hash.slice(0, 16);
}

/**
 * Compute checksum for an original file by its filename (in originals dir).
 */
export function getOriginalChecksum(filename: string): string | null {
  const dir = getOriginalsDir();
  const filePath = path.join(dir, filename);

  if (!validatePath(filePath, dir)) {
    throw new Error('Invalid file path');
  }

  return computeFileChecksum(filePath);
}
