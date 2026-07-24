import fs from 'fs';
import path from 'path';
import type { FileMetadata, ReindexResult } from '../types';
import {
  getAllFiles,
  upsertFile,
  deleteFile,
  updateTranslationStatus
} from './database';
import {
  getOriginalFileSize,
  getTranslationFileSize,
  translationFileExists
} from './filesystem';
import { getSetting } from './settings';

const ORIG_REGEX = /^([A-Za-z0-9]+)\.(\d+)\.(\d+)_(\d+)_orig\.txt$/;

export function parseFilename(filename: string): FileMetadata | null {
  const match = filename.match(ORIG_REGEX);
  if (!match) return null;

  return {
    character: match[1],
    section: parseInt(match[2]),
    quest: parseInt(match[3]),
    file_id: match[4],
    name: `${match[1]}.${match[2]}.${match[3]}_${match[4]}`
  };
}

export function reindex(): ReindexResult {
  const originalsDir = getSetting('ORIGINALS_DIR');
  const translationsDir = getSetting('TRANSLATIONS_DIR');

  // Get existing files from database
  const existingFiles = getAllFiles();
  const existingNames = new Set(existingFiles.map(f => f.name));

  // Scan originals directory
  let added = 0;
  let updated = 0;
  const scannedNames = new Set<string>();

  if (fs.existsSync(originalsDir)) {
    const files = fs.readdirSync(originalsDir).filter(f => f.endsWith('_orig.txt'));

    for (const file of files) {
      const metadata = parseFilename(file);
      if (!metadata) continue;

      scannedNames.add(metadata.name);

      const originalSize = getOriginalFileSize(file);
      const hasTranslation = translationFileExists(`${metadata.name}.txt`);
      const translationSize = hasTranslation ? getTranslationFileSize(`${metadata.name}.txt`) : null;

      upsertFile({
        name: metadata.name,
        character: metadata.character,
        section: metadata.section,
        quest: metadata.quest,
        file_id: metadata.file_id,
        original_filename: file,
        has_translation: hasTranslation ? 1 : 0,
        translation_filename: hasTranslation ? `${metadata.name}.txt` : null,
        original_size: originalSize ?? 0,
        translation_size: translationSize ?? 0
      });

      if (existingNames.has(metadata.name)) {
        updated++;
      } else {
        added++;
      }
    }
  }

  // Remove files that no longer exist in originals
  let removed = 0;
  for (const existingName of existingNames) {
    if (!scannedNames.has(existingName)) {
      deleteFile(existingName);
      removed++;
    }
  }

  return {
    added,
    updated,
    removed,
    total: scannedNames.size
  };
}
