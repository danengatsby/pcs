import { listElectionsRepository } from "./elections.repository.js";
import type { ListElectionsQuery } from "./elections.schema.js";

export async function listElectionsService(filters: ListElectionsQuery): Promise<{
  rows: Awaited<ReturnType<typeof listElectionsRepository>>["rows"];
  total: number;
}> {
  return listElectionsRepository(filters);
}
