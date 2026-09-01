import { randomUUID } from "node:crypto";

const startedAt = Date.now();
const startedAtIso = new Date(startedAt).toISOString();
const bootId = randomUUID();

let draining = false;

export function setRuntimeDraining(value: boolean): void {
  draining = value;
}

export function isRuntimeDraining(): boolean {
  return draining;
}

export function readRuntimeSnapshot(nowMs = Date.now()): {
  bootId: string;
  startedAt: string;
  uptimeSeconds: number;
  draining: boolean;
} {
  const uptimeSeconds = Math.max(0, Math.floor((nowMs - startedAt) / 1000));
  return {
    bootId,
    startedAt: startedAtIso,
    uptimeSeconds,
    draining,
  };
}
