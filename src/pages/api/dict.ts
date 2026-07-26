import type { APIRoute } from 'astro';
import fs from 'fs';
import path from 'path';

export const prerender = false;

const DICT_DIR = '/usr/share/hunspell';

// Server-side cache for converted dictionaries
const dictCache = new Map<string, Uint8Array>();

function detectEncoding(affPath: string): string {
  const content = fs.readFileSync(affPath, 'utf-8');
  const match = content.match(/^SET\s+(\S+)/im);
  return match ? match[1].toLowerCase() : 'utf-8';
}

function convertToUtf8(filePath: string, encoding: string): Uint8Array {
  const raw = fs.readFileSync(filePath);
  if (encoding === 'utf-8' || encoding === 'ascii') {
    return new Uint8Array(raw);
  }
  const decoder = new TextDecoder(encoding);
  const text = decoder.decode(raw);
  return new TextEncoder().encode(text);
}

function loadDictFile(filename: string): Uint8Array {
  const cacheKey = filename;
  if (dictCache.has(cacheKey)) {
    return dictCache.get(cacheKey)!;
  }

  const filePath = path.join(DICT_DIR, filename);
  if (!path.resolve(filePath).startsWith(path.resolve(DICT_DIR))) {
    throw new Error('Invalid path');
  }
  if (!fs.existsSync(filePath)) {
    throw new Error('File not found: ' + filePath);
  }

  // Determine encoding from the .aff file
  const affFilename = filename.replace(/\.dic$/, '.aff');
  const affPath = path.join(DICT_DIR, affFilename);
  const encoding = fs.existsSync(affPath) ? detectEncoding(affPath) : 'utf-8';

  const data = convertToUtf8(filePath, encoding);

  dictCache.set(cacheKey, data);
  return data;
}

export const GET: APIRoute = async ({ url }) => {
  try {
    const action = url.searchParams.get('action') || 'get';
    const file = url.searchParams.get('file');

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

    if (!file) {
      return new Response(JSON.stringify({ error: 'file parameter required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const data = loadDictFile(file);
    const contentType = 'text/plain; charset=utf-8';

    return new Response(data, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400'
      }
    });
  } catch (error: any) {
    console.error('Dictionary error:', error.message);
    return new Response(JSON.stringify({ error: error.message || 'Failed to load dictionary' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
