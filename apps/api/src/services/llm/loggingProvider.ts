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

  async chat(messages: LLMMessage[], maxTokens?: number, jsonMode?: boolean): Promise<LLMResponse> {
    const promptLen = messages.reduce((s, m) => s + m.content.length, 0);
    const response = await this.inner.chat(messages, maxTokens, jsonMode);

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
    }).catch((e: any) => { console.error('[AIUsageLog] insert failed:', e?.message); });

    return response;
  }

  async *chatStream(messages: LLMMessage[], maxTokens?: number): AsyncGenerator<LLMStreamChunk> {
    const promptLen = messages.reduce((s, m) => s + m.content.length, 0);
    let totalText = '';
    for await (const chunk of this.inner.chatStream!(messages, maxTokens)) {
      if (!chunk.done) totalText += chunk.text;
      yield chunk;
    }
    // Log after stream completes — estimate tokens from chars (~4 chars per token)
    const estimatedTokens = Math.ceil((promptLen + totalText.length) / 4);
    this.prisma.aIUsageLog.create({
      data: {
        tenantId: this.tenantId,
        userId: this.userId,
        module: this.module,
        model: 'stream',
        tokensUsed: estimatedTokens,
        promptLen,
      },
    }).catch((e: any) => { console.error('[AIUsageLog] stream insert failed:', e?.message); });
  }
}
