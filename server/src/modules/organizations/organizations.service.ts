import { listOrganizationsRepository } from "./organizations.repository.js";
import type { ListOrganizationsQuery } from "./organizations.schema.js";

export async function listOrganizationsService(filters: ListOrganizationsQuery): Promise<{
  rows: Awaited<ReturnType<typeof listOrganizationsRepository>>["rows"];
  total: number;
}> {
  return listOrganizationsRepository(filters);
}
