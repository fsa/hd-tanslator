import type { TranslatorProvider, TranslatorConfig, TranslateRequest } from './types';
import { apiRequest } from '../api-client';
import { buildSystemPrompt, getUserInstructions } from './prompts';

/** Default Ollama API base URL */
const DEFAULT_BASE_URL = 'http://localhost:11434';

/** Default model for translations */
const DEFAULT_MODEL = 'llama3';

/**
 * Ollama translator provider.
 *
 * Uses a local or remote Ollama instance to translate text via LLM models.
 * Ollama exposes an OpenAI-compatible API at `/v1/chat/completions`.
 *
 * Unlike OpenRouter, Ollama does not require an API key.
 * The proxy is bypassed for local Ollama instances (default: localhost:11434).
 *
 * System prompts are loaded from prompts/ (default) with optional
 * DB overrides managed through the prompt service.
 */
export class OllamaProvider implements TranslatorProvider {
  readonly id = 'ollama' as const;
  readonly name = 'Ollama';

  private readonly model: string;
  private readonly baseUrl: string;

  constructor(config: TranslatorConfig) {
    this.model = config.model || DEFAULT_MODEL;
    this.baseUrl = config.baseUrl || DEFAULT_BASE_URL;
  }

  /**
   * Translate an array of text lines from sourceLang to targetLang.
   *
   * Sends the lines in a single chat completion request via the
   * OpenAI-compatible API. The response is expected to contain
   * the same number of lines as the input.
   */
  async translate(
    lines: string[],
    sourceLang: string,
    targetLang: string,
    context?: string,
  ): Promise<string[]> {
    if (lines.length === 0) return [];

    // Build system prompt from template (file default + DB override)
    const userInstructions = getUserInstructions(this.id);
    const systemPrompt = buildSystemPrompt(this.id, sourceLang, targetLang, userInstructions);

    // Add context if provided
    const contextBlock = context
      ? `\n\n## Context\n${context}`
      : '';

    const userContent = lines.map((line, i) => `[${i + 1}] ${line}`).join('\n');

    const requestPayload: TranslateRequest = {
      model: this.model,
      messages: [
        { role: 'system', content: systemPrompt + contextBlock },
        {
          role: 'user',
          content: `Translate the following lines from ${sourceLang} to ${targetLang}. Return only the translations, one per line, preserving the [N] numbering:\n\n${userContent}`,
        },
      ],
      temperature: 0.3,
      max_tokens: 4096,
    };

    const response = await apiRequest<{
      id: string;
      model: string;
      choices: Array<{
        message: { content: string };
        finish_reason: string;
      }>;
      usage?: {
        prompt_tokens: number;
        completion_tokens: number;
        total_tokens: number;
      };
    }>({
      method: 'POST',
      url: `${this.baseUrl}/v1/chat/completions`,
      headers: {},
      data: requestPayload,
    });

    const content = response.data.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error('Ollama returned empty response');
    }

    // Parse numbered response lines back into an array
    const translatedLines = this.parseNumberedResponse(content, lines.length);
    return translatedLines;
  }

  /**
   * Verify that the provider is configured and reachable.
   * Makes a lightweight request to the Ollama API.
   */
  async healthCheck(): Promise<void> {
    await apiRequest({
      method: 'GET',
      url: `${this.baseUrl}/api/tags`,
      headers: {},
    });
  }

  /**
   * Parse a numbered response like:
   *   [1] Привет
   *   [2] Как дела?
   * back into a plain string array.
   *
   * Falls back to splitting by newlines if numbering is not detected.
   */
  private parseNumberedResponse(content: string, expectedCount: number): string[] {
    const lines = content.trim().split('\n');
    const numberedRegex = /^\[\d+\]\s*/;

    // Check if the response uses [N] numbering
    const hasNumbering = lines.some((line) => numberedRegex.test(line));

    if (hasNumbering) {
      const result = lines.map((line) => line.replace(numberedRegex, '').trim());
      // Pad or trim to match expected count
      while (result.length < expectedCount) result.push('');
      return result.slice(0, expectedCount);
    }

    // Fallback: split by newlines, filter empty lines
    const result = lines.filter((l) => l.trim().length > 0);
    while (result.length < expectedCount) result.push('');
    return result.slice(0, expectedCount);
  }
}