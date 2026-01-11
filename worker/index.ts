import { routeAgentRequest } from "agents";
import { PolymathAgent } from "./agent";
import { ResearchWorkflow } from "./workflow";

// Export Durable Objects and Workflows so Cloudflare can find them
export { PolymathAgent, ResearchWorkflow };

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    // 1. Handle Agent interactions (WebSocket/HTTP)
    // Routes /agents/PolymathAgent/:id/...
    const agentResponse = await routeAgentRequest(request, env);
    if (agentResponse) return agentResponse;

    // 2. Standard API fallback
    if (request.url.endsWith("/health")) {
      return Response.json({ status: "healthy", region: request.cf?.colo });
    }

    return new Response("Not Found", { status: 404 });
  },
};
