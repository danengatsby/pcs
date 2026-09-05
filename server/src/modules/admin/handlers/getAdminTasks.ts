import type { RequestHandler } from "express";
import { requireAdminAccess, type AdminAccessContext, type AdminCapability } from "../../../lib/adminAuthorization.js";
import { sendSuccess } from "../../../lib/http.js";
import { prisma } from "../../../lib/prisma.js";
import { countRecruitmentTasks } from "../../volunteers/repositoryAdmin.js";
import { buildMembershipScopeWhere } from "../../members/adminDashboard.repository.js";
import { countMobilizationTasks } from "../../politicalOperations/politicalOperations.repository.js";

export async function readAdminTasks(access: AdminAccessContext) {
  const organizationWhere = access.scope.national ? {} : { organizationId: { in: access.scope.organizationIds } };
  // Only aggregate authorized queues; never load personal records to build menu badges.
  const queues: Array<[string, AdminCapability, () => Promise<number>]> = [
    ["volunteers", "recruitment.read", () => countRecruitmentTasks(access.scope)],
    ["members", "membership.read", () => prisma.membershipRecord.count({
      where: { AND: [buildMembershipScopeWhere(access.scope), { status: "application" }] },
    })],
    ["organizations", "organization.read", () => prisma.organizationObjective.count({
      where: { ...organizationWhere, status: { in: ["planned", "in_progress", "at_risk"] },
        OR: [{ status: "at_risk" }, { dueDate: { lt: new Date(new Date().toISOString().slice(0, 10)) } }] },
    })],
    ["mobilization", "mobilization.read", () => countMobilizationTasks(access.scope)],
    ["congresses", "congress.read", () => prisma.congress.count({
      where: { ...organizationWhere, status: { in: ["draft", "open", "closed"] } },
    })],
    ["arbitration", "arbitration.read", () => prisma.arbitrationCase.count({
      where: { ...organizationWhere, status: { in: ["submitted", "response_due", "hearing", "appealed"] } },
    })],
  ];
  const counts = Object.fromEntries(await Promise.all(queues
    .filter(([, capability]) => access.capabilities.includes(capability))
    .map(async ([key, , count]) => [key, await count()] as const)));
  return { generatedAt: new Date().toISOString(), counts, total: Object.values(counts).reduce((sum, value) => sum + value, 0) };
}

export const getAdminTasksHandler: RequestHandler = async (_req, res, next) => {
  try {
    res.setHeader("Cache-Control", "private, no-store");
    sendSuccess(res, await readAdminTasks(requireAdminAccess(res)));
  } catch (error) { next(error); }
};
