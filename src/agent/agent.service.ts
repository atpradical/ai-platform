import { Inject, Injectable } from '@nestjs/common';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { tool } from '@langchain/core/tools';
import { createReactAgent } from '@langchain/langgraph/prebuilt';
import { z } from 'zod';
import { RagService } from '../rag/rag.service';
import { CHAT_MODEL } from '../ai/constants';

@Injectable()
export class AgentService {
  constructor(
    @Inject(CHAT_MODEL)
    private readonly model: BaseChatModel,
    private readonly ragService: RagService,
  ) {}

  private buildTools() {
    // tool 1: calculator.
    // attention: Description - only one place for a model to decide whether it should use it.
    const calculatorTool = tool(
      async ({ expression }: { expression: string }) => {
        // do not use in prod to avoid code injections.
        try {
          const result = eval(expression);
          return `Result: ${result}`;
        } catch {
          return 'Error: expression calculation failed.';
        }
      },
      {
        name: 'calculator',
        description:
          'Calculates math expression. Use it when user asks to calc something. ' +
          'Argument is an arithmetical string expression like "15 * 4 + 2".',
        schema: z.object({
          expression: z.string().describe('Math expression for calculation'),
        }),
      },
    );

    // tool 2: RAG-service wrapper.
    // Agent decides itself when to use it.
    const knowledgeBaseTool = tool(
      async ({ question }: { question: string }) => {
        const result = await this.ragService.ask(question);
        return result.answer;
      },
      {
        name: 'search_knowledge_base',
        description:
          'Search answer in company knowledge base (delivery, returns, payment, warranty).' +
          "Use this when the question concerns the store's policy or terms of service.",
        schema: z.object({
          question: z.string().describe('Question to search in knowledge base'),
        }),
      },
    );

    return [calculatorTool, knowledgeBaseTool];
  }

  async run(userMessage: string) {
    const agent = createReactAgent({
      llm: this.model,
      tools: this.buildTools(),
    });

    const result = await agent.invoke({
      messages: [{ role: 'user', content: userMessage }],
    });

    // result.messages — the entire history of the loop: the question, calls to tools,
    // their results, and the final answer. We're interested in the last message.
    const lastMessage = result.messages[result.messages.length - 1];

    return { answer: lastMessage.content };
  }
}
