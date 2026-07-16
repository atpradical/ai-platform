import { StateGraph, Annotation, START, END } from '@langchain/langgraph';
import { MemorySaver } from '@langchain/langgraph-checkpoint';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';

// State — the data structure that is accumulated and passed between nodes.
// Annotation defines how updates from different nodes are merged into the state.
// (reducer-func, like in Redux) — overwrites state by default.

// State is the shared data structure that is accumulated and passed between nodes.
// Annotation defines how updates from different nodes are merged into the state.
// By default, a channel is overwritten with the latest value unless a reducer is provided.
const SupportState = Annotation.Root({
  complaint: Annotation<string>(),
  draftReply: Annotation<string>(),
  approved: Annotation<boolean | null>({
    reducer: (_prev, next) => next, // Defines how updates for this channel are merged (similar to a Redux reducer).
    default: () => null, // Provides the initial value when a new state is created.
  }),
  finalReply: Annotation<string | null>({
    reducer: (_prev, next) => next,
    default: () => null,
  }),
});

type SupportStateType = typeof SupportState.State;

export function buildSupportGraph(model: BaseChatModel) {
  // Node 1: generated draft for client's answer on a claim
  async function draftReplyNode(state: SupportStateType) {
    const response = await model.invoke([
      new SystemMessage(
        "You are a polite customer support agent. Write a short reply to the customer's complaint.",
      ),
      new HumanMessage(state.complaint),
    ]);
    return { draftReply: response.content as string };
  }

  // с тем же thread_id и явно переданным решением человека.
  // Node 2: human-in-the-loop checkpoint.
  // The interrupt() function pauses graph execution and returns control to the caller.
  // The graph will resume only when it is invoked again with the same thread_id
  // and a human decision provided as input.
  async function humanApprovalNode(state: SupportStateType) {
    // In a real implementation, this node would call interrupt() from @langchain/langgraph.
    // On the first execution, the graph stops at this point and returns the current state
    // to the outside world (for example, to show an approval UI to a user).
    //
    // After the user approves or rejects the action, the graph continues from this node
    // using the saved state and the provided human decision.
    return {};
  }

  // This function represents a conditional edge (router) in the graph.
  // checks state.approved and decides where the graph should go next
  function routeAfterApproval(
    state: SupportStateType,
  ): 'sendReply' | 'draftReply' {
    return state.approved ? 'sendReply' : 'draftReply';
  }

  // Node 3: "send reply"
  async function sendReplyNode(state: SupportStateType) {
    return { finalReply: state.draftReply };
  }

  // creates graph with working state = SupportState
  const graph = new StateGraph(SupportState)
    // if comes to node 'draftReply' => func 'draftReplyNode' is called
    .addNode('draftReplyNode', draftReplyNode)
    .addNode('humanApproval', humanApprovalNode)
    .addNode('sendReply', sendReplyNode)

    // Graph entry point start => move to 'draftReply' node
    .addEdge(START, 'draftReplyNode')
    // After completing 'draftReply', move to 'humanApproval' node.
    .addEdge('draftReplyNode', 'humanApproval')

    // after 'humanApproval',based on the current state, decide:
    // If 'sendReply' -> go to sendReply node.
    // If 'draftReply' -> go back to draftReply node.
    .addConditionalEdges('humanApproval', routeAfterApproval, {
      sendReply: 'sendReply',
      draftReply: 'draftReplyNode',
    })
    // after 'sendReply' -> finish
    .addEdge('sendReply', END);

  const checkpointer = new MemorySaver();

  // human in loop: stops before 'humanApproval'
  return graph.compile({ checkpointer, interruptBefore: ['humanApproval'] });
}
