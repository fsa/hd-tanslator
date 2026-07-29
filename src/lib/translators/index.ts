import type { TranslatorProvider, TranslatorProviderId, TranslatorConfig } from './types';
import { OpenRouterProvider } from './openrouter';
import { getSetting } from '../settings';
import { getModel } from './prompts';
import { resetClient } from '../api-client';

/** Registry of available provider constructors */
const PROVIDER_REGISTRY: Record<TranslatorProviderId, new (config: TranslatorConfig) => TranslatorProvider> = {
  openrouter: OpenRouterProvider,
};

/** Cached provider instance (singleton per provider type) */
let cachedProvider: TranslatorProvider | null = null;
let cachedProviderId: TranslatorProviderId | null = null;

/**
 * Get or create a translator provider instance.
 *
 * Reads the API key from settings and creates the appropriate provider.
 * The instance is cached and reused until {@link resetProvider} is called.
 *
 * @param providerId - The provider to instantiate (default: 'openrouter')
 * @returns A configured TranslatorProvider instance
 * @throws If the provider is unknown or the API key is missing
 */
export function getProvider(providerId: TranslatorProviderId = 'openrouter'): TranslatorProvider {
  if (cachedProvider && cachedProviderId === providerId) {
    return cachedProvider;
  }

  const Constructor = PROVIDER_REGISTRY[providerId];
  if (!Constructor) {
    throw new Error(`Unknown translator provider: ${providerId}`);
  }

  const apiKey = getSetting('OPENROUTER_API_KEY');
  if (!apiKey) {
    throw new Error(`API key for ${providerId} is not configured. Set it in Settings.`);
  }

  const model = getModel(providerId);
  const config: TranslatorConfig = {
    apiKey,
    model: model || undefined,
  };

  cachedProvider = new Constructor(config);
  cachedProviderId = providerId;
  return cachedProvider;
}

/**
 * Reset the cached provider instance and API client.
 * Call this after settings (API key, proxy) are changed.
 */
export function resetProvider(): void {
  cachedProvider = null;
  cachedProviderId = null;
  resetClient();
}

/**
 * Get a list of all available provider IDs and their display names.
 */
export function getAvailableProviders(): Array<{ id: TranslatorProviderId; name: string }> {
  // Instantiate a lightweight instance just to read the name
  // (we don't call the constructor since we may not have an API key yet)
  const nameMap: Record<TranslatorProviderId, string> = {
    openrouter: 'OpenRouter',
  };

  return (Object.keys(PROVIDER_REGISTRY) as TranslatorProviderId[]).map((id) => ({
    id,
    name: nameMap[id] || id,
  }));
}

export type { TranslatorProvider, TranslatorProviderId, TranslatorConfig } from './types';