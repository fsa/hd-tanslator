import type { APIRoute } from 'astro';
import { getDistinctDirectories } from '../../../lib/database';
import { getMetadataDirectory } from '../../../lib/settings';

export const prerender = false;

export const GET: APIRoute = async () => {
  try {
    const directories = getDistinctDirectories();
    const current = getMetadataDirectory();

    // Ensure current directory is in the list
    if (current && !directories.includes(current)) {
      directories.unshift(current);
    }

    return new Response(JSON.stringify({ directories, current }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Metadata directories error:', error);
    return new Response(JSON.stringify({ error: 'Failed to get directories' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};