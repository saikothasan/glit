import { Agent } from "agents";
import { z } from "zod";
import { executeCode, listFiles, readFile } from "./tools/sandbox";

export class PolymathAgent extends Agent<Env> {
  // Use a fast, accurate model for general conversation
  readonly model = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";

  // Define capability tools
  readonly tools = {
    runCode: {
      description: "Execute Python code. Use this for math, data analysis, or complex logic. Returns stdout.",
      parameters: z.object({
        code: z.string().describe("The Python code to execute"),
        dependencies: z.array(z.string()).optional().describe("Pip packages to install")
      }),
      execute: async (args: { code: string; dependencies?: string[] }) => {
        try {
          return await executeCode(this.env, args.code);
        } catch (err: any) {
          return `Error executing code: ${err.message}`;
        }
      }
    },
    startResearch: {
      description: "Start a deep research task for complex queries. Returns a Job ID.",
      parameters: z.object({
        query: z.string().describe("The topic to research"),
        depth: z.number().default(3).describe("Number of pages to browse")
      }),
      execute: async (args: { query: string; depth: number }) => {
        const agentId = this.state?.id?.toString() || "unknown";
        const run = await this.env.RESEARCH_WORKFLOW.create({
          params: { query: args.query, depth: args.depth, agentId: agentId }
        });
        return `Research started. Job ID: ${run.id}. Inform the user.`;
      }
    },
    listFiles: {
      description: "List files in the current sandbox directory.",
      parameters: z.object({
        path: z.string().default(".").describe("Directory path")
      }),
      execute: async (args: { path: string }) => {
        return await listFiles(this.env, args.path);
      }
    },
    readFile: {
      description: "Read the content of a specific file.",
      parameters: z.object({
        path: z.string().describe("File path to read")
      }),
      execute: async (args: { path: string }) => {
        return await readFile(this.env, args.path);
      }
    }
  };

  async onChatMessage(message: string) {
    const history = await this.sql`SELECT * FROM messages ORDER BY created_at DESC LIMIT 15`;
    const messages = history.reverse().map((row: any) => ({
      role: row.role,
      content: row.content
    }));

    const systemPrompt = "You are Polymath, a helpful AI agent with access to a code interpreter (Python), file system, and a deep research workflow. Always check files after running code that generates output.";

    const response = await this.env.AI.run(this.model, {
      messages: [
        { role: "system", content: systemPrompt },
        ...messages,
        { role: "user", content: message }
      ],
      tools: [
        { name: "runCode", description: this.tools.runCode.description, parameters: { type: "object", properties: { code: { type: "string" }, dependencies: { type: "array", items: { type: "string" } } }, required: ["code"] } },
        { name: "startResearch", description: this.tools.startResearch.description, parameters: { type: "object", properties: { query: { type: "string" }, depth: { type: "number" } }, required: ["query"] } },
        { name: "listFiles", description: this.tools.listFiles.description, parameters: { type: "object", properties: { path: { type: "string" } } } },
        { name: "readFile", description: this.tools.readFile.description, parameters: { type: "object", properties: { path: { type: "string" } }, required: ["path"] } }
      ]
    });

    let finalResponse = "";
    // Simplified Tool Handling Logic (In production, use a loop for multi-turn tool use)
    if ((response as any).tool_calls && (response as any).tool_calls.length > 0) {
        const toolCall = (response as any).tool_calls[0];
        const toolName = toolCall.name;
        const toolArgs = toolCall.arguments;

        let toolResult = "";
        if (toolName === "runCode") toolResult = await this.tools.runCode.execute(toolArgs);
        else if (toolName === "startResearch") toolResult = await this.tools.startResearch.execute(toolArgs);
        else if (toolName === "listFiles") toolResult = await this.tools.listFiles.execute(toolArgs);
        else if (toolName === "readFile") toolResult = await this.tools.readFile.execute(toolArgs);

        const secondResponse = await this.env.AI.run(this.model, {
             messages: [
                { role: "system", content: systemPrompt },
                ...messages,
                { role: "user", content: message },
                { role: "assistant", tool_calls: [toolCall] },
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

  async reportResearchResults(report: string) {
    await this.sql`INSERT INTO messages (role, content) VALUES ('system', ${`Research Complete: ${report}`})`;
    if (typeof this.broadcast === 'function') {
        this.broadcast({ type: "research_complete", content: report });
    }
  }

  async fetch(request: Request) {
    const url = new URL(request.url);
    if (url.pathname === "/internal/report" && request.method === "POST") {
        const { report } = await request.json() as { report: string };
        await this.reportResearchResults(report);
        return new Response("OK");
    }
    return super.fetch(request);
  }
}
