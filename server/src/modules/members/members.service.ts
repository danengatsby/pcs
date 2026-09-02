import { listMembersFromRepository, type MemberDbRow } from "./members.repository.js";
import type { ListMembersQuery } from "./members.schema.js";
import type { AdminTerritoryScope } from "../../lib/adminAuthorization.js";
import {
  isOrganizerRole,
  normalizeMemberRole,
  type MemberRole,
} from "./roleUtils.js";

export type MemberItem = {
  id: string;
  fullName: string;
  email: string;
  county: string;
  locality: string;
  status: "nou" | "validat" | "contactat" | "activ";
  role: MemberRole;
  createdAt: string;
};

function mapMemberRow(row: MemberDbRow): MemberItem {
  const role = normalizeMemberRole(row.role, row.workflowStatus);
  return {
    id: row.id,
    fullName: row.fullName,
    email: row.email,
    county: row.county,
    locality: row.locality,
    status: row.workflowStatus,
    role,
    createdAt: row.createdAt,
  };
}

export async function listMembersService(
  filters: ListMembersQuery,
  scope: AdminTerritoryScope
): Promise<{
  rows: MemberItem[];
  total: number;
  leadershipCount: number;
}> {
  const result = await listMembersFromRepository(filters, scope);
  const rows = result.rows.map(mapMemberRow);

  let leadershipCount = 0;
  for (const item of rows) {
    if (isOrganizerRole(item.role)) {
      leadershipCount += 1;
    }
  }

  return {
    rows,
    total: result.total,
    leadershipCount,
  };
}
