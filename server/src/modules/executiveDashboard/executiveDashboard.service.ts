import { AppError } from "../../lib/errors.js";
import type { AdminTerritoryScope } from "../../lib/adminAuthorization.js";
import {
  readExecutiveDashboardSnapshot,
  updateExecutiveTarget,
  type ExecutiveTargetRow,
} from "./executiveDashboard.repository.js";
import type {
  ExecutiveTargetKey,
  UpdateExecutiveTargetInput,
} from "./executiveDashboard.schema.js";

type ObjectiveStatus = "achieved" | "on_track" | "at_risk";

function roundRate(value: number): number {
  return Math.round(value * 10) / 10;
}

function calculateRate(numerator: number, denominator: number): number {
  return denominator > 0 ? roundRate((numerator / denominator) * 100) : 0;
}

function currentValueForTarget(
  key: ExecutiveTargetKey,
  values: {
    contactRate: number;
    memberConversionRate: number;
    overdueCases: number;
    activeOrganizations: number;
  }
): number {
  if (key === "contact_rate") {
    return values.contactRate;
  }
  if (key === "member_conversion_rate") {
    return values.memberConversionRate;
  }
  if (key === "overdue_cases") {
    return values.overdueCases;
  }
  return values.activeOrganizations;
}

function evaluateObjective(currentValue: number, target: ExecutiveTargetRow): {
  status: ObjectiveStatus;
  progressPercent: number;
} {
  if (target.direction === "at_least") {
    if (currentValue >= target.targetValue) {
      return { status: "achieved", progressPercent: 100 };
    }

    const progressPercent = target.targetValue > 0
      ? Math.min(100, Math.round((currentValue / target.targetValue) * 100))
      : 0;

    return {
      status: progressPercent >= 80 ? "on_track" : "at_risk",
      progressPercent,
    };
  }

  if (currentValue <= target.targetValue) {
    return { status: "achieved", progressPercent: 100 };
  }

  const tolerance = Math.max(2, target.targetValue * 0.2);
  const status: ObjectiveStatus = currentValue <= target.targetValue + tolerance ? "on_track" : "at_risk";
  const progressPercent = Math.max(0, 100 - Math.round((currentValue - target.targetValue) * 10));
  return { status, progressPercent };
}

export async function getExecutiveDashboardService(scope: AdminTerritoryScope): Promise<{
  generatedAt: string;
  summary: {
    applicationsTotal: number;
    applicationsLast30Days: number;
    contactedTotal: number;
    uncontactedCases: number;
    membersTotal: number;
    contactRate: number;
    memberConversionRate: number;
    overdueCases: number;
    activeOrganizations: number;
    countiesWithoutResponsible: number;
  };
  trends: Awaited<ReturnType<typeof readExecutiveDashboardSnapshot>>["trends"];
  counties: Awaited<ReturnType<typeof readExecutiveDashboardSnapshot>>["counties"];
  workflow: Array<{ status: "nou" | "validat" | "contactat" | "activ"; count: number }>;
  countiesWithoutResponsible: string[];
  objectives: Array<ExecutiveTargetRow & {
    currentValue: number;
    status: ObjectiveStatus;
    progressPercent: number;
  }>;
  definitions: {
    contactRate: string;
    memberConversionRate: string;
    overdueCases: string;
    activeOrganizations: string;
    uncontactedCases: string;
    countiesWithoutResponsible: string;
    trends: string;
  };
}> {
  const generatedAt = new Date();
  const snapshot = await readExecutiveDashboardSnapshot(scope, generatedAt);
  const contactRate = calculateRate(snapshot.summary.contactedTotal, snapshot.summary.applicationsTotal);
  const memberConversionRate = calculateRate(snapshot.summary.membersTotal, snapshot.summary.applicationsTotal);
  const currentValues = {
    contactRate,
    memberConversionRate,
    overdueCases: snapshot.summary.overdueCases,
    activeOrganizations: snapshot.summary.activeOrganizations,
  };
  const workflowCounts = new Map(snapshot.workflow.map((row) => [row.status, row.count]));

  return {
    generatedAt: generatedAt.toISOString(),
    summary: {
      ...snapshot.summary,
      contactRate,
      memberConversionRate,
    },
    trends: snapshot.trends,
    counties: snapshot.counties,
    workflow: (["nou", "validat", "contactat", "activ"] as const).map((status) => ({
      status,
      count: workflowCounts.get(status) ?? 0,
    })),
    countiesWithoutResponsible: snapshot.countiesWithoutResponsible,
    objectives: snapshot.targets.map((target) => {
      const currentValue = currentValueForTarget(target.key, currentValues);
      return {
        ...target,
        currentValue,
        ...evaluateObjective(currentValue, target),
      };
    }),
    definitions: {
      contactRate: "Cereri aflate în starea contactat/activ sau cu un contact înregistrat, raportate la totalul cererilor.",
      memberConversionRate: "Cereri ajunse la membru/rol de conducere, raportate la totalul cererilor.",
      overdueCases: "Cereri noi neatinse de peste 48 de ore sau cu follow-up/reminder depășit, exceptând dosarele active.",
      activeOrganizations: "Organizații marcate active în registrul organizațional.",
      uncontactedCases: "Dosare fără niciun contact înregistrat și care nu au ajuns în starea contactat/activ.",
      countiesWithoutResponsible: "Județe fără mandat activ într-o organizație județeană sau locală.",
      trends: "Cohorte lunare: cererile create în luna respectivă și situația lor curentă.",
    },
  };
}

export async function updateExecutiveTargetService(input: {
  key: ExecutiveTargetKey;
  payload: UpdateExecutiveTargetInput;
  updatedBy: bigint;
}): Promise<Awaited<ReturnType<typeof updateExecutiveTarget>>> {
  if (
    (input.key === "contact_rate" || input.key === "member_conversion_rate")
    && input.payload.targetValue > 100
  ) {
    throw new AppError(400, "EXECUTIVE_TARGET_INVALID", "Țintele procentuale nu pot depăși 100%.");
  }

  return updateExecutiveTarget({
    key: input.key,
    targetValue: input.payload.targetValue,
    updatedBy: input.updatedBy,
  });
}
