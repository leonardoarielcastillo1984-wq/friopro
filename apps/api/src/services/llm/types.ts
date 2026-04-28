export interface LLMMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface LLMResponse {
  text: string;
  tokensUsed: number;
  model: string;
}

export interface LLMStreamChunk {
  text: string;
  done: boolean;
}

export interface LLMProvider {
  chat(messages: LLMMessage[], maxTokens?: number): Promise<LLMResponse>;
  chatStream?(messages: LLMMessage[], maxTokens?: number): AsyncGenerator<LLMStreamChunk>;
}
