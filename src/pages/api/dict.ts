import type { APIRoute } from 'astro';
import fs from 'fs';
import path from 'path';

export const prerender = false;

const DICT_DIR = '/usr/share/hunspell';

export const GET: APIRoute = async ({ url }) => {
  try {
    const action = url.searchParams.get('action') || 'get';
    const lang = url.searchParams.get('lang');
    const file = url.searchParams.get('file');

    // List available dictionaries
    if (action === 'list') {
      if (!fs.existsSync(DICT_DIR)) {
        return new Response(JSON.stringify({ dictionaries: [] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const files = fs.readdirSync(DICT_DIR);
      const affFiles = files.filter(f => f.endsWith('.aff'));
      const dictionaries = affFiles.map(f => {
        const langCode = f.replace('.aff', '');
        const dicFile = langCode + '.dic';
        return {
          lang: langCode,
          aff: f,
          dic: dicFile,
          available: files.includes(dicFile),
        };
      }).filter(d => d.available);

      return new Response(JSON.stringify({ dictionaries }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Get specific dictionary file
    if (!file) {
      return new Response(JSON.stringify({ error: 'file parameter required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // File is expected to be like "ru_RU.aff" or "en_US.dic"
    const filePath = path.join(DICT_DIR, file);

    if (!path.resolve(filePath).startsWith(path.resolve(DICT_DIR))) {
      return new Response(JSON.stringify({ error: 'Invalid path' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (!fs.existsSync(filePath)) {
      return new Response(JSON.stringify({ error: 'Dictionary not found: ' + filePath }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const content = fs.readFileSync(filePath);
    const ext = path.extname(file).toLowerCase();
    const contentType = ext === '.aff' ? 'text/plain' : 'application/octet-stream';

    return new Response(content, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400'
      }
    });
  } catch (error) {
    console.error('Dictionary error:', error);
    return new Response(JSON.stringify({ error: 'Failed to load dictionary' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
