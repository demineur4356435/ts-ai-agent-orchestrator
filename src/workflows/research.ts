import { z } from "zod";
import { createAgent, createWorkflow } from "../orchestrator/index.js";

const searcher = createAgent({
  name: "searcher",
  model: "openai/gpt-4o-mini",
  system:
    "You are a web researcher. Given a query, return exactly 3 short factual bullet points as strings in `facts`.",
  input: z.object({ query: z.string() }),
  output: z.object({ facts: z.array(z.string()).min(3).max(3) }),
});

const summarizer = createAgent({
  name: "summarizer",
  model: "openai/gpt-4o-mini",
  system:
    "Combine the provided facts into a concise two-sentence summary. Be precise and avoid adding new claims.",
  input: z.object({ facts: z.array(z.string()) }),
  output: z.object({ summary: z.string() }),
  dependsOn: ["searcher"],
});

export const workflow = createWorkflow({
  agents: [searcher, summarizer],
  entryPoints: ["searcher"],
});

export default workflow;
