import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { loadEnv } from "../env.js";
import { loadWorkflowModule } from "./load-workflow.js";

loadEnv();

const rl = createInterface({ input, output });

async function main() {
  let current: import("../orchestrator/workflow.js").Workflow | null = null;

  console.log("ts-ai-agent-orchestrator REPL — commands: load <path>, run <query>, exit");

  for (;;) {
    const line = (await rl.question("> ")).trim();
    if (!line) continue;
    const [cmd, ...rest] = line.split(/\s+/);
    const arg = rest.join(" ").trim();

    if (cmd === "exit" || cmd === "quit") break;

    if (cmd === "load") {
      if (!arg) {
        console.log("usage: load <path-to-workflow.ts>");
        continue;
      }
      try {
        current = await loadWorkflowModule(arg);
        console.log(`loaded ${arg}`);
      } catch (e) {
        console.error(e);
      }
      continue;
    }

    if (cmd === "run") {
      if (!current) {
        console.log("load a workflow first: load src/workflows/research.ts");
        continue;
      }
      const query = arg || "TypeScript 2026 trends";
      try {
        const result = await current.run({ input: { query } });
        console.log(JSON.stringify(result, null, 2));
      } catch (e) {
        console.error(e);
      }
      continue;
    }

    console.log("unknown command; try load or run");
  }

  rl.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
