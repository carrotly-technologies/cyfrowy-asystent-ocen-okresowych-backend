import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export const LLM_TIMEOUT_MS = 30_000;

/**
 * Minimal client for any OpenAI-compatible chat endpoint (Ollama, Groq,
 * OpenRouter, LM Studio, vLLM...). Configured by LLM_BASE_URL, LLM_API_KEY and
 * LLM_MODEL; without LLM_BASE_URL and LLM_MODEL it reports itself as not
 * configured and the assistant answers extractively.
 */
@Injectable()
export class LlmClient {
  private readonly logger = new Logger(LlmClient.name);
  private readonly baseUrl?: string;
  private readonly apiKey?: string;
  private readonly model?: string;

  constructor(config: ConfigService) {
    this.baseUrl = config.get<string>('LLM_BASE_URL')?.replace(/\/+$/, '');
    this.apiKey = config.get<string>('LLM_API_KEY');
    this.model = config.get<string>('LLM_MODEL');
  }

  get configured(): boolean {
    return Boolean(this.baseUrl && this.model);
  }

  /** Returns the reply text, or null when not configured or the call fails. */
  async chat(messages: ChatMessage[]): Promise<string | null> {
    if (!this.configured) return null;
    try {
      const res = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(this.apiKey ? { authorization: `Bearer ${this.apiKey}` } : {}),
        },
        body: JSON.stringify({
          model: this.model,
          messages,
          temperature: 0.1,
          max_tokens: 900,
        }),
        signal: AbortSignal.timeout(LLM_TIMEOUT_MS),
      });
      if (!res.ok) {
        this.logger.warn(
          `LLM HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`,
        );
        return null;
      }
      const data = (await res.json()) as {
        choices?: { message?: { content?: string } }[];
      };
      const text = data.choices?.[0]?.message?.content?.trim();
      return text ? text : null;
    } catch (error) {
      this.logger.warn(`LLM call failed: ${String(error)}`);
      return null;
    }
  }
}
