import { Controller, Get, Query } from '@nestjs/common';
import { AiService } from './ai.service';
import { Idea } from './interfaces';

@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Get('idea')
  async getIdea(@Query('topic') topic: string): Promise<Idea> {
    return this.aiService.generateIdea(topic ?? 'web-development');
  }
}
