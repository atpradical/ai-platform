import { Inject, Injectable } from '@nestjs/common';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { buildSupportGraph } from './support-graph';
import { CHAT_MODEL } from '../ai/constants';

@Injectable()
export class GraphService {
  private readonly graph;

  constructor(
    @Inject(CHAT_MODEL)
    model: BaseChatModel,
  ) {
    this.graph = buildSupportGraph(model);
  }

  // step 1: execute graph, flow: go to draftReply -> generated draft -> stop at interruptBefore -> return current state,
  async startComplaint(threadId: string, complaint: string) {
    const config = {
      configurable: {
        thread_id: threadId,
      },
    };
    // contains draftReply, approved: null —> freezed at this point
    return this.graph.invoke({ complaint }, config);
  }

  // step 2: Human check draft and decide -> Graph continues
  // thread_id links to current state (persistence)
  async resolveApproval(threadId: string, approved: boolean) {
    const config = { configurable: { thread_id: threadId } };

    // updateState before continue
    await this.graph.updateState(config, { approved });

    // invoke(null, ...) — continue graph execution from stopped point
    return this.graph.invoke(null, config);
  }
}
