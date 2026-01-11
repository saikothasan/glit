import { Agent } from "agents";
import { z } from "zod";
import { executeCodeStream, listFiles, exposePreview } from "./tools/sandbox";

export class PolymathAgent extends Agent<Env> {
  // Use a fast, capable model
  readonly model = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";

  readonly tools = {
    runCode: {
      description: "Execute Python code. Output is streamed live to the terminal.",
      parameters: z.object({
        code: z.string().describe("Python code to run")
      }),
      execute: async (args: { code: string }) => {
        // Stream output directly to the connected WebSocket
        return await executeCodeStream(this.env, args.code, (chunk) => {
           this.broadcast({ type: 'terminal', data: chunk });
        });
      }
    },
    listFiles: {
      description: "List files in the current directory.",
      parameters: z.object({ path: z.string().default(".") }),
      execute: async (args: { path: string }) => await listFiles(this.env, args.path)
    },
    startPreview: {
      description: "Expose a port (e.g., 8000) to preview a web app.",
      parameters: z.object({ port: z.number().default(8000) }),
      execute: async (args: { port: number }) => {
        const url = await exposePreview(this.env, args.port);
        this.broadcast({ type: 'preview', url: url });
        return `Preview active at: ${url}`;
      }
    }
  };

  /**
   * Handle incoming WebSocket messages from the UI
   */
  async onMessage(connection: any, message: string) {
    const data = JSON.parse(message as string);
    
    // Save User Message
    await this.sql`INSERT INTO messages (role, content) VALUES ('user', ${data.content})`;

    // Get History
    const history = await this.sql`SELECT * FROM messages ORDER BY created_at DESC LIMIT 15`;
    const context = history.reverse().map((r: any) => ({ role: r.role, content: r.content }));

    const systemPrompt = `You are Polymath, a Real-Time AI Developer.
    - You run inside a persistent cloud sandbox.
    - Output is streamed live to the user's terminal.
    - For web apps, write the file, run 'python -m http.server', then use startPreview.`;

    // Run AI Inference
    const response = await this.env.AI.run(this.model, {
      messages: [{ role: "system", content: systemPrompt }, ...context],
      tools: Object.keys(this.tools).map(k => ({
        name: k,
        description: (this.tools as any)[k].description,
        parameters: (this.tools as any)[k].parameters
      }))
    });

    // Handle Tool Calls or Final Response
    // @ts-ignore
    if (response.tool_calls?.length) {
       // @ts-ignore
       const call = response.tool_calls[0];
       // Execute tool (output is streamed inside executeCodeStream)
       const result = await (this.tools as any)[call.name].execute(call.arguments);
       
       // Get final answer based on tool result
       const final = await this.env.AI.run(this.model, {
         messages: [
           { role: "system", content: systemPrompt }, 
           ...context, 
           { role: "assistant", tool_calls: [call] },
           { role: "tool", content: JSON.stringify(result), name: call.name }
         ]
       });
       
       // @ts-ignore
       await this.sql`INSERT INTO messages (role, content) VALUES ('assistant', ${final.response})`;
       this.broadcast({ type: 'chat', data: (final as any).response });

    } else {
       // @ts-ignore
       const reply = response.response;
       await this.sql`INSERT INTO messages (role, content) VALUES ('assistant', ${reply})`;
       this.broadcast({ type: 'chat', data: reply });
    }
  }
}
