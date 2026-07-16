import { Controller, Get, Query } from '@nestjs/common';
import { AgentService } from './agent.service';

@Controller('agent')
export class AgentController {
  constructor(private readonly agentService: AgentService) {}

  @Get('ask')
  async ask(@Query('message') message: string) {
    return this.agentService.run(message);
  }
}
