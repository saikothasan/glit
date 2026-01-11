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
      execute: async (args) => {
        try {
          return await executeCode(this.env, "python", args.code, args.dependencies);
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
      execute: async (args) => {
        const run = await this.env.RESEARCH_WORKFLOW.create({
          params: { 
            query: args.query, 
            depth: args.depth, 
            agentId: this.id.toString() // Pass ID so Workflow can call back
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

    // Run the AI loop with tools enabled
    const response = await this.runAI({
      messages: [...messages, { role: "user", content: message }],
      tools: this.tools,
    });

    await this.sql`INSERT INTO messages (role, content) VALUES ('user', ${message}), ('assistant', ${response})`;
    return response;
  }

  /**
   * Called by the Workflow when research is complete.
   * This allows the agent to asynchronously notify the user.
   */
  async reportResearchResults(report: string) {
    // In a real app, you would push this via WebSocket to the frontend
    // For now, we store it in memory for the next turn or log it
    await this.sql`INSERT INTO messages (role, content) VALUES ('system', ${`Research Complete: ${report}`})`;
    // Logic to trigger WebSocket push would go here
  }
}
