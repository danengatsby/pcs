import type { UserRole } from "../../lib/authToken.js";
import {
  listAdminMembersDashboardFromRepository,
  type AdminMembersDashboardUserRow,
} from "./adminDashboard.repository.js";
import type { AdminMembersDashboardQuery } from "./adminDashboard.schema.js";

const organizerRoleOrder: Record<UserRole, number> = {
  PRESEDINTE: 0,
  VICEPRESEDINTE: 1,
  SECRETAR: 2,
  CONSILIER: 3,
  MEMBRU: 4,
  ADERENT: 5,
  SUSTINATOR: 6,
};

export type AdminMembersDashboardItem = AdminMembersDashboardUserRow;

function sortOrganizers(rows: AdminMembersDashboardItem[]): AdminMembersDashboardItem[] {
  return [...rows].sort((left, right) => {
    const leftOrder = organizerRoleOrder[left.role] ?? Number.MAX_SAFE_INTEGER;
    const rightOrder = organizerRoleOrder[right.role] ?? Number.MAX_SAFE_INTEGER;
    if (leftOrder !== rightOrder) {
      return leftOrder - rightOrder;
    }

    return right.createdAt.localeCompare(left.createdAt);
  });
}

export async function listAdminMembersDashboardService(filters: AdminMembersDashboardQuery): Promise<{
  summary: {
    total: number;
    aderenti: number;
    membri: number;
    organizatori: number;
  };
  groups: {
    aderenti: {
      label: string;
      count: number;
      rows: AdminMembersDashboardItem[];
    };
    membri: {
      label: string;
      count: number;
      rows: AdminMembersDashboardItem[];
    };
    organizatori: {
      label: string;
      count: number;
      rows: AdminMembersDashboardItem[];
    };
  };
  filters: {
    search: string;
    limit: number;
  };
}> {
  const result = await listAdminMembersDashboardFromRepository(filters);
  const total = result.aderenti.count + result.membri.count + result.organizatori.count;

  return {
    summary: {
      total,
      aderenti: result.aderenti.count,
      membri: result.membri.count,
      organizatori: result.organizatori.count,
    },
    groups: {
      aderenti: {
        label: "Aderenți",
        count: result.aderenti.count,
        rows: result.aderenti.rows,
      },
      membri: {
        label: "Membri",
        count: result.membri.count,
        rows: result.membri.rows,
      },
      organizatori: {
        label: "Organizatori",
        count: result.organizatori.count,
        rows: sortOrganizers(result.organizatori.rows),
      },
    },
    filters: {
      search: filters.search,
      limit: filters.limit,
    },
  };
}
