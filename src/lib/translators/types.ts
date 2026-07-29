/**
 * Types and interfaces for the translation service layer.
 *
 * Each translator service (OpenRouter, etc.) implements {@link TranslatorProvider}.
 * The factory in `index.ts` creates the appropriate provider based on configuration.
 */

/** Supported translator provider identifiers */
export type TranslatorProviderId = 'openrouter';

/** A single message in a chat conversation */
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/** Request payload sent to a translation provider */
export interface TranslateRequest {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  max_tokens?: number;
}

/** Response from a translation provider */
export interface TranslateResponse {
  text: string;
  model: string;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/** Configuration required to instantiate a provider */
export interface TranslatorConfig {
  apiKey: string;
  model?: string;
  /** Base URL for the API (override for custom endpoints) */
  baseUrl?: string;
}

/** Interface that all translator providers must implement */
export interface TranslatorProvider {
  /** Unique identifier for this provider type */
  readonly id: TranslatorProviderId;

  /** Human-readable display name */
  readonly name: string;

  /**
   * Translate a batch of text lines.
   *
   * @param lines - Array of text lines to translate
   * @param sourceLang - Source language code (e.g. 'en')
   * @param targetLang - Target language code (e.g. 'ru')
   * @param context - Optional context to help the translation (e.g. character names, quest info)
   * @returns Array of translated lines (same length as input)
   */
  translate(lines: string[], sourceLang: string, targetLang: string, context?: string): Promise<string[]>;

  /**
   * Check if the provider is properly configured and reachable.
   * Should throw if the API key is missing or the endpoint is unreachable.
   */
  healthCheck(): Promise<void>;
}