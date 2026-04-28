import OpenAI from 'openai';
import type { LLMMessage, LLMProvider, LLMResponse, LLMStreamChunk } from './types.js';

export class OpenAIProvider implements LLMProvider {
  private client: OpenAI;
  private model: string;

  constructor(apiKey: string, baseURL?: string, model?: string) {
    const config: { apiKey: string; baseURL?: string } = { apiKey };
    if (baseURL) config.baseURL = baseURL;
    this.client = new OpenAI(config);
    this.model = model || 'gpt-4-turbo';
  }

  async chat(
    messages: LLMMessage[],
    maxTokens: number = 1024
  ): Promise<LLMResponse> {
    const response = await this.client.chat.completions.create({
      model: this.model,
      max_tokens: maxTokens,
      messages: messages.map((msg) => ({
        role: msg.role,
        content: msg.content,
      })),
    });

    // Extract text from the first choice
    const textContent =
      response.choices[0]?.message?.content || '';

    return {
      text: textContent,
      tokensUsed: response.usage?.total_tokens || 0,
      model: this.model,
    };
  }

  async *chatStream(
    messages: LLMMessage[],
    maxTokens: number = 1024
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
