import { describe, expect, it } from "vitest";
import { topologicalLayers } from "../src/orchestrator/scheduler.js";

describe("topologicalLayers", () => {
  it("orders dependencies before dependents", () => {
    const names = ["a", "b", "c"];
    const deps = new Map<string, readonly string[]>([
      ["a", []],
      ["b", ["a"]],
      ["c", ["b"]],
    ]);
    expect(topologicalLayers(names, deps)).toEqual([["a"], ["b"], ["c"]]);
  });

  it("runs independent nodes in the same layer", () => {
    const names = ["a", "b", "c"];
    const deps = new Map<string, readonly string[]>([
      ["a", []],
      ["b", []],
      ["c", ["a", "b"]],
    ]);
    const layers = topologicalLayers(names, deps);
    expect(layers[0]?.sort()).toEqual(["a", "b"]);
    expect(layers[1]).toEqual(["c"]);
  });

  it("throws on cycle", () => {
    const names = ["a", "b"];
    const deps = new Map<string, readonly string[]>([
      ["a", ["b"]],
      ["b", ["a"]],
    ]);
    expect(() => topologicalLayers(names, deps)).toThrow(/cycle/i);
  });

  it("throws on unknown dependency", () => {
    expect(() =>
      topologicalLayers(["a"], new Map([["a", ["missing"]]])),
    ).toThrow(/unknown/i);
  });
});
