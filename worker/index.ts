import { routeAgentRequest } from "agents";
import { PolymathAgent } from "./agent";
import { ResearchWorkflow } from "./workflow";

// Mock Sandbox for local dev/preview if needed, or import if available.
// The Sandbox SDK might not export the class directly for us to extend,
// but the wrangler error says "not exported in your entrypoint".
// It seems I need to export the class that corresponds to "Sandbox".
// Since I defined `class_name: "Sandbox"` in wrangler.jsonc,
// I need to export a class named "Sandbox".
// But the Sandbox SDK usually provides this.
// Let's try to import it from @cloudflare/sandbox?
// Or maybe I just need to define a dummy one if it's a container DO?
// The docs said: "migrations - Initialize the Durable Object class."
// And "class_name: Sandbox".
// Wait, if it's a container DO, the system handles it?
// The error says "Your Worker depends on ... Sandbox ... not exported".
// This implies I need to export it.

// Let's check if @cloudflare/sandbox exports a Sandbox class.
// Since I can't check node_modules, I'll try to import it.
// If not, I might have to define a proxy class.

// Re-reading the docs snippet:
// "class_name": "Sandbox", "image": "./Dockerfile"
// And in DO bindings: "class_name": "Sandbox"
// And migrations: "new_sqlite_classes": ["Sandbox"]? No, the snippet had "new_sqlite_classes": ["Sandbox"].
// This implies it's a DO.
// Maybe I need to export `export { Sandbox } from "@cloudflare/sandbox";`?

// Let's try to find where Sandbox is exported.
// I'll try to export a dummy class for now to see if it works, or import from package.

import { Sandbox } from "@cloudflare/sandbox";

export { PolymathAgent, ResearchWorkflow, Sandbox };

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    // 1. Handle Agent interactions (WebSocket/HTTP)
    const agentResponse = await routeAgentRequest(request, env);
    if (agentResponse) return agentResponse;

    // 2. Standard API fallback
    if (request.url.endsWith("/health")) {
      return Response.json({ status: "healthy", region: request.cf?.colo });
    }

    return new Response("Not Found", { status: 404 });
  },
};
