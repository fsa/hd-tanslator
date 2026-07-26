import type { APIRoute } from 'astro';
import { exportAllMetadata } from '../../../lib/database';
import { getMetadataDirectory } from '../../../lib/settings';

export const prerender = false;

export const GET: APIRoute = async ({ url }) => {
  try {
    const directory = url.searchParams.get('directory') || getMetadataDirectory();
    const metadata = exportAllMetadata(directory);

    const exportData = {
      version: 1,
      exported_at: new Date().toISOString(),
      directory,
      metadata
    };

    const filename = `${directory}-metadata-${new Date().toISOString().slice(0, 10)}.json`;

    return new Response(JSON.stringify(exportData, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="${filename}"`
      }
    });
  } catch (error) {
    console.error('Metadata export error:', error);
    return new Response(JSON.stringify({ error: 'Failed to export metadata' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};