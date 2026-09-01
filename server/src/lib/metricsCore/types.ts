export type MetricLabels = Record<string, string>;

export type CounterSample = {
  labels: MetricLabels;
  value: number;
};

export type HistogramSample = {
  labels: MetricLabels;
  bucketCounts: number[];
  count: number;
  sum: number;
};
