import type { APIRoute } from 'astro';
import { getAllFiles, searchFiles } from '../../lib/database';

export const prerender = false;

export const GET: APIRoute = async ({ url }) => {
  try {
    const query = url.searchParams.get('q');
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '100');

    let files;
    if (query) {
      files = searchFiles(query);
    } else {
      files = getAllFiles();
    }

    // Apply pagination
    const startIndex = (page - 1) * limit;
    const paginatedFiles = files.slice(startIndex, startIndex + limit);

    return new Response(JSON.stringify({
      files: paginatedFiles,
      total: files.length,
      page,
      limit,
      totalPages: Math.ceil(files.length / limit)
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    console.error('Files error:', error);
    return new Response(JSON.stringify({ error: 'Failed to get files' }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }
};
