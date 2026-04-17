import type { Tool, ToolSet } from "ai";
import type { z } from "zod";
import type { AgentDefinition, CreateAgentConfig } from "./types.js";

function toolsToSet(tools: readonly Tool[] | undefined): ToolSet | undefined {
  if (!tools?.length) return undefined;
  const o: ToolSet = {};
  for (let i = 0; i < tools.length; i++) {
    o[`tool_${i}`] = tools[i]!;
  }
  return o;
}

export function createAgent<TIn, TOut>(
  config: CreateAgentConfig<TIn, TOut, readonly Tool[] | undefined>,
): AgentDefinition<TIn, TOut, ToolSet> {
  const dependsOn = Object.freeze(config.dependsOn ?? []);
  const toolSet = toolsToSet(config.tools);

  const def: AgentDefinition<TIn, TOut, ToolSet> = {
    name: config.name,
    model: config.model,
    system: config.system,
    inputSchema: config.input as z.ZodType<TIn>,
    outputSchema: config.output as z.ZodType<TOut>,
    dependsOn,
    ...(toolSet ? { tools: toolSet } : {}),
  };

  return def;
}
