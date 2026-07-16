import { Module } from '@nestjs/common';
import { AiService } from './ai.service';
import { AiController } from './ai.controller';
import { CHAT_MODEL } from './constants';
import { ConfigService } from '@nestjs/config';
import { ChatOpenAI } from '@langchain/openai';

@Module({
  controllers: [AiController],
  providers: [
    {
      provide: CHAT_MODEL,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        return new ChatOpenAI({
          apiKey: config.getOrThrow<string>('OPENAI_API_KEY'),
          model: config.get<string>('OPENAI_MODEL'),
        });
      },
    },
    AiService,
  ],
})
export class AiModule {}
