import { WorkflowEntrypoint, WorkflowStep, WorkflowEvent } from "cloudflare:workers";
import puppeteer from "@cloudflare/puppeteer";

type ResearchParams = {
  query: string;
  depth: number;
  agentId: string;
};

export class ResearchWorkflow extends WorkflowEntrypoint<Env, ResearchParams> {
  async run(event: WorkflowEvent<ResearchParams>, step: WorkflowStep) {
    const { query, agentId } = event.payload;

    // Step 1: Plan Search Queries (Using Reasoning Model)
    const queries = await step.do("plan-queries", async () => {
      const response = await this.env.AI.run("@cf/deepseek-ai/deepseek-r1-distill-qwen-32b", {
        messages: [{ role: "user", content: `Generate 3 specific search queries for: ${query}` }]
      });
      // Simple parsing logic (robust implementations would use JSON mode)
      return (response as any).response.split("\n").filter((l: string) => l.length > 5).slice(0, 3);
    });

    // Step 2: Parallel Web Browsing
    const findings = await Promise.all(queries.map((q, idx) => 
      step.do(`browse-${idx}`, async () => {
        const browser = await puppeteer.launch(this.env.MY_BROWSER);
        const page = await browser.newPage();
        
        try {
          // Perform Google Search (simulated via direct navigation for stability)
          await page.goto(`https://www.google.com/search?q=${encodeURIComponent(q)}`);
          
          // Extract search results text
          const content = await page.evaluate(() => document.body.innerText);
          await browser.close();
          return content.substring(0, 2000); // Limit context size
        } catch (e) {
          await browser.close();
          return `Failed to browse ${q}`;
        }
      })
    ));

    // Step 3: Synthesize Report
    const report = await step.do("synthesize", async () => {
      const context = findings.join("\n\n---\n\n");
      const response = await this.env.AI.run("@cf/meta/llama-3.3-70b-instruct-fp8-fast", {
        messages: [
          { role: "system", content: "You are a research assistant. Summarize the following raw web data into a clean report." },
          { role: "user", content: `Query: ${query}\n\nData:\n${context}` }
        ]
      });
      return (response as any).response;
    });

    // Step 4: Callback to Agent
    await step.do("notify-agent", async () => {
        // We use the Durable Object stub to call the agent back
        const id = this.env.PRIMARY_AGENT.idFromString(agentId);
        const stub = this.env.PRIMARY_AGENT.get(id);
        
        // Custom RPC method (requires extending the Agent class slightly or using fetch)
        await stub.fetch("http://internal/report", {
            method: "POST",
            body: JSON.stringify({ report })
        });
    });

    return report;
  }
}
