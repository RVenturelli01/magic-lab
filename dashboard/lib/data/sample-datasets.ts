import type { Dataset } from "./datasets";

/** Illustrative synthetic records, never measurements from a real dataset or run. */
export function createSampleDatasets(): Dataset[] {
  const metadata = { importedAt: "2026-01-01T00:00:00.000Z", isSample: true };
  const split = (index: number) =>
    index % 10 < 7 ? "train" : index % 10 < 9 ? "validation" : "test";
  const round = (value: number) => Number(value.toFixed(3));
  return [
    {
      ...metadata,
      id: "sample:classification-v1",
      name: "classification-demo.csv",
      format: "CSV",
      columns: ["sample_id", "feature_1", "feature_2", "label", "split"],
      rows: Array.from({ length: 150 }, (_, index) => {
        const label = index % 3;
        return [
          `CLS-${String(index + 1).padStart(4, "0")}`,
          round(label * 1.7 + Math.sin(index * 1.3)),
          index % 17 === 0 ? null : round(label * 0.9 + Math.cos(index * 0.7)),
          ["class_a", "class_b", "class_c"][label],
          split(index),
        ];
      }),
    },
    {
      ...metadata,
      id: "sample:regression-v1",
      name: "regression-demo.json",
      format: "JSON",
      columns: ["sample_id", "area", "age", "region", "target", "split"],
      rows: Array.from({ length: 200 }, (_, index) => {
        const area = 40 + ((index * 37) % 160);
        const age = (index * 7) % 60;
        return [
          `REG-${String(index + 1).padStart(4, "0")}`,
          area,
          index % 23 === 0 ? null : age,
          ["north", "central", "south"][index % 3],
          round(20 + area * 2.4 - age * 0.8 + Math.sin(index) * 12),
          split(index),
        ];
      }),
    },
    {
      ...metadata,
      id: "sample:transitions-v1",
      name: "rl-transitions-demo.json",
      format: "JSON",
      columns: [
        "episode",
        "step",
        "position",
        "velocity",
        "action",
        "reward",
        "terminated",
      ],
      rows: Array.from({ length: 120 }, (_, index) => {
        const step = index % 20;
        return [
          Math.floor(index / 20) + 1,
          step,
          round(Math.sin(index * 0.2)),
          round(Math.cos(index * 0.2) * 0.2),
          index % 3,
          round(1 - Math.abs(Math.sin(index * 0.2)) * 0.4),
          step === 19,
        ];
      }),
    },
  ];
}
