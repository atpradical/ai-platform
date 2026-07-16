import { Controller, Get, Query, Sse } from '@nestjs/common';
import { AiService } from './ai.service';
import { Idea } from './interfaces';
import { Observable } from 'rxjs';

@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Get('idea')
  async getIdea(@Query('topic') topic: string): Promise<Idea> {
    return this.aiService.generateIdea(topic ?? 'web-development');
  }

  @Sse('stream')
  streamAnswer(@Query('question') question: string): Observable<MessageEvent> {
    return new Observable((subscriber) => {
      (async () => {
        const stream = await this.aiService.streamAnswer(question);

        for await (const chunk of stream) {
          subscriber.next({ data: chunk.content } as MessageEvent);
        }

        subscriber.complete();
      })();
    });
  }
}
