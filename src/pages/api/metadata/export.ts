import type { APIRoute } from 'astro';
import { exportAllMetadata } from '../../../lib/database';
import { getSetting } from '../../../lib/settings';
import fs from 'fs';
import path from 'path';

export const prerender = false;

export const GET: APIRoute = async ({ url }) => {
  try {
    const directory = url.searchParams.get('directory') || '';
    const browserDownload = url.searchParams.get('browser_download') === 'true';
    const metadata = exportAllMetadata(directory);

    const exportData = {
      version: 1,
      exported_at: new Date().toISOString(),
      directory,
      metadata
    };

    const jsonContent = JSON.stringify(exportData, null, 2);

    if (browserDownload) {
      // Browser download mode: include date in filename, return as attachment
      const datePart = `-${new Date().toISOString().slice(0, 10)}`;
      const filename = `${directory}-metadata${datePart}.json`;

      return new Response(jsonContent, {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Content-Disposition': `attachment; filename="${filename}"`
        }
      });
    }

    // Local save mode: save to METADATA_EXPORT_DIR without date in filename
    const filename = `${directory}-metadata.json`;

    const exportDirSetting = getSetting('METADATA_EXPORT_DIR');
    const exportDir = path.resolve(exportDirSetting);

    if (!fs.existsSync(exportDir)) {
      fs.mkdirSync(exportDir, { recursive: true });
    }

    const filePath = path.join(exportDir, filename);
    fs.writeFileSync(filePath, jsonContent, 'utf-8');

    return new Response(JSON.stringify({
      success: true,
      filename,
      path: filePath,
      record_count: metadata.length
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Metadata export error:', error);
    return new Response(JSON.stringify({ error: 'Failed to export metadata' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};