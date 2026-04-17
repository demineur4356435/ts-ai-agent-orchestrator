import {
  generateText,
  Output,
  stepCountIs,
  streamText,
  type ToolSet,
} from "ai";
import type { AgentDefinition, StreamEvent } from "./types.js";
import { resolveModel } from "./model.js";

function buildPrompt(input: unknown): string {
  return `You receive INPUT as JSON. Produce structured output that matches the schema exactly.\n\nINPUT:\n${JSON.stringify(input, null, 2)}`;
}

function requireStructuredOutput(
  agentName: string,
  output: unknown,
): unknown {
  if (output === undefined) {
    throw new Error(
      `Agent "${agentName}": no structured output was produced. Try a stronger model, simplify the schema, or check provider errors.`,
    );
  }
  return output;
}

export async function executeAgentOnce(
  agent: AgentDefinition<unknown, unknown, ToolSet>,
  parsedInput: unknown,
): Promise<unknown> {
  const model = resolveModel(agent.model);
  const prompt = buildPrompt(parsedInput);

  if (agent.tools && Object.keys(agent.tools).length > 0) {
    const result = await generateText({
      model,
      system: agent.system,
      prompt,
      tools: agent.tools,
      output: Output.object({ schema: agent.outputSchema }),
      stopWhen: stepCountIs(15),
    });
    return requireStructuredOutput(agent.name, result.output);
  }

  const result = await generateText({
    model,
    system: agent.system,
    prompt,
    output: Output.object({ schema: agent.outputSchema }),
  });
  return requireStructuredOutput(agent.name, result.output);
}

export async function executeAgentStream(
  agent: AgentDefinition<unknown, unknown, ToolSet>,
  parsedInput: unknown,
  emit: (e: StreamEvent) => void,
): Promise<unknown> {
  const model = resolveModel(agent.model);
  const prompt = buildPrompt(parsedInput);

  const pushToken = (token: string) => {
    emit({ type: "token", agentName: agent.name, token });
  };

  if (agent.tools && Object.keys(agent.tools).length > 0) {
    const s = streamText({
      model,
      system: agent.system,
      prompt,
      tools: agent.tools,
      output: Output.object({ schema: agent.outputSchema }),
      stopWhen: stepCountIs(15),
      onChunk: ({ chunk }) => {
        if (chunk.type === "text-delta") pushToken(chunk.text);
      },
    });
    return requireStructuredOutput(agent.name, await s.output);
  }

  const s = streamText({
    model,
    system: agent.system,
    prompt,
    output: Output.object({ schema: agent.outputSchema }),
    onChunk: ({ chunk }) => {
      if (chunk.type === "text-delta") pushToken(chunk.text);
    },
  });
  return requireStructuredOutput(agent.name, await s.output);
}
