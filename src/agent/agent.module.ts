import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { RagModule } from '../rag/rag.module';
import { AgentService } from './agent.service';
import { AgentController } from './agent.controller';

@Module({
  imports: [AiModule, RagModule],
  controllers: [AgentController],
  providers: [AgentService],
})
export class AgentModule {}
