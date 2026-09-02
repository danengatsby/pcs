import { listElectionsRepository } from "./elections.repository.js";
import type { ListElectionsQuery } from "./elections.schema.js";
import { readRegulatedModuleGate } from "../governance/regulatedModules.repository.js";

export async function listElectionsService(filters: ListElectionsQuery): Promise<{
  rows: Awaited<ReturnType<typeof listElectionsRepository>>["rows"];
  total: number;
  governance: Awaited<ReturnType<typeof readRegulatedModuleGate>>;
}> {
  const governance = await readRegulatedModuleGate("electoral");
  if (!governance.enabled) {return { rows: [], total: 0, governance };}
  return { ...await listElectionsRepository(filters), governance };
}
