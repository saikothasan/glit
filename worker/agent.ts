import { Agent } from "agents";
import { z } from "zod";
import { executeCode } from "./tools/sandbox";

export class PolymathAgent extends Agent<Env> {
  // Use a fast, accurate model for general conversation
  readonly model = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";

  // Define capability tools
  readonly tools = {
    /**
     * Tool 1: The Engineer (Sandbox)
     * Executes code safely to solve math, data, or logic problems.
     */
    runCode: {
      description: "Execute Python code. Use this for math, data analysis, or complex logic. Returns stdout.",
      parameters: z.object({
        code: z.string().describe("The Python code to execute"),
        dependencies: z.array(z.string()).optional().describe("Pip packages to install (e.g. ['numpy', 'pandas'])")
      }),
      execute: async (args: { code: string; dependencies?: string[] }) => {
        try {
          return await executeCode(this.env, args.code);
        } catch (err: any) {
          return `Error executing code: ${err.message}`;
        }
      }
    },

    /**
     * Tool 2: The Researcher (Workflow)
     * Offloads deep research to a background workflow to avoid timeouts.
     */
    startResearch: {
      description: "Start a deep research task for complex queries requiring web browsing. Returns a Job ID.",
      parameters: z.object({
        query: z.string().describe("The topic to research"),
        depth: z.number().default(3).describe("Number of pages to browse")
      }),
      execute: async (args: { query: string; depth: number }) => {
        // Access ID from state (standard Durable Object pattern)
        // If Agent class exposes this.id, great, otherwise use this.state.id
        const agentId = this.state?.id?.toString() || "unknown";

        const run = await this.env.RESEARCH_WORKFLOW.create({
          params: { 
            query: args.query, 
            depth: args.depth, 
            agentId: agentId
          }
        });
        return `Research started. Job ID: ${run.id}. Tell the user you are researching and will report back shortly.`;
      }
    }
  };

  /**
   * Handle incoming user messages.
   * The 'agents' SDK automatically manages history in SQLite.
   */
  async onChatMessage(message: string) {
    const history = await this.sql`SELECT * FROM messages ORDER BY created_at DESC LIMIT 15`;
    const messages = history.reverse().map((row: any) => ({
      role: row.role,
      content: row.content
    }));

    // Manually calling AI since runAI might not be on the base class
    // We use the tools defined above.
    // Note: To support tool calling properly, we need to loop or use a library that handles it.
    // For simplicity/robustness here, we'll do a simple run with tools if supported,
    // or just prompt.
    // Workers AI supports tools.

    // We'll use a simple implementation that calls the model.
    // Ideally, we'd use a helper from @cloudflare/ai-utils if available.

    const systemPrompt = "You are Polymath, a helpful AI agent with access to a code interpreter (Python) and a deep research workflow. Use them when needed.";

    const response = await this.env.AI.run(this.model, {
      messages: [
        { role: "system", content: systemPrompt },
        ...messages,
        { role: "user", content: message }
      ],
      tools: [
        {
            name: "runCode",
            description: this.tools.runCode.description,
            parameters: {
                type: "object",
                properties: {
                    code: { type: "string", description: "The Python code to execute" },
                    dependencies: { type: "array", items: { type: "string" }, description: "Pip packages" }
                },
                required: ["code"]
            }
        },
        {
            name: "startResearch",
            description: this.tools.startResearch.description,
            parameters: {
                type: "object",
                properties: {
                    query: { type: "string", description: "The topic to research" },
                    depth: { type: "number", description: "Number of pages to browse" }
                },
                required: ["query"]
            }
        }
      ]
    });

    // Handle tool calls if any
    // This is a simplified handler. Real implementation needs a loop.
    let finalResponse = "";
    if ((response as any).tool_calls && (response as any).tool_calls.length > 0) {
        const toolCall = (response as any).tool_calls[0];
        const toolName = toolCall.name;
        const toolArgs = toolCall.arguments;

        let toolResult = "";
        if (toolName === "runCode") {
             toolResult = await this.tools.runCode.execute(toolArgs);
        } else if (toolName === "startResearch") {
             toolResult = await this.tools.startResearch.execute(toolArgs);
        }

        // Feed result back to LLM
        const secondResponse = await this.env.AI.run(this.model, {
             messages: [
                { role: "system", content: systemPrompt },
                ...messages,
                { role: "user", content: message },
                { role: "assistant", tool_calls: [toolCall] }, // This format depends on the specific model/API
                { role: "tool", content: toolResult, name: toolName }
             ]
        });
        finalResponse = (secondResponse as any).response;
    } else {
        finalResponse = (response as any).response;
    }

    await this.sql`INSERT INTO messages (role, content) VALUES ('user', ${message}), ('assistant', ${finalResponse})`;
    return finalResponse;
  }

  /**
   * Called by the Workflow when research is complete.
   * This allows the agent to asynchronously notify the user.
   */
  async reportResearchResults(report: string) {
    // Save to history so the context is available
    await this.sql`INSERT INTO messages (role, content) VALUES ('system', ${`Research Complete: ${report}`})`;

    // Broadcast via WebSocket to connected clients
    // Ensure broadcast exists or implement a fallback
    if (typeof this.broadcast === 'function') {
        this.broadcast({
            type: "research_complete",
            content: report
        });
    }
  }

  // Handle internal callbacks from Workflow
  async fetch(request: Request) {
    const url = new URL(request.url);
    if (url.pathname === "/internal/report" && request.method === "POST") {
        const { report } = await request.json() as { report: string };
        await this.reportResearchResults(report);
        return new Response("OK");
    }
    // Fallback to default Agent handling (WebSockets, etc.)
    return super.fetch(request);
  }
}
