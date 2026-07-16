import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { GraphService } from './graph.service';
import { GraphController } from './graph.controller';

@Module({
  imports: [AiModule],
  controllers: [GraphController],
  providers: [GraphService],
})
export class GraphModule {}
