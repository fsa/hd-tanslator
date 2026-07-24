import type { APIRoute } from 'astro';
import { getDb } from '../../../../lib/database';

export const prerender = false;

export const GET: APIRoute = async ({ params }) => {
  try {
    const name = params.name;
    if (!name) {
      return new Response(JSON.stringify({ error: 'Quest name required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const parts = name.split('.');
    if (parts.length !== 3) {
      return new Response(JSON.stringify({ error: 'Invalid quest name format' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const [character, sectionStr, questStr] = parts;
    const section = parseInt(sectionStr);
    const quest = parseInt(questStr);

    if (isNaN(section) || isNaN(quest)) {
      return new Response(JSON.stringify({ error: 'Invalid section or quest number' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const db = getDb();
    const files = db.prepare(`
      SELECT id, name, file_id, original_filename, has_translation,
             translation_filename, original_size, translation_size
      FROM files
      WHERE character = ? AND section = ? AND quest = ?
      ORDER BY CAST(file_id AS INTEGER)
    `).all(character, section, quest);

    return new Response(JSON.stringify({ files }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Quest files error:', error);
    return new Response(JSON.stringify({ error: 'Failed to get quest files' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
