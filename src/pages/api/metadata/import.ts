import type { APIRoute } from 'astro';
import { importMetadata } from '../../../lib/database';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();

    // Support both raw array and wrapped format { version, metadata: [...] }
    let rows: { file_name: string; directory: string; approved: boolean }[];

    if (Array.isArray(body)) {
      rows = body;
    } else if (body.metadata && Array.isArray(body.metadata)) {
      rows = body.metadata;
    } else {
      return new Response(JSON.stringify({
        error: 'Invalid format. Expected an array of { file_name, directory, approved } or { version, metadata: [...] }'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Validate rows
    for (const row of rows) {
      if (typeof row.file_name !== 'string' || typeof row.directory !== 'string' || typeof row.approved !== 'boolean') {
        return new Response(JSON.stringify({
          error: `Invalid row: ${JSON.stringify(row)}. Each row must have file_name (string), directory (string), approved (boolean)`
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    const count = importMetadata(rows);

    return new Response(JSON.stringify({
      success: true,
      imported: count
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Metadata import error:', error);
    return new Response(JSON.stringify({ error: 'Failed to import metadata' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};