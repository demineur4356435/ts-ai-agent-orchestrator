import type { Tool, ToolSet } from "ai";
import type { z } from "zod";

/** Definition produced by `createAgent` */
export interface AgentDefinition<
  TInput = unknown,
  TOutput = unknown,
  TTools extends ToolSet = ToolSet,
> {
  readonly name: string;
  readonly model: string;
  readonly system: string;
  readonly inputSchema: z.ZodType<TInput>;
  readonly outputSchema: z.ZodType<TOutput>;
  readonly dependsOn: readonly string[];
  readonly tools?: TTools;
}

export interface WorkflowRunPayload<T = unknown> {
  input: T;
}

export type StreamEvent =
  | { type: "agent-start"; agentName: string }
  | { type: "agent-complete"; agentName: string; output: unknown }
  | { type: "token"; agentName: string; token: string }
  | { type: "error"; agentName?: string; error: unknown };

export type WorkflowHooks = {
  onAgentStart?: (name: string) => void | Promise<void>;
  onAgentComplete?: (name: string, output: unknown) => void | Promise<void>;
  onAgentError?: (name: string, error: unknown) => void | Promise<void>;
};

/** Public agent config for `createAgent` */
export type CreateAgentConfig<TInput, TOutput, TTools extends readonly Tool[] | undefined> = {
  name: string;
  model: string;
  system: string;
  input: z.ZodType<TInput>;
  output: z.ZodType<TOutput>;
  dependsOn?: string[];
  tools?: TTools;
};
