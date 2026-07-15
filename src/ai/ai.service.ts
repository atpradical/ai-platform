import { Inject, Injectable } from '@nestjs/common';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { StructuredOutputParser } from '@langchain/core/output_parsers';
import { z } from 'zod';
import { Idea } from './interfaces';
import { CHAT_MODEL } from './constants';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';

// ZOD validated, expected Model's response output schema.
const ideaSchema = z.object({
  title: z.string().describe('Idea title'),
  description: z.string().describe('One short sentence'),
  difficulty: z.enum(['easy', 'medium', 'hard']).describe('difficulty level'),
});

@Injectable()
export class AiService {
  private readonly parser: StructuredOutputParser<typeof ideaSchema>;
  private readonly promptTemplate: ChatPromptTemplate;

  constructor(
    @Inject(CHAT_MODEL)
    private readonly model: BaseChatModel,
  ) {
    // Output Parser: describes expected structure and generates text instruction for model response format
    this.parser = StructuredOutputParser.fromZodSchema(ideaSchema);

    // Prompt: template with placeholders {topic} and {format_instructions}
    this.promptTemplate = ChatPromptTemplate.fromTemplate(
      `Imagine a pet-project idea about "{topic}.". 
      {format_instructions}`,
    );
  }

  async generateIdea(topic: string): Promise<Idea> {
    // 1: construct final prompt
    const format_instructions = this.parser.getFormatInstructions();

    console.log(
      'format_instructions:',
      JSON.stringify(format_instructions, null, 2),
    );

    const prompt = await this.promptTemplate.invoke({
      topic,
      format_instructions,
    });

    console.log('prompt:', JSON.stringify(prompt, null, 2));

    // 2: execute model with final prompt
    const response = await this.model.invoke(prompt);

    // 3: return parsed raw model's answer into typed Idea object
    const parsed = await this.parser.parse(response.content as string);

    console.log('model answer:', JSON.stringify(parsed, null, 2));
    return parsed;
  }
}
