import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { RagService } from './rag.service';
import { RagController } from './rag.controller';
import { AiModule } from '../ai/ai.module';
import { CHAT_MODEL } from '../ai/constants';
import { ChatOpenAI } from '@langchain/openai'; // переиспользуем CHAT_MODEL из AiModule

@Module({
  imports: [ConfigModule, AiModule],
  controllers: [RagController],
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
    RagService,
  ],
})
export class RagModule {}
