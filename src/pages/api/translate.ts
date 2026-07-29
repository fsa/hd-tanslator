import type { APIRoute } from 'astro';
import { getProvider } from '../../lib/translators';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const { text, provider: providerId, sourceLang, targetLang, context } = body;

    if (!text || typeof text !== 'string') {
      return new Response(JSON.stringify({ error: 'Text is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Split text into lines
    const lines = text.split('\n');

    // Get the translator provider
    let provider;
    try {
      provider = getProvider(providerId || 'openrouter');
    } catch (err) {
      return new Response(JSON.stringify({
        error: err instanceof Error ? err.message : 'Translator provider not configured'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Perform translation
    const translatedLines = await provider.translate(
      lines,
      sourceLang || 'en',
      targetLang || 'ru',
      context || undefined,
    );

    return new Response(JSON.stringify({
      translated_text: translatedLines.join('\n'),
      lines: translatedLines,
      provider: provider.id,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Translate error:', error);
    const message = error instanceof Error ? error.message : 'Translation failed';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};