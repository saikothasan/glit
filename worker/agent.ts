import { Agent } from "agents";
import { z } from "zod";
import { executeCodeStream, listFiles, exposePreview } from "./tools/sandbox";

export class PolymathAgent extends Agent<Env> {
  // Use a capable model
  readonly model = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";

  readonly tools = {
    runCode: {
      description: "Execute Python code. Output is streamed live to the user's terminal.",
      parameters: z.object({
        code: z.string().describe("The Python code to execute")
      }),
      execute: async (args: { code: string }) => {
        // Pass the broadcast method to the tool
        return await executeCodeStream(this.env, args.code, (msg) => this.broadcast(msg));
      }
    },
    listFiles: {
      description: "List files in the current directory.",
      parameters: z.object({ path: z.string().default(".") }),
      execute: async (args: { path: string }) => await listFiles(this.env, args.path)
    },
    startPreview: {
      description: "Expose a port to preview a web server.",
      parameters: z.object({ port: z.number() }),
      execute: async (args: { port: number }) => {
        const url = await exposePreview(this.env, args.port);
        this.broadcast({ type: "preview_ready", data: url });
        return `Preview available at: ${url}`;
      }
    },
    startResearch: {
      description: "Start a background research workflow.",
      parameters: z.object({ query: z.string() }),
      execute: async (args: { query: string }) => {
        const run = await this.env.RESEARCH_WORKFLOW.create({
          params: { query: args.query, depth: 3, agentId: this.state.id.toString() }
        });
        return `Research job started (ID: ${run.id}). Results will arrive shortly.`;
      }
    }
  };

  async onChatMessage(message: string) {
    const history = await this.sql`SELECT * FROM messages ORDER BY created_at DESC LIMIT 15`;
    const messages = history.reverse().map((row: any) => ({
      role: row.role,
      content: row.content
    }));

    const systemPrompt = `You are Polymath, a live coding assistant.
    - When you run code, the output appears in the user's terminal instantly.
    - If writing a web server, write the code, run it (e.g., python -m http.server), then use startPreview.
    - Always check files after creation.`;

    const response = await this.env.AI.run(this.model, {
      messages: [
        { role: "system", content: systemPrompt },
        ...messages,
        { role: "user", content: message }
      ],
      tools: Object.keys(this.tools).map(k => ({
        name: k,
        description: (this.tools as any)[k].description,
        parameters: (this.tools as any)[k].parameters
      }))
    });

    let finalResponse = "";

    // Handle Tool Calls
    // @ts-ignore
    if (response.tool_calls?.length > 0) {
      // @ts-ignore
      const call = response.tool_calls[0];
      const result = await (this.tools as any)[call.name].execute(call.arguments);

      const secondResponse = await this.env.AI.run(this.model, {
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
          { role: "user", content: message },
          { role: "assistant", tool_calls: [call] },
          { role: "tool", content: JSON.stringify(result), name: call.name }
        ]
      });
      // @ts-ignore
      finalResponse = secondResponse.response;
    } else {
      // @ts-ignore
      finalResponse = response.response;
    }

    await this.sql`INSERT INTO messages (role, content) VALUES ('user', ${message}), ('assistant', ${finalResponse})`;
    return finalResponse;
  }
}
