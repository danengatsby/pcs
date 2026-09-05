import type { ApiRouteDefinition } from "../apiRouteTypes.js";
import {
  getPublicNewsById,
  listPublicNews,
} from "../../modules/news/handlers/public/index.js";
import {
  createVolunteerHandler,
  listVolunteerCountiesHandler,
} from "../../modules/volunteers/handlers/public/index.js";
import { volunteersRateLimiter } from "../../modules/volunteers/rateLimiters.js";
import {
  createMobilizationResponseController,
  listMobilizationActionsController,
} from "../../modules/mobilization/mobilization.controller.js";
import { mobilizationRateLimiter } from "../../modules/mobilization/mobilization.rateLimit.js";
import { listOrganizationsController } from "../../modules/organizations/organizations.controller.js";
import { listFinanceController } from "../../modules/finance/finance.controller.js";
import { listElectionsController } from "../../modules/elections/elections.controller.js";
import { listStatsHandler } from "../../modules/stats/handlers/listStats.js";
import { congressResultsController } from "../../modules/congress/congress.controller.js";
import { listGovernanceJournalController } from "../../modules/governanceJournal/governanceJournal.controller.js";

export const publicRoutes: ApiRouteDefinition[] = [
  { method: "GET", url: "/api/news", handlers: [listPublicNews] },
  { method: "GET", url: "/api/news/:id", handlers: [getPublicNewsById] },
  { method: "GET", url: "/api/stats", handlers: [listStatsHandler] },
  { method: "GET", url: "/api/volunteers/counties", handlers: [listVolunteerCountiesHandler] },
  { method: "GET", url: "/api/meta/counties", handlers: [listVolunteerCountiesHandler] },
  { method: "POST", url: "/api/volunteers", handlers: [volunteersRateLimiter, createVolunteerHandler] },
  { method: "GET", url: "/api/mobilization/actions", handlers: [listMobilizationActionsController] },
  {
    method: "POST",
    url: "/api/mobilization/actions/:slug/responses",
    handlers: [mobilizationRateLimiter, createMobilizationResponseController],
  },
  { method: "GET", url: "/api/organizations", handlers: [listOrganizationsController] },
  { method: "GET", url: "/api/finance", handlers: [listFinanceController] },
  { method: "GET", url: "/api/elections", handlers: [listElectionsController] },
  { method: "GET", url: "/api/congresses/:id/results", handlers: [congressResultsController] },
  { method: "GET", url: "/api/governance/journal", handlers: [listGovernanceJournalController] },
];
