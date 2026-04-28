import type { LLMProvider } from './types.js';
// import { AnthropicProvider } from './anthropic.js'; // Comentado: @anthropic-ai/sdk no está instalado
import { OpenAIProvider } from './openai.js';
import { OllamaProvider } from './ollama.js';

let providerInstance: LLMProvider | null = null;

class LLMConfigError extends Error {
  statusCode = 503;
  code = 'LLM_NOT_CONFIGURED';
  constructor(message: string) {
    super(message);
    this.name = 'LLMConfigError';
  }
}

export function createLLMProvider(): LLMProvider {
  // Return cached instance if already created
  if (providerInstance) {
    return providerInstance;
  }

  const provider = process.env.LLM_PROVIDER?.toLowerCase() || 'openai';

  switch (provider) {
    case 'groq': {
      const apiKey = process.env.GROQ_API_KEY;
      if (!apiKey) {
        throw new LLMConfigError(
          'IA no configurada: falta GROQ_API_KEY. Configurá la variable de entorno para habilitar el asistente IA.'
        );
      }
      const model = process.env.GROQ_MODEL || 'llama-3.1-8b-instant';
      // Groq usa API compatible con OpenAI
      providerInstance = new OpenAIProvider(apiKey, 'https://api.groq.com/openai/v1', model);
      break;
    }
    case 'openai': {
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        throw new LLMConfigError(
          'IA no configurada: falta OPENAI_API_KEY. Configurá la variable de entorno para habilitar auditorías IA.'
        );
      }
      providerInstance = new OpenAIProvider(apiKey);
      break;
    }
    case 'ollama': {
      const model = process.env.OLLAMA_MODEL || 'llama3.1';
      const baseURL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434/v1';
      providerInstance = new OllamaProvider(model, baseURL);
      break;
    }
    case 'anthropic':
    default: {
      throw new LLMConfigError(
        `LLM_PROVIDER '${provider}' no está disponible. Usa 'groq', 'openai' u 'ollama'.`
      );
    }
  }

  return providerInstance;
}

/**
 * Reset the provider instance. Useful for testing.
 */
export function resetLLMProvider(): void {
  providerInstance = null;
}
