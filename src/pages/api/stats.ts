import type { APIRoute } from 'astro';
import { getTranslationStats } from '../../lib/database';

export const prerender = false;

export const GET: APIRoute = async () => {
  try {
    const stats = getTranslationStats();
    return new Response(JSON.stringify(stats), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Stats error:', error);
    return new Response(JSON.stringify({ error: 'Failed to get stats' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};