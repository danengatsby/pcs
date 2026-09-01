import {
  buildLabelsKey,
  buildSampleLine,
  escapeHelpText,
  formatFloat,
  normalizeLabels,
} from "./labels.js";
import type { CounterSample, HistogramSample, MetricLabels } from "./types.js";

export class CounterMetric {
  readonly #name: string;
  readonly #help: string;
  readonly #samples = new Map<string, CounterSample>();

  constructor(name: string, help: string) {
    this.#name = name;
    this.#help = help;
  }

  increment(labels: MetricLabels, amount = 1): void {
    if (!Number.isFinite(amount) || amount <= 0) {
      return;
    }

    const normalizedLabels = normalizeLabels(labels);
    const key = buildLabelsKey(normalizedLabels);
    const existing = this.#samples.get(key);
    if (existing) {
      existing.value += amount;
      return;
    }

    this.#samples.set(key, {
      labels: normalizedLabels,
      value: amount,
    });
  }

  render(): string {
    const lines = [
      `# HELP ${this.#name} ${escapeHelpText(this.#help)}`,
      `# TYPE ${this.#name} counter`,
    ];

    const entries = [...this.#samples.entries()].sort(([first], [second]) => first.localeCompare(second));
    if (entries.length === 0) {
      lines.push(`${this.#name} 0`);
      return lines.join("\n");
    }

    for (const [, entry] of entries) {
      lines.push(buildSampleLine(this.#name, entry.labels, entry.value));
    }

    return lines.join("\n");
  }

  reset(): void {
    this.#samples.clear();
  }
}

export class HistogramMetric {
  readonly #name: string;
  readonly #help: string;
  readonly #buckets: number[];
  readonly #samples = new Map<string, HistogramSample>();

  constructor(name: string, help: string, buckets: readonly number[]) {
    this.#name = name;
    this.#help = help;
    this.#buckets = [...buckets];
  }

  observe(labels: MetricLabels, value: number): void {
    if (!Number.isFinite(value) || value < 0) {
      return;
    }

    const normalizedLabels = normalizeLabels(labels);
    const key = buildLabelsKey(normalizedLabels);
    const existing = this.#samples.get(key);
    const sample = existing ?? {
      labels: normalizedLabels,
      bucketCounts: new Array(this.#buckets.length + 1).fill(0),
      count: 0,
      sum: 0,
    };

    for (let index = 0; index < this.#buckets.length; index += 1) {
      const bucketUpperBound = this.#buckets[index];
      if (value <= bucketUpperBound) {
        sample.bucketCounts[index] += 1;
      }
    }
    sample.bucketCounts[this.#buckets.length] += 1;
    sample.count += 1;
    sample.sum += value;

    if (!existing) {
      this.#samples.set(key, sample);
    }
  }

  render(): string {
    const lines = [
      `# HELP ${this.#name} ${escapeHelpText(this.#help)}`,
      `# TYPE ${this.#name} histogram`,
    ];

    const entries = [...this.#samples.entries()].sort(([first], [second]) => first.localeCompare(second));
    const samples = entries.length === 0
      ? [{
          labels: {} as MetricLabels,
          bucketCounts: new Array(this.#buckets.length + 1).fill(0),
          count: 0,
          sum: 0,
        }]
      : entries.map(([, entry]) => entry);

    for (const sample of samples) {
      for (let index = 0; index < this.#buckets.length; index += 1) {
        const bucketLabels = {
          ...sample.labels,
          le: formatFloat(this.#buckets[index] as number),
        };
        lines.push(buildSampleLine(`${this.#name}_bucket`, bucketLabels, sample.bucketCounts[index] ?? 0));
      }

      const infiniteLabels = {
        ...sample.labels,
        le: "+Inf",
      };
      lines.push(buildSampleLine(`${this.#name}_bucket`, infiniteLabels, sample.bucketCounts[this.#buckets.length] ?? 0));
      lines.push(buildSampleLine(`${this.#name}_sum`, sample.labels, sample.sum));
      lines.push(buildSampleLine(`${this.#name}_count`, sample.labels, sample.count));
    }

    return lines.join("\n");
  }

  reset(): void {
    this.#samples.clear();
  }
}
