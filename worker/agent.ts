import { Agent } from "agents";
import { z } from "zod";
import { executeCodeStream, listFiles, cloneRepo, exposePreview } from "./tools/sandbox";

export class PolymathAgent extends Agent<Env> {
  readonly model = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";

  readonly tools = {
    runCode: {
      description: "Execute Python code. Output is streamed to the terminal. Can run servers.",
      parameters: z.object({
        code: z.string().describe("Python code")
      }),
      execute: async (args: { code: string }) => {
        // Pass the broadcast function to stream output
        return await executeCodeStream(this.env, args.code, (msg) => this.broadcast(msg));
      }
    },
    startPreview: {
      description: "Expose a port (e.g., 8000) to view a running web server.",
      parameters: z.object({
        port: z.number().default(8000)
      }),
      execute: async (args: { port: number }) => {
        const url = await exposePreview(this.env, args.port);
        this.broadcast({ type: "preview_ready", data: url });
        return `Preview available at: ${url}`;
      }
    },
    gitClone: {
      description: "Clone a git repository.",
      parameters: z.object({ url: z.string() }),
      execute: async (args: { url: string }) => await cloneRepo(this.env, args.url)
    },
    listFiles: {
      description: "List files in directory.",
      parameters: z.object({ path: z.string().default(".") }),
      execute: async (args: { path: string }) => await listFiles(this.env, args.path)
    },
    startResearch: {
      description: "Deep research. Returns Job ID.",
      parameters: z.object({ query: z.string() }),
      execute: async (args: { query: string }) => {
         const run = await this.env.RESEARCH_WORKFLOW.create({ 
           params: { query: args.query, agentId: this.state.id.toString(), depth: 3 } 
         });
         return `Research started (ID: ${run.id}).`;
      }
    }
  };

  async onChatMessage(message: string) {
    const history = await this.sql`SELECT * FROM messages ORDER BY created_at DESC LIMIT 15`;
    const messages = history.reverse().map((row: any) => ({ role: row.role, content: row.content }));
    
    const systemPrompt = `You are Polymath, a full-stack AI engineer. 
    - You can run Python code. Real-time output is shown in the terminal.
    - To build web apps: write the code, run 'python -m http.server 8000', then use startPreview(8000).
    - Always check files (listFiles) after writing them.`;

    // 1. AI Decision
    const response = await this.env.AI.run(this.model, {
      messages: [{ role: "system", content: systemPrompt }, ...messages, { role: "user", content: message }],
      tools: Object.keys(this.tools).map(k => ({ 
        name: k, 
        description: (this.tools as any)[k].description, 
        parameters: (this.tools as any)[k].parameters 
      }))
    });

    let finalContent = "";
    
    // 2. Tool Execution (Single Loop)
    // @ts-ignore - CF AI types workaround
    if (response.tool_calls?.length) {
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
       finalContent = secondResponse.response;
    } else {
       // @ts-ignore
       finalContent = response.response;
    }

    await this.sql`INSERT INTO messages (role, content) VALUES ('user', ${message}), ('assistant', ${finalContent})`;
    return finalContent;
  }
}
