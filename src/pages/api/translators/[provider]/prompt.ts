import type { APIRoute } from 'astro';
import { getSystemPrompt, setSystemPrompt, getDefaultSystemPrompt, getUserInstructions, setUserInstructions, getModel, setModel, resetModel } from '../../../../lib/translators/prompts';

export const prerender = false;

export const GET: APIRoute = async ({ params }) => {
  try {
    const { provider } = params;
    if (!provider) {
      return new Response(JSON.stringify({ error: 'Provider ID required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const current = getSystemPrompt(provider as string);
    const defaultPrompt = getDefaultSystemPrompt();
    const userInstructions = getUserInstructions(provider as string);
    const model = getModel(provider as string);

    return new Response(JSON.stringify({
      provider,
      current,
      default: defaultPrompt,
      user_instructions: userInstructions,
      model,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Translator prompt GET error:', error);
    return new Response(JSON.stringify({ error: 'Failed to get prompt' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

export const POST: APIRoute = async ({ params, request }) => {
  try {
    const { provider } = params;
    if (!provider) {
      return new Response(JSON.stringify({ error: 'Provider ID required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const body = await request.json();
    const { action, value } = body;

    if (action === 'save_prompt') {
      setSystemPrompt(provider as string, value || '');
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (action === 'reset_prompt') {
      setSystemPrompt(provider as string, '');
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (action === 'save_instructions') {
      setUserInstructions(provider as string, value || '');
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (action === 'reset_instructions') {
      setUserInstructions(provider as string, '');
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (action === 'save_model') {
      setModel(provider as string, value || '');
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (action === 'reset_model') {
      resetModel(provider as string);
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
    console.error('Translator prompt POST error:', error);
    return new Response(JSON.stringify({ error: 'Failed to process request' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};