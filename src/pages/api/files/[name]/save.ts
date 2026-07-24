import type { APIRoute } from 'astro';
import { getFileByName, updateTranslationStatus } from '../../../../lib/database';
import { writeTranslationFile, getTranslationFileSize } from '../../../../lib/filesystem';

export const prerender = false;

export const POST: APIRoute = async ({ params, request }) => {
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

    const body = await request.json();
    const { content } = body;

    if (typeof content !== 'string') {
      return new Response(JSON.stringify({ error: 'Content must be a string' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const translationFilename = `${name}.txt`;
    writeTranslationFile(translationFilename, content);

    const translationSize = getTranslationFileSize(translationFilename);
    updateTranslationStatus(name, 1, translationFilename, translationSize);

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Save error:', error);
    return new Response(JSON.stringify({ error: 'Failed to save translation' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
