import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import type { FileRecord, FileMetadataRecord } from '../types';

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

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS file_metadata (
      file_name TEXT NOT NULL,
      directory TEXT NOT NULL DEFAULT '',
      approved BOOLEAN NOT NULL DEFAULT 0,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (file_name, directory),
      FOREIGN KEY (file_name) REFERENCES files(name) ON DELETE CASCADE
    );
  `);

  // Migration: recreate file_metadata with correct schema if it was created
  // during development before directory support was added
  try {
    const oldSchema = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='file_metadata' AND sql NOT LIKE '%directory%'").get();
    if (oldSchema) {
      db.exec(`DROP TABLE IF EXISTS file_metadata`);
      db.exec(`
        CREATE TABLE file_metadata (
          file_name TEXT NOT NULL,
          directory TEXT NOT NULL DEFAULT '',
          approved BOOLEAN NOT NULL DEFAULT 0,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (file_name, directory),
          FOREIGN KEY (file_name) REFERENCES files(name) ON DELETE CASCADE
        )
      `);
    }
  } catch {
    // Ignore migration errors
  }

  // Migration: normalize directory values to basename only
  // (in case records were created with full paths during development)
  try {
    const rowsWithPath = db.prepare(
      `SELECT file_name, directory FROM file_metadata WHERE directory LIKE '%/%' OR directory LIKE '%\\%'`
    ).all() as { file_name: string; directory: string }[];
    for (const row of rowsWithPath) {
      const basename = row.directory.split('/').pop()?.split('\\').pop() || row.directory;
      db.prepare(`UPDATE file_metadata SET directory = ? WHERE file_name = ? AND directory = ?`)
        .run(basename, row.file_name, row.directory);
    }
  } catch {
    // Ignore migration errors
  }

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

// --- File Metadata ---

export function getFileMetadata(fileName: string, directory: string): FileMetadataRecord | null {
  const db = getDb();
  return db.prepare('SELECT * FROM file_metadata WHERE file_name = ? AND directory = ?').get(fileName, directory) as FileMetadataRecord | null;
}

export function upsertFileMetadata(fileName: string, directory: string, approved: boolean): void {
  const db = getDb();
  db.prepare(`
    INSERT INTO file_metadata (file_name, directory, approved, updated_at)
    VALUES (?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(file_name, directory) DO UPDATE SET
      approved = excluded.approved,
      updated_at = CURRENT_TIMESTAMP
  `).run(fileName, directory, approved ? 1 : 0);
}

export function getAllMetadata(): FileMetadataRecord[] {
  const db = getDb();
  return db.prepare('SELECT * FROM file_metadata ORDER BY directory, file_name').all() as FileMetadataRecord[];
}

export function deleteFileMetadata(fileName: string, directory: string): void {
  const db = getDb();
  db.prepare('DELETE FROM file_metadata WHERE file_name = ? AND directory = ?').run(fileName, directory);
}

export function importMetadata(rows: { file_name: string; directory: string; approved: boolean }[]): number {
  const db = getDb();
  let count = 0;
  const stmt = db.prepare(`
    INSERT INTO file_metadata (file_name, directory, approved, updated_at)
    VALUES (?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(file_name, directory) DO UPDATE SET
      approved = excluded.approved,
      updated_at = CURRENT_TIMESTAMP
  `);
  const insertMany = db.transaction((items: { file_name: string; directory: string; approved: boolean }[]) => {
    for (const item of items) {
      // Normalize directory to basename (last path component)
      const dir = item.directory.split('/').pop()?.split('\\').pop() || item.directory;
      stmt.run(item.file_name, dir, item.approved ? 1 : 0);
      count++;
    }
  });
  insertMany(rows);
  return count;
}

export function exportAllMetadata(directory?: string): { file_name: string; directory: string; approved: boolean }[] {
  const db = getDb();
  if (directory) {
    return db.prepare(`
      SELECT f.name as file_name, COALESCE(m.directory, ?) as directory, COALESCE(m.approved, 0) as approved
      FROM files f
      LEFT JOIN file_metadata m ON f.name = m.file_name AND m.directory = ?
      ORDER BY f.name
    `).all(directory, directory) as { file_name: string; directory: string; approved: boolean }[];
  }
  return db.prepare(`
    SELECT f.name as file_name, COALESCE(m.directory, '') as directory, COALESCE(m.approved, 0) as approved
    FROM files f
    LEFT JOIN file_metadata m ON f.name = m.file_name
    ORDER BY f.name
  `).all() as { file_name: string; directory: string; approved: boolean }[];
}

export function getDistinctDirectories(): string[] {
  const db = getDb();
  const rows = db.prepare('SELECT DISTINCT directory FROM file_metadata ORDER BY directory').all() as { directory: string }[];
  return rows.map(r => r.directory).filter(d => d !== '');
}
