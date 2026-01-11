import { routeAgentRequest } from "agents";
import { PolymathAgent } from "./agent";
import { ResearchWorkflow } from "./workflow";
import { Sandbox } from "@cloudflare/sandbox";

// Explicitly export all classes required by Durable Objects bindings
export { PolymathAgent, ResearchWorkflow, Sandbox };

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    // 1. Handle Agent interactions
    const agentResponse = await routeAgentRequest(request, env);
    if (agentResponse) return agentResponse;

    // 2. Standard API fallback
    if (request.url.endsWith("/health")) {
      return Response.json({ status: "healthy", region: request.cf?.colo });
    }

    return new Response("Not Found", { status: 404 });
  },
};
