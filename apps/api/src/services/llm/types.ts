export interface LLMMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface LLMResponse {
  text: string;
  tokensUsed: number;
  model: string;
}

export interface LLMProvider {
  chat(messages: LLMMessage[], maxTokens?: number): Promise<LLMResponse>;
}
