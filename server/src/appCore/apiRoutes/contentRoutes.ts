import type { ApiRouteDefinition } from "../apiRouteTypes.js";
import { requireAdminCapability, requireAuth } from "../../lib/authMiddleware.js";
import {
  createAdminNews,
  deleteAdminNews,
  getAdminNewsById,
  listAdminNews,
  updateAdminNews,
} from "../../modules/news/handlers/admin/index.js";
import { deleteMediaAsset, listMediaLibrary, uploadMedia } from "../../modules/news/handlers/media/index.js";

const newsReadGuard = requireAdminCapability("content.read");
const newsWriteGuard = requireAdminCapability("content.write");

export const contentRoutes: ApiRouteDefinition[] = [
  { method: "GET", url: "/api/news/admin/list", handlers: [requireAuth, newsReadGuard, listAdminNews] },
  { method: "GET", url: "/api/news/admin/:id", handlers: [requireAuth, newsReadGuard, getAdminNewsById] },
  { method: "POST", url: "/api/news", handlers: [requireAuth, newsWriteGuard, createAdminNews] },
  { method: "PUT", url: "/api/news/:id", handlers: [requireAuth, newsWriteGuard, updateAdminNews] },
  { method: "DELETE", url: "/api/news/:id", handlers: [requireAuth, newsWriteGuard, deleteAdminNews] },
  { method: "GET", url: "/api/news/media/library", handlers: [requireAuth, newsReadGuard, listMediaLibrary] },
  { method: "POST", url: "/api/news/media/upload", handlers: [requireAuth, newsWriteGuard, uploadMedia] },
  { method: "DELETE", url: "/api/news/media/library/:assetId", handlers: [requireAuth, newsWriteGuard, deleteMediaAsset] },
];
