/**
 * Topological ordering (Kahn) with cycle detection.
 * `dependsOn` lists prerequisites; each layer may run in parallel.
 */
export function topologicalLayers(
  agentNames: string[],
  dependsOn: Map<string, readonly string[]>,
): string[][] {
  const nameSet = new Set(agentNames);
  for (const [name, deps] of dependsOn) {
    for (const d of deps) {
      if (!nameSet.has(d)) {
        throw new Error(
          `Agent "${name}" depends on unknown agent "${d}"`,
        );
      }
      if (d === name) {
        throw new Error(`Agent "${name}" cannot depend on itself`);
      }
    }
  }

  const dependents = new Map<string, string[]>();
  for (const n of agentNames) dependents.set(n, []);

  const inDegree = new Map<string, number>();
  for (const n of agentNames) {
    const deps = dependsOn.get(n) ?? [];
    inDegree.set(n, deps.length);
    for (const dep of deps) {
      dependents.get(dep)!.push(n);
    }
  }

  const layers: string[][] = [];
  let frontier = agentNames.filter((n) => (inDegree.get(n) ?? 0) === 0);

  if (frontier.length === 0 && agentNames.length > 0) {
    throw new Error("Workflow DAG has a cycle or invalid dependency graph");
  }

  let processed = 0;
  while (frontier.length > 0) {
    layers.push([...frontier]);
    const next: string[] = [];
    for (const n of frontier) {
      processed++;
      for (const m of dependents.get(n) ?? []) {
        const left = (inDegree.get(m) ?? 0) - 1;
        inDegree.set(m, left);
        if (left === 0) next.push(m);
      }
    }
    frontier = next;
  }

  if (processed !== agentNames.length) {
    throw new Error("Workflow DAG contains a cycle");
  }

  return layers;
}
