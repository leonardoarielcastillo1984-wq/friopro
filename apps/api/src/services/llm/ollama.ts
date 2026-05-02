import OpenAI from 'openai';
import type { LLMMessage, LLMProvider, LLMResponse, LLMStreamChunk } from './types.js';

/**
 * Ollama provider — uses the OpenAI-compatible API at localhost:11434
 */
export class OllamaProvider implements LLMProvider {
  private client: OpenAI;
  private model: string;

  constructor(
    model: string = 'llama3.1',
    baseURL: string = 'http://localhost:11434/v1',
  ) {
    this.client = new OpenAI({
      apiKey: 'ollama', // Ollama doesn't need a real key
      baseURL,
      timeout: 120000, // 120 segundos para Mistral en CPU
    });
    this.model = model;
  }

  async chat(
    messages: LLMMessage[],
    maxTokens: number = 1024,
  ): Promise<LLMResponse> {
    const response = await this.client.chat.completions.create({
      model: this.model,
      max_tokens: maxTokens,
      messages: messages.map((msg) => ({
        role: msg.role,
        content: msg.content,
      })),
    });

    const textContent = response.choices[0]?.message?.content || '';

    return {
      text: textContent,
      tokensUsed: response.usage?.total_tokens || 0,
      model: this.model,
    };
  }

  async *chatStream(
    messages: LLMMessage[],
    maxTokens: number = 1024,
  ): AsyncGenerator<LLMStreamChunk> {
    const stream = await this.client.chat.completions.create({
      model: this.model,
      max_tokens: maxTokens,
      messages: messages.map((msg) => ({
        role: msg.role,
        content: msg.content,
      })),
      stream: true,
    });

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || '';
      if (content) {
        yield { text: content, done: false };
      }
    }

    yield { text: '', done: true };
  }
}
