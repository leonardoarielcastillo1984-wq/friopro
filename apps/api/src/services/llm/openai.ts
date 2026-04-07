import OpenAI from 'openai';
import type { LLMMessage, LLMProvider, LLMResponse } from './types.js';

export class OpenAIProvider implements LLMProvider {
  private client: OpenAI;
  private model: string;

  constructor(apiKey: string, model: string = 'gpt-4-turbo') {
    this.client = new OpenAI({ apiKey });
    this.model = model;
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
}
