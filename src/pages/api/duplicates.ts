import type { APIRoute } from 'astro';
import { getDuplicatesByChecksum, getDuplicatesForFile, getFileByName, getFileMetadata } from '../../lib/database';
import { getMetadataDirectory } from '../../lib/settings';

export const prerender = false;

export const GET: APIRoute = async ({ url }) => {
  try {
    const fileName = url.searchParams.get('file');

    if (fileName) {
      // Get duplicates for a specific file with full status info
      const duplicateNames = getDuplicatesForFile(fileName);
      const directory = getMetadataDirectory();

      const duplicates = duplicateNames.map(name => {
        const record = getFileByName(name);
        const metadata = getFileMetadata(name, directory);
        return {
          name,
          has_translation: record?.has_translation ?? false,
          translation_filename: record?.translation_filename ?? null,
          approved: metadata?.approved ?? false,
          original_filename: record?.original_filename ?? name
        };
      });

      return new Response(JSON.stringify({
        file: fileName,
        has_duplicates: duplicates.length > 0,
        duplicates
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Get all duplicate groups
    const groups = getDuplicatesByChecksum();
    return new Response(JSON.stringify({
      total_duplicate_groups: groups.length,
      groups
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Duplicates error:', error);
    return new Response(JSON.stringify({ error: 'Failed to get duplicates' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};