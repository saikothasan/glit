import { routeAgentRequest } from "agents";
import { PolymathAgent } from "./agent";
import { ResearchWorkflow } from "./workflow";
import { Sandbox } from "@cloudflare/sandbox"; // Import the class

// Export ALL Durable Objects classes here
export { PolymathAgent, ResearchWorkflow, Sandbox };

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const agentResponse = await routeAgentRequest(request, env);
    if (agentResponse) return agentResponse;
    return new Response("Not Found", { status: 404 });
  },
};
