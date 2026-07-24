import type { APIRoute } from 'astro';
import { reindex } from '../../lib/indexer';

export const prerender = false;

export const POST: APIRoute = async () => {
  try {
    const result = reindex();
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    console.error('Reindex error:', error);
    return new Response(JSON.stringify({ error: 'Failed to reindex' }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }
};
