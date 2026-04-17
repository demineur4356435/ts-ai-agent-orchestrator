import { topologicalLayers } from "./scheduler.js";
import { executeAgentOnce, executeAgentStream } from "./execute-agent.js";
import type {
  AgentDefinition,
  StreamEvent,
  WorkflowHooks,
  WorkflowRunPayload,
} from "./types.js";
import type { ToolSet } from "ai";

/** Thrown from runStream inner steps so the outer generator can emit `agentName`. */
function streamAgentFail(agentName: string, cause: unknown): never {
  throw { __streamAgentFail: true as const, agentName, cause };
}

function isStreamAgentFail(
  e: unknown,
): e is { __streamAgentFail: true; agentName: string; cause: unknown } {
  return (
    typeof e === "object" &&
    e !== null &&
    "__streamAgentFail" in e &&
    (e as { __streamAgentFail?: boolean }).__streamAgentFail === true
  );
}

export interface WorkflowConfig {
  agents: AgentDefinition<unknown, unknown, ToolSet>[];
  entryPoints?: string[];
}

export interface Workflow {
  readonly agents: readonly AgentDefinition<unknown, unknown, ToolSet>[];
  run<TPayload extends WorkflowRunPayload>(
    payload: TPayload,
    hooks?: WorkflowHooks,
  ): Promise<Record<string, unknown>>;
  runStream<TPayload extends WorkflowRunPayload>(
    payload: TPayload,
    hooks?: WorkflowHooks,
  ): AsyncGenerator<StreamEvent, Record<string, unknown>>;
}

function asMap(
  agents: readonly AgentDefinition<unknown, unknown, ToolSet>[],
): Map<string, AgentDefinition<unknown, unknown, ToolSet>> {
  const m = new Map<string, AgentDefinition<unknown, unknown, ToolSet>>();
  for (const a of agents) {
    if (m.has(a.name)) {
      throw new Error(`Duplicate agent name "${a.name}"`);
    }
    m.set(a.name, a);
  }
  return m;
}

function inferEntryPoints(
  agents: readonly AgentDefinition<unknown, unknown, ToolSet>[],
): string[] {
  const entries = agents
    .filter((a) => a.dependsOn.length === 0)
    .map((a) => a.name);
  if (entries.length === 0) {
    throw new Error("Workflow has no entry agents (every agent has dependsOn)");
  }
  return entries;
}

function mergeDependencyInputs(
  dependsOn: readonly string[],
  outputs: Map<string, unknown>,
): Record<string, unknown> {
  const merged: Record<string, unknown> = {};
  for (const dep of dependsOn) {
    const o = outputs.get(dep);
    if (o === undefined) {
      throw new Error(`Missing output from dependency "${dep}"`);
    }
    if (o && typeof o === "object" && !Array.isArray(o)) {
      Object.assign(merged, o as object);
    }
  }
  return merged;
}

function parseEntryInput(
  agent: AgentDefinition<unknown, unknown, ToolSet>,
  payload: WorkflowRunPayload,
): unknown {
  return agent.inputSchema.parse(payload.input);
}

function parseFollowerInput(
  agent: AgentDefinition<unknown, unknown, ToolSet>,
  outputs: Map<string, unknown>,
): unknown {
  const raw = mergeDependencyInputs(agent.dependsOn, outputs);
  return agent.inputSchema.parse(raw);
}

/** Union of all agent outputs (last writer wins on key collision). */
function collectFinalOutput(
  agents: readonly AgentDefinition<unknown, unknown, ToolSet>[],
  outputs: Map<string, unknown>,
): Record<string, unknown> {
  const merged: Record<string, unknown> = {};
  for (const a of agents) {
    const o = outputs.get(a.name);
    if (o && typeof o === "object" && !Array.isArray(o)) {
      Object.assign(merged, o as object);
    } else if (o !== undefined) {
      merged[a.name] = o;
    }
  }
  return merged;
}

export function createWorkflow(config: WorkflowConfig): Workflow {
  const byName = asMap(config.agents);
  const names = config.agents.map((a) => a.name);

  const dependsOn = new Map<string, readonly string[]>();
  for (const a of config.agents) {
    dependsOn.set(a.name, a.dependsOn);
  }

  const entryPoints =
    config.entryPoints?.length ? config.entryPoints : inferEntryPoints(config.agents);

  for (const e of entryPoints) {
    if (!byName.has(e)) {
      throw new Error(`Unknown entry point "${e}"`);
    }
    const ag = byName.get(e)!;
    if (ag.dependsOn.length > 0) {
      throw new Error(`Entry agent "${e}" must not have dependsOn`);
    }
  }

  const layers = topologicalLayers(names, dependsOn);

  return {
    agents: config.agents,

    async run(payload, hooks) {
      const outputs = new Map<string, unknown>();
      for (const layer of layers) {
        await Promise.all(
          layer.map(async (name) => {
            const agent = byName.get(name)!;
            await hooks?.onAgentStart?.(name);
            try {
              const parsed =
                agent.dependsOn.length === 0
                  ? parseEntryInput(agent, payload)
                  : parseFollowerInput(agent, outputs);
              const out = await executeAgentOnce(agent, parsed);
              outputs.set(name, out);
              await hooks?.onAgentComplete?.(name, out);
            } catch (error) {
              await hooks?.onAgentError?.(name, error);
              throw error;
            }
          }),
        );
      }
      return collectFinalOutput(config.agents, outputs);
    },

    async *runStream(payload, hooks) {
      const outputs = new Map<string, unknown>();
      try {
        for (const layer of layers) {
          const chunk = await Promise.all(
            layer.map(async (name) => {
              const agent = byName.get(name)!;
              try {
                const buf: StreamEvent[] = [];
                await hooks?.onAgentStart?.(name);
                buf.push({ type: "agent-start", agentName: name });

                const parsed =
                  agent.dependsOn.length === 0
                    ? parseEntryInput(agent, payload)
                    : parseFollowerInput(agent, outputs);

                const out = await executeAgentStream(agent, parsed, (e) => {
                  buf.push(e);
                });
                return { name, out, buf };
              } catch (error) {
                await hooks?.onAgentError?.(name, error);
                streamAgentFail(name, error);
              }
            }),
          );

          for (const r of chunk) {
            for (const e of r.buf) {
              yield e;
            }
            outputs.set(r.name, r.out);
            await hooks?.onAgentComplete?.(r.name, r.out);
            yield {
              type: "agent-complete",
              agentName: r.name,
              output: r.out,
            };
          }
        }
      } catch (error) {
        if (isStreamAgentFail(error)) {
          yield {
            type: "error",
            agentName: error.agentName,
            error: error.cause,
          };
          throw error.cause;
        }
        yield { type: "error", error };
        throw error;
      }
      return collectFinalOutput(config.agents, outputs);
    },
  };
}
