import type { MetricLabels } from "./types.js";

export function normalizeLabels(labels: MetricLabels): MetricLabels {
  const normalized: MetricLabels = {};
  for (const [key, value] of Object.entries(labels)) {
    if (!key) {
      continue;
    }
    normalized[key] = normalizeLabelValue(value);
  }
  return normalized;
}

function replaceControlCharacters(value: string): string {
  let result = "";
  for (const character of value) {
    const code = character.charCodeAt(0);
    if ((code >= 0 && code <= 31) || code === 127) {
      result += " ";
      continue;
    }
    result += character;
  }
  return result;
}

function normalizeLabelValue(value: string): string {
  const normalized = replaceControlCharacters(value).trim();
  if (!normalized) {
    return "unknown";
  }
  return normalized.slice(0, 160);
}

export function buildLabelsKey(labels: MetricLabels): string {
  return Object.entries(labels)
    .sort(([first], [second]) => first.localeCompare(second))
    .map(([key, value]) => `${key}=${value}`)
    .join("|");
}

export function escapeHelpText(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/\n/g, "\\n");
}

function escapeLabelValue(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/"/g, "\\\"");
}

function formatLabels(labels: MetricLabels): string {
  const entries = Object.entries(labels).sort(([first], [second]) => first.localeCompare(second));
  if (entries.length === 0) {
    return "";
  }

  return entries
    .map(([key, value]) => `${key}="${escapeLabelValue(value)}"`)
    .join(",");
}

export function formatFloat(value: number): string {
  if (!Number.isFinite(value)) {
    return "0";
  }
  return Number.isInteger(value) ? String(value) : String(value);
}

export function buildSampleLine(metricName: string, labels: MetricLabels, value: number): string {
  const labelsText = formatLabels(labels);
  const valueText = formatFloat(value);
  if (!labelsText) {
    return `${metricName} ${valueText}`;
  }
  return `${metricName}{${labelsText}} ${valueText}`;
}
