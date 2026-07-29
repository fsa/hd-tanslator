import type { APIRoute } from 'astro';
import { getAvailableProviders } from '../../../lib/translators';

export const prerender = false;

export const GET: APIRoute = async () => {
  try {
    const providers = getAvailableProviders();
    return new Response(JSON.stringify({ providers }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Translators GET error:', error);
    return new Response(JSON.stringify({ error: 'Failed to get translators' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};