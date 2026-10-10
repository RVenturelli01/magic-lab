// Small deterministic contract fixture; no host logs or experiment generator.
export function createFixture() {
  const metrics = [
    {
      id: "eval/score",
      label: "Score",
      phase: "evaluation",
      unit: "reward",
      xUnit: "steps",
      direction: "higher",
    },
    {
      id: "eval/distance",
      label: "Distance",
      phase: "evaluation",
      unit: "m",
      xUnit: "steps",
      direction: "lower",
    },
  ];
  const runs = ["A", "B", "C"].flatMap((algorithm) =>
    [0.0001, 0.0003, 0.001].flatMap((learning_rate) =>
      [0, 1].map((seed) => ({
        id: `${algorithm}-${learning_rate}-${seed}`,
        name: `${algorithm} ${learning_rate}`,
        algorithm,
        environment: "fixture",
        seed,
        status: "completed",
        config: { learning_rate, gamma: 0.99 },
        code: { commit: "fixture", dirty: false },
      })),
    ),
  );
  return {
    schemaVersion: 1,
    id: "contract-fixture",
    metrics,
    runs,
    points: runs.flatMap((run, i) =>
      metrics.flatMap((metric) =>
        [0, 10, 20].map((step) => ({
          runId: run.id,
          metricId: metric.id,
          step,
          value: step + i + run.seed,
        })),
      ),
    ),
    artifacts: [],
    campaigns: [],
  };
}
