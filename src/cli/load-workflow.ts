import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import type { Workflow } from "../orchestrator/workflow.js";

/**
 * Dynamically import a workflow module (dev / REPL). Must export `default` or `workflow`
 * with `.run()` and `.runStream()`.
 */
export async function loadWorkflowModule(workflowPath: string): Promise<Workflow> {
  const abs = resolve(process.cwd(), workflowPath);
  const mod = await import(pathToFileURL(abs).href);
  const workflow = mod.default ?? mod.workflow;
  if (
    !workflow ||
    typeof workflow.run !== "function" ||
    typeof workflow.runStream !== "function"
  ) {
    throw new Error(
      `Module must export default or \`workflow\` with .run() and .runStream() — got ${workflowPath}`,
    );
  }
  return workflow as Workflow;
}
