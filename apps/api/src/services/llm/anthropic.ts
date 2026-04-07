import Anthropic from '@anthropic-ai/sdk';
import type { LLMMessage, LLMProvider, LLMResponse } from './types.js';

export class AnthropicProvider implements LLMProvider {
  private client: Anthropic;
  private model: string;

  constructor(apiKey: string, model: string = 'claude-sonnet-4-20250514') {
    this.client = new Anthropic({ apiKey });
    this.model = model;
  }

  async chat(
    messages: LLMMessage[],
    maxTokens: number = 1024
  ): Promise<LLMResponse> {
    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: maxTokens,
      messages: messages.map((msg) => ({
        role: msg.role,
        content: msg.content,
      })),
    });

    // Extract text from content blocks
    const textContent = response.content
      .filter((block) => block.type === 'text')
      .map((block) => (block.type === 'text' ? block.text : ''))
      .join('');

    return {
      text: textContent,
      tokensUsed: response.usage.input_tokens + response.usage.output_tokens,
      model: this.model,
    };
  }
}
