import type { APIRoute } from 'astro';
import { getAllSettings, getDefaults, setSetting, resetSetting, resetAllSettings } from '../../lib/settings';
import type { SettingDefaults } from '../../lib/settings';

export const prerender = false;

export const GET: APIRoute = async () => {
  try {
    const settings = getAllSettings();
    const defaults = getDefaults();
    return new Response(JSON.stringify({ settings, defaults }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Settings GET error:', error);
    return new Response(JSON.stringify({ error: 'Failed to get settings' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const { action, key, value } = body;

    if (action === 'save') {
      if (!key || typeof key !== 'string') {
        return new Response(JSON.stringify({ error: 'Key required' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      if (!(key in getDefaults())) {
        return new Response(JSON.stringify({ error: 'Invalid setting key' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      if (typeof value !== 'string') {
        return new Response(JSON.stringify({ error: 'Value must be a string' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      setSetting(key as keyof SettingDefaults, value);
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (action === 'reset') {
      if (!key) {
        resetAllSettings();
        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      if (!(key in getDefaults())) {
        return new Response(JSON.stringify({ error: 'Invalid setting key' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      resetSetting(key as keyof SettingDefaults);
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Settings POST error:', error);
    return new Response(JSON.stringify({ error: 'Failed to process request' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
