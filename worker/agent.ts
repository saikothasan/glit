import { Agent } from "agents";
import { z } from "zod";
import { executeCode } from "./tools/sandbox";

// Protocol constants
const StreamPart = {
  Text: '0',
  Data: '2',
};

export class PolymathAgent extends Agent<Env> {
  readonly model = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";

  async chat(messages: any[], options: { model?: string, webSearch?: boolean } = {}) {
    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();
    const encoder = new TextEncoder();

    const write = async (type: string, content: string) => {
      await writer.write(encoder.encode(`${type}:${JSON.stringify(content)}\n`));
    };

    (async () => {
      try {
        const history = await this.sql`SELECT * FROM messages ORDER BY created_at DESC LIMIT 20`;
        const pastMessages = history.reverse().map((row: any) => ({
          role: row.role,
          content: row.content
        }));

        const fullMessages = [...pastMessages, ...messages];
        const lastUserMessage = messages[messages.length - 1].content;

        const systemPrompt = `You are Polymath, an expert AI assistant.
        Capabilities:
        - Python Code Execution (for math, logic, data).
        - Deep Research (for finding information online).

        If the user asks for research, use the "startResearch" tool.
        If the user asks for calculation/code, use "runCode".
        Otherwise, answer directly.
        `;

        const toolCheck = await this.env.AI.run(this.model, {
           messages: [
             { role: "system", content: systemPrompt },
             ...fullMessages
           ],
           tools: [
             {
               name: "runCode",
               description: "Execute Python code",
               parameters: {
                 type: "object",
                 properties: {
                   code: { type: "string" },
                   dependencies: { type: "array", items: { type: "string" } }
                 },
                 required: ["code"]
               }
             },
             {
               name: "startResearch",
               description: "Start deep research",
               parameters: {
                 type: "object",
                 properties: {
                   query: { type: "string" },
                   depth: { type: "number" }
                 },
                 required: ["query"]
               }
             }
           ]
        });

        // @ts-ignore
        if (toolCheck.tool_calls && toolCheck.tool_calls.length > 0) {
            // @ts-ignore
            const call = toolCheck.tool_calls[0];

            await write('d', { type: "status", message: `Using tool: ${call.name}` });

            let toolResult = "";

            if (call.name === "runCode") {
                const args = call.arguments;
                await write('d', { type: "reasoning", content: `Executing code:\n${args.code}` });
                try {
                    // Fix usage: Use 3 args signature
                    toolResult = await executeCode(this.env, args.code, args.dependencies || []);
                    await write('d', { type: "tool_result", name: call.name, result: toolResult });
                } catch (e: any) {
                    toolResult = `Error: ${e.message}`;
                }
            } else if (call.name === "startResearch") {
                const args = call.arguments;
                await write('d', { type: "reasoning", content: `Starting research on: ${args.query}` });

                const run = await this.env.RESEARCH_WORKFLOW.create({
                    params: {
                        query: args.query,
                        depth: args.depth || 3,
                        agentId: this.state.id.toString()
                    }
                });

                let report = null;
                for (let i = 0; i < 60; i++) {
                    await new Promise(r => setTimeout(r, 1000));
                    const check = await this.sql`SELECT content FROM messages WHERE role='system' AND content LIKE 'Research Complete:%' ORDER BY created_at DESC LIMIT 1`;
                    if (check.length > 0) {
                        report = check[0].content;
                        break;
                    }
                }

                if (report) {
                    toolResult = report;
                } else {
                    toolResult = "Research timed out or is still running.";
                }
            }

            const finalStream = await this.env.AI.run(this.model, {
                messages: [
                    { role: "system", content: systemPrompt },
                    ...fullMessages,
                    // @ts-ignore
                    { role: "assistant", tool_calls: [call] },
                    { role: "tool", name: call.name, content: toolResult }
                ],
                stream: true
            });

            // @ts-ignore
            for await (const chunk of finalStream) {
                // @ts-ignore
                const text = chunk.response;
                if (text) await write('0', text);
            }

        } else {
            const stream = await this.env.AI.run(this.model, {
                messages: [
                    { role: "system", content: systemPrompt },
                    ...fullMessages
                ],
                stream: true
            });
            // @ts-ignore
            for await (const chunk of stream) {
                // @ts-ignore
                const text = chunk.response;
                if (text) await write('0', text);
            }
        }

        await this.sql`INSERT INTO messages (role, content) VALUES ('user', ${lastUserMessage})`;

      } catch (error: any) {
        console.error("Agent error:", error);
        await write('0', `\n[Error: ${error.message}]`);
      } finally {
        writer.close();
      }
    })();

    return new Response(readable, {
        headers: {
            "Content-Type": "text/plain; charset=utf-8",
            "X-Vercel-AI-Data-Stream": "v1"
        }
    });
  }

  // Handle internal callbacks from Workflow AND internal chat proxy
  async fetch(request: Request) {
    const url = new URL(request.url);

    // Internal Chat Route
    if (url.pathname === "/internal/chat" && request.method === "POST") {
         const body = await request.json() as any;
         // Assume body has { messages, model, ... }
         // We call this.chat which returns a Response (stream)
         return this.chat(body.messages, body);
    }

    if (url.pathname === "/internal/report" && request.method === "POST") {
        const { report } = await request.json() as { report: string };
        await this.reportResearchResults(report);
        return new Response("OK");
    }

    return super.fetch(request);
  }

  // ... rest of class (reportResearchResults, onChatMessage etc)
  // Re-adding onChatMessage and reportResearchResults just in case

  async onChatMessage(message: string) {
      // Fallback for standard Agent SDK usage
      return "Use the premium chat interface.";
  }

  async reportResearchResults(report: string) {
    await this.sql`INSERT INTO messages (role, content) VALUES ('system', ${`Research Complete: ${report}`})`;
    // Broadcast if needed
    if (typeof (this as any).broadcast === 'function') {
        (this as any).broadcast({
            type: "research_complete",
            content: report
        });
    }
  }
}
