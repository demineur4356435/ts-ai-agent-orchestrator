import { Command } from "commander";
import { loadEnv } from "../env.js";
import { loadWorkflowModule } from "./load-workflow.js";

loadEnv();

async function main() {
  const program = new Command();
  program
    .name("ts-ai-agent-orchestrator")
    .description("Run a DAG workflow module")
    .requiredOption("--workflow <path>", "Path to a workflow file (e.g. src/workflows/research.ts)")
    .option("--query <text>", "Input query for workflows that expect { query: string }")
    .option("--stream", "Stream tokens to stdout", false)
    .parse(process.argv);

  const opts = program.opts<{ workflow: string; query?: string; stream?: boolean }>();
  const wf = await loadWorkflowModule(opts.workflow);

  const query =
    opts.query ??
    "Latest trends in TypeScript AI agents";

  if (opts.stream) {
    const gen = wf.runStream({ input: { query } });
    for await (const ev of gen) {
      if (ev.type === "token") process.stdout.write(ev.token);
      else if (ev.type === "agent-start") {
        process.stderr.write(`\n[${ev.agentName}] start\n`);
      } else if (ev.type === "agent-complete") {
        process.stderr.write(`[${ev.agentName}] done\n`);
      } else if (ev.type === "error") {
        if (ev.agentName) {
          console.error(`[${ev.agentName}]`, ev.error);
        } else {
          console.error(ev.error);
        }
      }
    }
  } else {
    const result = await wf.run({ input: { query } });
    console.log(JSON.stringify(result, null, 2));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
