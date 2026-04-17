import { describe, expect, it } from "vitest";
import { loadEnv } from "../src/env.js";

loadEnv();
const hasKey = Boolean(process.env.OPENAI_API_KEY);

describe.skipIf(!hasKey)("integration (requires OPENAI_API_KEY)", () => {
  it(
    "research workflow returns facts and summary",
    async () => {
      const { workflow } = await import("../src/workflows/research.js");
      const result = await workflow.run({
        input: {
          query: "What is 2+2? Reply with three very short fact strings.",
        },
      });
      expect(result).toHaveProperty("facts");
      expect(result).toHaveProperty("summary");
      expect(Array.isArray((result as { facts: unknown }).facts)).toBe(true);
      expect(typeof (result as { summary: unknown }).summary).toBe("string");
    },
    120_000,
  );
});
