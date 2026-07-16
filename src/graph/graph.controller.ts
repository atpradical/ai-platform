import { Body, Controller, Post } from '@nestjs/common';
import { GraphService } from './graph.service';

@Controller('graph')
export class GraphController {
  constructor(private readonly graphService: GraphService) {}

  @Post('complaint')
  async startComplaint(@Body() body: { threadId: string; complaint: string }) {
    return this.graphService.startComplaint(body.threadId, body.complaint);
  }

  @Post('approve')
  async approve(@Body() body: { threadId: string; approved: boolean }) {
    return this.graphService.resolveApproval(body.threadId, body.approved);
  }
}
