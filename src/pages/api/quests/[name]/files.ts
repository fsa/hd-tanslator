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
      SELECT f.id, f.name, f.file_id, f.original_filename, f.has_translation,
             f.translation_filename, f.original_size, f.translation_size,
             COALESCE(m.approved, 0) AS approved
      FROM files f
      LEFT JOIN file_metadata m ON m.file_name = f.name
      WHERE f.character = ? AND f.section = ? AND f.quest = ?
      ORDER BY CAST(f.file_id AS INTEGER)
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
