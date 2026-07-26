import type { APIRoute } from 'astro';
import { getFileByName, getFileMetadata, upsertFileMetadata } from '../../../../lib/database';
import { getMetadataDirectory } from '../../../../lib/settings';

export const prerender = false;

export const GET: APIRoute = async ({ params }) => {
  try {
    const name = params.name;
    if (!name) {
      return new Response(JSON.stringify({ error: 'Name parameter required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const fileRecord = getFileByName(name);
    if (!fileRecord) {
      return new Response(JSON.stringify({ error: 'File not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const directory = getMetadataDirectory();
    const metadata = getFileMetadata(name, directory);

    return new Response(JSON.stringify({
      file_name: name,
      directory,
      approved: metadata?.approved ?? false
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Metadata GET error:', error);
    return new Response(JSON.stringify({ error: 'Failed to get metadata' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

export const POST: APIRoute = async ({ params, request }) => {
  try {
    const name = params.name;
    if (!name) {
      return new Response(JSON.stringify({ error: 'Name parameter required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const fileRecord = getFileByName(name);
    if (!fileRecord) {
      return new Response(JSON.stringify({ error: 'File not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const body = await request.json();
    const { approved } = body;

    if (typeof approved !== 'boolean') {
      return new Response(JSON.stringify({ error: 'approved must be a boolean' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const directory = getMetadataDirectory();
    upsertFileMetadata(name, directory, approved);

    return new Response(JSON.stringify({ success: true, file_name: name, approved }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Metadata POST error:', error);
    return new Response(JSON.stringify({ error: 'Failed to update metadata' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};