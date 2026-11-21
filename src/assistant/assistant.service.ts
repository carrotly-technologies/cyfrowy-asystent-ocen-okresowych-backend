import { Injectable } from '@nestjs/common';
import type { CaseDetail, StageId } from '../cases/case.types.js';
import { CasesService } from '../cases/cases.service.js';
import {
  asksForRatingDecision,
  buildMessages,
  RATING_REFUSAL,
  excerptLines,
  extractiveAnswer,
  retrieve,
  type Retrieval,
  sanitizeCitations,
  saysNotFound,
  toSources,
} from './answer.rules.js';
import type { AskInput } from './assistant.schemas.js';
import { type AskResponse, DISCLAIMER, NOT_FOUND } from './assistant.types.js';
import {
  CONVERSATION_ADDENDUM,
  caseContext,
  conversationTemplate,
  STAGE_RULE_QUERY,
  STAGE_SUGGESTIONS,
} from './conversation.rules.js';
import { KnowledgeBase } from './knowledge-base.js';
import { quickAnswer } from './quick-answers.rules.js';
import { LlmClient } from './llm.client.js';

@Injectable()
export class AssistantService {
  private readonly kb = new KnowledgeBase();

  constructor(
    private readonly llm: LlmClient,
    private readonly cases: CasesService,
  ) {}

  suggestions(stageId?: StageId): string[] {
    return STAGE_SUGGESTIONS[stageId ?? 'GENERAL'];
  }

  async ask(input: AskInput): Promise<AskResponse> {
    // Scoped: only a case the caller may open (403 otherwise).
    const detail = input.caseId ? await this.cases.view(input.caseId) : null;
    const quick = quickAnswer(input.question, detail);
    if (quick) return this.quick(quick.text, quick.rule.sourceQuery);
    if (input.assistant === 'CONVERSATION' && detail) {
      return this.conversation(input, detail);
    }
    return this.formal(input.question);
  }

  /** A rule-based short answer (quick-answers.rules.ts) with the excerpts it rests on. */
  private quick(summary: string, sourceQuery: string): AskResponse {
    const retrieval = retrieve(this.kb, sourceQuery);
    const sources = toSources(retrieval.hits, sourceQuery);
    const lines = sources.length
      ? ['', 'Na podstawie:', ...excerptLines(sources)]
      : [];
    return {
      answer: [summary, ...lines].join('\n'),
      summary,
      grounded: true,
      mode: 'EXTRACTIVE',
      sources,
      disclaimer: DISCLAIMER,
    };
  }

  private async formal(question: string): Promise<AskResponse> {
    const ratingRequest = asksForRatingDecision(question);
    // A "which rating should I give" question is answered with the rules.
    const retrieval = retrieve(
      this.kb,
      ratingRequest
        ? `${question} skala ocen cząstkowych poziom spełniania kryteriów`
        : question,
    );
    const sources = toSources(retrieval.hits, question);
    if (!retrieval.grounded) {
      return {
        answer: NOT_FOUND,
        grounded: false,
        mode: 'EXTRACTIVE',
        sources: [],
        disclaimer: DISCLAIMER,
      };
    }
    const reply = await this.llm.chat(buildMessages(question, retrieval.hits));
    if (reply) {
      const notFound = saysNotFound(reply);
      return {
        answer:
          (ratingRequest ? `${RATING_REFUSAL}\n\n` : '') +
          (notFound ? NOT_FOUND : sanitizeCitations(reply, sources.length)),
        grounded: !notFound,
        mode: 'LLM',
        sources: notFound ? [] : sources,
        disclaimer: DISCLAIMER,
      };
    }
    return {
      ...extractiveAnswer(question, retrieval, sources),
      grounded: true,
      mode: 'EXTRACTIVE',
      sources,
      disclaimer: DISCLAIMER,
    };
  }

  private async conversation(
    input: AskInput,
    detail: CaseDetail,
  ): Promise<AskResponse> {
    const stage = input.stageId ?? detail.currentStage;
    let retrieval: Retrieval = retrieve(this.kb, input.question);
    if (!retrieval.grounded) {
      retrieval = retrieve(this.kb, STAGE_RULE_QUERY[stage]);
    }
    const sources = toSources(retrieval.hits, input.question);
    const messages = buildMessages(
      input.question,
      retrieval.hits,
      caseContext(detail, stage),
    );
    messages[0].content += `\n\n${CONVERSATION_ADDENDUM}`;
    const reply = await this.llm.chat(messages);
    if (reply) {
      return {
        answer: sanitizeCitations(reply, sources.length),
        grounded: retrieval.grounded,
        mode: 'LLM',
        sources,
        disclaimer: DISCLAIMER,
      };
    }
    const rules = excerptLines(sources);
    return {
      answer: [
        conversationTemplate(detail, stage),
        ...(rules.length ? ['', 'Zasady z bazy wiedzy:', ...rules] : []),
      ].join('\n'),
      grounded: retrieval.grounded,
      mode: 'EXTRACTIVE',
      sources,
      disclaimer: DISCLAIMER,
    };
  }
}
