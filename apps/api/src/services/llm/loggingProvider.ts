import type { LLMMessage, LLMProvider, LLMResponse, LLMStreamChunk } from './types.js';

/**
 * Wraps any LLMProvider to automatically log each call to ai_usage_logs.
 * Falls back silently if the DB write fails — never blocks the chat.
 */
export class LoggingLLMProvider implements LLMProvider {
  constructor(
    private inner: LLMProvider,
    private prisma: any,
    private tenantId: string | null,
    private userId: string | null,
    private module: string,
  ) {}

  async chat(messages: LLMMessage[], maxTokens?: number): Promise<LLMResponse> {
    const promptLen = messages.reduce((s, m) => s + m.content.length, 0);
    const response = await this.inner.chat(messages, maxTokens);

    // Fire-and-forget log — never blocks
    this.prisma.aIUsageLog.create({
      data: {
        tenantId: this.tenantId,
        userId: this.userId,
        module: this.module,
        model: response.model,
        tokensUsed: response.tokensUsed || 0,
        promptLen,
      },
    }).catch(() => { /* ignore */ });

    return response;
  }

  chatStream(messages: LLMMessage[], maxTokens?: number): AsyncGenerator<LLMStreamChunk> {
    return this.inner.chatStream!(messages, maxTokens);
  }
}
