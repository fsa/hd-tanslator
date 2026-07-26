import type { APIRoute } from 'astro';
import { getFileByName } from '../../../../lib/database';
import { readTranslationFile, readOriginalFile } from '../../../../lib/filesystem';

export const prerender = false;

export const GET: APIRoute = async ({ params }) => {
  try {
    const name = params.name;
    if (!name) {
      return new Response(JSON.stringify({ error: 'Name parameter required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const fileRecord = getFileByName(name);
    if (!fileRecord) {
      return new Response(JSON.stringify({ error: 'File not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // If translation file exists on disk, return it
    if (fileRecord.has_translation && fileRecord.translation_filename) {
      const content = readTranslationFile(fileRecord.translation_filename);
      if (content !== null) {
        return new Response(content, {
          status: 200,
          headers: {
            'Content-Type': 'text/plain; charset=utf-8'
          }
        });
      }
    }

    // No translation yet — return original as starting point
    const originalContent = readOriginalFile(fileRecord.original_filename);
    if (originalContent === null) {
      return new Response(JSON.stringify({ error: 'Original file not found on disk' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(originalContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'X-Translation-Status': 'missing'
      }
    });
  } catch (error) {
    console.error('Trans error:', error);
    return new Response(JSON.stringify({ error: 'Failed to read translation' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
