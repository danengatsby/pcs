import type { ListOrganizationsQuery, OrganizationRecord } from "./organizations.schema.js";

const organizationsSeed: OrganizationRecord[] = [
  {
    id: "org-national-pcp",
    level: "national",
    name: "PCP Organizatia Nationala",
    county: "Bucuresti",
    membersCount: 0,
    createdAt: new Date(0).toISOString(),
  },
];

function normalizeSearch(value: string): string {
  return value.trim().toLowerCase();
}

export async function listOrganizationsRepository(filters: ListOrganizationsQuery): Promise<{
  rows: OrganizationRecord[];
  total: number;
}> {
  const search = normalizeSearch(filters.search);

  const filtered = organizationsSeed.filter((row) => {
    const levelMatch = !filters.level || row.level === filters.level;
    const searchMatch = !search
      || row.name.toLowerCase().includes(search)
      || row.county.toLowerCase().includes(search);
    return levelMatch && searchMatch;
  });

  const rows = filtered.slice(filters.offset, filters.offset + filters.limit);

  return {
    rows,
    total: filtered.length,
  };
}
