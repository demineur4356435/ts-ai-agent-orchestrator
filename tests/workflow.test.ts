import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { createAgent, createWorkflow } from "../src/orchestrator/index.js";
import * as exec from "../src/orchestrator/execute-agent.js";

describe("createWorkflow", () => {
  it("merges outputs from a linear chain", async () => {
    const a = createAgent({
      name: "a",
      model: "openai/gpt-4o-mini",
      system: "x",
      input: z.object({ q: z.string() }),
      output: z.object({ facts: z.array(z.string()) }),
    });
    const b = createAgent({
      name: "b",
      model: "openai/gpt-4o-mini",
      system: "y",
      input: z.object({ facts: z.array(z.string()) }),
      output: z.object({ summary: z.string() }),
      dependsOn: ["a"],
    });
    const wf = createWorkflow({ agents: [a, b], entryPoints: ["a"] });

    vi.spyOn(exec, "executeAgentOnce").mockImplementation(async (agent) => {
      if (agent.name === "a") return { facts: ["one", "two"] };
      return { summary: "ok" };
    });

    const out = await wf.run({ input: { q: "test" } });
    expect(out).toMatchObject({
      facts: ["one", "two"],
      summary: "ok",
    });
    vi.restoreAllMocks();
  });
});

describe("runStream", () => {
  it("emits error with agentName when execution fails", async () => {
    const a = createAgent({
      name: "failer",
      model: "openai/gpt-4o-mini",
      system: "x",
      input: z.object({ q: z.string() }),
      output: z.object({ ok: z.boolean() }),
    });
    const wf = createWorkflow({ agents: [a], entryPoints: ["failer"] });

    vi.spyOn(exec, "executeAgentStream").mockRejectedValue(new Error("boom"));

    const events: { type: string; agentName?: string }[] = [];
    let thrown: unknown;
    try {
      for await (const ev of wf.runStream({ input: { q: "x" } })) {
        events.push(ev);
      }
    } catch (e) {
      thrown = e;
    }

    expect(thrown).toBeInstanceOf(Error);
    expect((thrown as Error).message).toBe("boom");
    const errEv = events.find((e) => e.type === "error");
    expect(errEv).toMatchObject({
      type: "error",
      agentName: "failer",
    });
    vi.restoreAllMocks();
  });
});
