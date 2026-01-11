import { routeAgentRequest } from "agents";
import { PolymathAgent } from "./agent";
import { ResearchWorkflow } from "./workflow";
import { Sandbox } from "@cloudflare/sandbox";

// Export Durable Objects and Workflows so Cloudflare can find them
export { PolymathAgent, ResearchWorkflow, Sandbox };

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const url = new URL(request.url);

    // 1. Chat API for Vercel AI SDK
    if (url.pathname === "/api/chat" && request.method === "POST") {
        const body = await request.json() as any;

        // Get the agent stub (singleton "default" for this demo)
        const id = env.PRIMARY_AGENT.idFromName("default");
        const stub = env.PRIMARY_AGENT.get(id);

        // Call the chat method on the agent
        // Since 'chat' returns a Response object with a stream, we can return it directly.
        // We use `stub.chat(messages)` if we defined RPC, but `Agent` SDK usually routes via fetch.
        // So we can use `stub.fetch` with a special path, OR assuming `routeAgentRequest` handles standard paths.
        // But `routeAgentRequest` handles `agents` SDK paths.
        // We want to call our custom `chat` method.
        // RPC is the best way if methods are exposed.
        // `Agent` class methods are exposed as RPC if configured.
        // Let's assume standard DO behavior: we can call methods if we type the stub.

        // However, passing streams over RPC is tricky.
        // Easier: stub.fetch("/chat", ...) and the Agent's fetch handler calls `this.chat`.

        return stub.fetch("http://internal/chat", {
            method: "POST",
            body: JSON.stringify(body),
            headers: { "Content-Type": "application/json" }
        });
    }

    // 2. Handle Agent interactions (WebSocket/HTTP) via SDK
    // This allows standard Agent connections if needed
    const agentResponse = await routeAgentRequest(request, env);
    if (agentResponse) return agentResponse;

    // 3. Health check
    if (request.url.endsWith("/health")) {
      return Response.json({ status: "healthy", region: request.cf?.colo });
    }

    // 4. Serve Frontend (Assets)
    if (env.ASSETS) {
      return env.ASSETS.fetch(request);
    }

    return new Response("Not Found", { status: 404 });
  },
};
