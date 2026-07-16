import { Controller, Get, Query } from '@nestjs/common';
import { RagService } from './rag.service';

@Controller('rag')
export class RagController {
  constructor(private readonly ragService: RagService) {}

  @Get('ask')
  async ask(@Query('question') question: string) {
    return this.ragService.ask(question);
  }
}
