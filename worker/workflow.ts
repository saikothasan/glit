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
    // Note: Puppeteer in workflows requires careful resource management.
    // We execute queries in sequence for stability or parallel if resources allow.
    // Here we use a limited parallel approach or just map.
    const findings = await step.do("browse", async () => {
        const results = [];
        const browser = await puppeteer.launch(this.env.MY_BROWSER);
        try {
            for (const q of queries) {
                const page = await browser.newPage();
                try {
                    // Using a search engine (mocked here by visiting a direct page if possible, or using google)
                    // Since we can't reliably scrape Google without getting blocked often, we might try to visit specific sites if the query implies them,
                    // or just try to visit a generic search page.
                    // For the sake of this demo, we will try to visit a documentation site or wikipedia if relevant.
                    // But to be generic, let's try a search engine.
                    await page.goto(`https://www.google.com/search?q=${encodeURIComponent(q)}`, { waitUntil: 'networkidle0' });

                    // Extract search results text (naive extraction)
                    const content = await page.evaluate(() => document.body.innerText);
                    results.push(`Query: ${q}\nContent: ${content.substring(0, 1000)}...`);
                    await page.close();
                } catch (e) {
                    results.push(`Failed to browse ${q}: ${e}`);
                    await page.close();
                }
            }
        } finally {
            await browser.close();
        }
        return results;
    });

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
        
        // Call the internal endpoint we defined in the Agent
        await stub.fetch("http://internal/report", {
            method: "POST",
            body: JSON.stringify({ report })
        });
    });

    return report;
  }
}
