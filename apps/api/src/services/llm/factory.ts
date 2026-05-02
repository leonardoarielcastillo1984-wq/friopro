import type { LLMProvider } from './types.js';
// import { AnthropicProvider } from './anthropic.js'; // Comentado: @anthropic-ai/sdk no está instalado
import { OpenAIProvider } from './openai.js';
import { OllamaProvider } from './ollama.js';
import { decryptApiKey } from './tenantCrypto.js';

let globalInstance: LLMProvider | null = null;

class LLMConfigError extends Error {
  statusCode = 503;
  code = 'LLM_NOT_CONFIGURED';
  constructor(message: string) {
    super(message);
    this.name = 'LLMConfigError';
  }
}

interface TenantLLMConfig {
  llmProvider?: string | null;
  llmApiKey?: string | null;
  llmModel?: string | null;
  llmBaseUrl?: string | null;
}

function buildProvider(
  provider: string,
  apiKey: string | undefined,
  model: string | undefined,
  baseUrl: string | undefined
): LLMProvider {
  switch (provider) {
    case 'groq': {
      if (!apiKey) {
        throw new LLMConfigError(
          'IA no configurada: falta GROQ_API_KEY. Configurá la variable de entorno o la key del tenant para habilitar el asistente IA.'
        );
      }
      const m = model || 'llama-3.1-8b-instant';
      return new OpenAIProvider(apiKey, 'https://api.groq.com/openai/v1', m);
    }
    case 'openai': {
      if (!apiKey) {
        throw new LLMConfigError(
          'IA no configurada: falta OPENAI_API_KEY. Configurá la variable de entorno o la key del tenant para habilitar auditorías IA.'
        );
      }
      return new OpenAIProvider(apiKey);
    }
    case 'ollama': {
      const m = model || 'llama3.1';
      const url = baseUrl || process.env.OLLAMA_BASE_URL || 'http://localhost:11434/v1';
      return new OllamaProvider(m, url);
    }
    case 'anthropic':
    default: {
      throw new LLMConfigError(
        `LLM_PROVIDER '${provider}' no está disponible. Usa 'groq', 'openai' u 'ollama'.`
      );
    }
  }
}

function createGlobalProvider(): LLMProvider {
  if (globalInstance) return globalInstance;
  const provider = process.env.LLM_PROVIDER?.toLowerCase() || 'openai';
  globalInstance = buildProvider(
    provider,
    process.env.GROQ_API_KEY || process.env.OPENAI_API_KEY,
    process.env.GROQ_MODEL || process.env.OPENAI_MODEL,
    process.env.OLLAMA_BASE_URL
  );
  return globalInstance;
}

/**
 * Create an LLM provider.
 * If a tenant config is passed, it takes priority over global env vars.
 * If tenant has no LLM config, falls back to global env vars.
 */
export function createLLMProvider(tenant?: TenantLLMConfig | null): LLMProvider {
  // No tenant config -> global singleton
  if (!tenant || (!tenant.llmProvider && !tenant.llmApiKey)) {
    return createGlobalProvider();
  }

  const provider = (tenant.llmProvider || process.env.LLM_PROVIDER || 'openai').toLowerCase();
  let apiKey: string | undefined;

  if (tenant.llmApiKey) {
    try {
      apiKey = decryptApiKey(tenant.llmApiKey);
    } catch {
      // If decryption fails (e.g. key stored plain or bad master key), try using raw
      apiKey = tenant.llmApiKey;
    }
  }

  // Fallback to global env if tenant key not set
  if (!apiKey) {
    apiKey = process.env.GROQ_API_KEY || process.env.OPENAI_API_KEY;
  }

  const model = tenant.llmModel || process.env.GROQ_MODEL || process.env.OPENAI_MODEL;
  const baseUrl = tenant.llmBaseUrl || process.env.OLLAMA_BASE_URL;

  return buildProvider(provider, apiKey, model, baseUrl);
}

/**
 * Reset the global provider instance. Useful for testing.
 */
export function resetLLMProvider(): void {
  globalInstance = null;
}
