import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import type { FileRecord } from '../types';

let db: Database.Database | null = null;

function getDbPath(): string {
  const dbPath = import.meta.env.DB_PATH || './data/translator.db';
  return path.resolve(dbPath);
}

function ensureDataDir(): void {
  const dbPath = getDbPath();
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

export function getDb(): Database.Database {
  if (db) return db;

  ensureDataDir();
  const dbPath = getDbPath();

  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  // Create tables if they don't exist
  db.exec(`
    CREATE TABLE IF NOT EXISTS files (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      character TEXT NOT NULL,
      section INTEGER NOT NULL,
      quest INTEGER NOT NULL,
      file_id TEXT NOT NULL,
      original_filename TEXT NOT NULL,
      has_translation BOOLEAN DEFAULT 0,
      translation_filename TEXT,
      original_size INTEGER,
      translation_size INTEGER,
      indexed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_files_name ON files(name);
    CREATE INDEX IF NOT EXISTS idx_files_character ON files(character);
    CREATE INDEX IF NOT EXISTS idx_files_section ON files(section);
    CREATE INDEX IF NOT EXISTS idx_files_quest ON files(quest);
    CREATE INDEX IF NOT EXISTS idx_files_character_section ON files(character, section);
  `);

  return db;
}

export function getAllFiles(): FileRecord[] {
  const db = getDb();
  return db.prepare('SELECT * FROM files ORDER BY character, section, quest, file_id').all() as FileRecord[];
}

export function searchFiles(query: string): FileRecord[] {
  const db = getDb();
  const searchPattern = `%${query}%`;
  return db.prepare(
    'SELECT * FROM files WHERE name LIKE ? OR character LIKE ? ORDER BY character, section, quest, file_id'
  ).all(searchPattern, searchPattern) as FileRecord[];
}

export function getFileByName(name: string): FileRecord | null {
  const db = getDb();
  return db.prepare('SELECT * FROM files WHERE name = ?').get(name) as FileRecord | null;
}

export function upsertFile(record: Omit<FileRecord, 'id' | 'indexed_at' | 'updated_at'>): void {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO files (name, character, section, quest, file_id, original_filename, has_translation, translation_filename, original_size, translation_size)
    VALUES (@name, @character, @section, @quest, @file_id, @original_filename, @has_translation, @translation_filename, @original_size, @translation_size)
    ON CONFLICT(name) DO UPDATE SET
      has_translation = @has_translation,
      translation_filename = @translation_filename,
      original_size = @original_size,
      translation_size = @translation_size,
      updated_at = CURRENT_TIMESTAMP
  `);
  stmt.run(record);
}

export function updateTranslationStatus(name: string, hasTranslation: boolean, translationFilename: string | null, translationSize: number | null): void {
  const db = getDb();
  db.prepare(`
    UPDATE files
    SET has_translation = ?, translation_filename = ?, translation_size = ?, updated_at = CURRENT_TIMESTAMP
    WHERE name = ?
  `).run(hasTranslation, translationFilename, translationSize, name);
}

export function deleteFile(name: string): void {
  const db = getDb();
  db.prepare('DELETE FROM files WHERE name = ?').run(name);
}

export function getFileCount(): number {
  const db = getDb();
  const result = db.prepare('SELECT COUNT(*) as count FROM files').get() as { count: number };
  return result.count;
}
