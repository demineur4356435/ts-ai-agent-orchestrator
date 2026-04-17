import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import type { LanguageModel } from "ai";

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) {
    throw new Error(
      `Missing ${name} for the selected model provider. Set it in .env.local or the environment.`,
    );
  }
  return v;
}

/**
 * Resolve a model string like `openai/gpt-4o`, `anthropic/claude-sonnet-4-20250514`, or `ollama/llama3.2`.
 */
export function resolveModel(modelId: string): LanguageModel {
  const slash = modelId.indexOf("/");
  if (slash <= 0) {
    throw new Error(
      `Invalid model id "${modelId}". Use "provider/model" (e.g. openai/gpt-4o).`,
    );
  }
  const provider = modelId.slice(0, slash);
  const rest = modelId.slice(slash + 1);
  if (!rest) {
    throw new Error(`Invalid model id "${modelId}": missing model name after "/"`);
  }

  switch (provider) {
    case "openai": {
      const openai = createOpenAI({ apiKey: requireEnv("OPENAI_API_KEY") });
      return openai(rest);
    }
    case "anthropic": {
      const anthropic = createAnthropic({
        apiKey: requireEnv("ANTHROPIC_API_KEY"),
      });
      return anthropic(rest);
    }
    case "ollama": {
      const baseURL =
        process.env.OLLAMA_BASE_URL ?? "http://localhost:11434/v1";
      const ollama = createOpenAI({
        baseURL,
        apiKey: process.env.OLLAMA_API_KEY ?? "ollama",
      });
      return ollama(rest);
    }
    default:
      throw new Error(
        `Unknown provider "${provider}". Supported: openai, anthropic, ollama.`,
      );
  }
}
