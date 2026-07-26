export interface FileRecord {
  id: number;
  name: string;
  character: string;
  section: number;
  quest: number;
  file_id: string;
  original_filename: string;
  has_translation: boolean;
  translation_filename: string | null;
  original_size: number | null;
  translation_size: number | null;
  indexed_at: string;
  updated_at: string;
}

export interface FileMetadata {
  character: string;
  section: number;
  quest: number;
  file_id: string;
  name: string;
}

export interface FileMetadataRecord {
  file_name: string;
  directory: string;
  approved: boolean;
  updated_at: string;
}

export interface ReindexResult {
  added: number;
  updated: number;
  removed: number;
  total: number;
  warnings?: string[];
}

export interface FileListItem {
  name: string;
  character: string;
  section: number;
  quest: number;
  file_id: string;
  has_translation: boolean;
}

export interface QuestItem {
  name: string;
  character: string;
  section: number;
  quest: number;
  file_count: number;
  translated_count: number;
}

export interface MetadataExportRow {
  file_name: string;
  directory: string;
  approved: boolean;
}
