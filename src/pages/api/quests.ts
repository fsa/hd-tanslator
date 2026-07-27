import type { APIRoute } from 'astro';
import { getDb } from '../../lib/database';
import { getMetadataDirectory } from '../../lib/settings';

export const prerender = false;

export interface QuestItem {
  name: string;
  character: string;
  section: number;
  quest: number;
  file_count: number;
  translated_count: number;
  approved_count: number;
}

export const GET: APIRoute = async ({ url }) => {
  try {
    const db = getDb();
    const query = url.searchParams.get('q');
    const directory = getMetadataDirectory();

    const sql = `
      SELECT
        f.character || '.' || f.section || '.' || f.quest as name,
        f.character,
        f.section,
        f.quest,
        COUNT(*) as file_count,
        SUM(CASE WHEN f.has_translation THEN 1 ELSE 0 END) as translated_count,
        COALESCE(SUM(CASE WHEN m.approved = 1 THEN 1 ELSE 0 END), 0) as approved_count
      FROM files f
      LEFT JOIN file_metadata m ON f.name = m.file_name AND m.directory = ?
      ${query ? 'WHERE f.character || \'.\' || f.section || \'.\' || f.quest LIKE ?' : ''}
      GROUP BY f.character, f.section, f.quest
      ORDER BY f.character, f.section, f.quest
    `;

    let rows;
    if (query) {
      const searchPattern = `%${query}%`;
      rows = db.prepare(sql).all(directory, searchPattern);
    } else {
      rows = db.prepare(sql).all(directory);
    }

    return new Response(JSON.stringify({ quests: rows }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Quests error:', error);
    return new Response(JSON.stringify({ error: 'Failed to get quests' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
