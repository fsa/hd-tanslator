import type { APIRoute } from 'astro';
import { getDb } from '../../lib/database';

export const prerender = false;

export interface QuestItem {
  name: string;
  character: string;
  section: number;
  quest: number;
  file_count: number;
  translated_count: number;
}

export const GET: APIRoute = async ({ url }) => {
  try {
    const db = getDb();
    const query = url.searchParams.get('q');

    let rows;
    if (query) {
      const searchPattern = `%${query}%`;
      rows = db.prepare(`
        SELECT
          character || '.' || section || '.' || quest as name,
          character,
          section,
          quest,
          COUNT(*) as file_count,
          SUM(CASE WHEN has_translation THEN 1 ELSE 0 END) as translated_count
        FROM files
        WHERE character || '.' || section || '.' || quest LIKE ?
        GROUP BY character, section, quest
        ORDER BY character, section, quest
      `).all(searchPattern);
    } else {
      rows = db.prepare(`
        SELECT
          character || '.' || section || '.' || quest as name,
          character,
          section,
          quest,
          COUNT(*) as file_count,
          SUM(CASE WHEN has_translation THEN 1 ELSE 0 END) as translated_count
        FROM files
        GROUP BY character, section, quest
        ORDER BY character, section, quest
      `).all();
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
