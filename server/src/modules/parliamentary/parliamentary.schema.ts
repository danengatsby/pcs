import { z } from "zod";
import { calendarDate, pagination, reasonSchema, versionSchema } from "../admin/workspaceRecords.js";

export const parliamentaryKinds = ["bill", "amendment", "question", "committee_work"] as const;
export const parliamentaryChambers = ["deputies", "senate", "joint"] as const;
export const parliamentaryStatuses = ["draft", "submitted", "committee", "scheduled", "adopted", "rejected", "withdrawn"] as const;
export type ParliamentaryStatus = typeof parliamentaryStatuses[number];
export const parliamentaryTransitions: Record<ParliamentaryStatus, ParliamentaryStatus[]> = {
  draft: ["submitted", "withdrawn"], submitted: ["committee", "scheduled", "withdrawn"],
  committee: ["scheduled", "withdrawn"], scheduled: ["committee", "adopted", "rejected", "withdrawn"],
  adopted: [], rejected: [], withdrawn: [],
};
export const parliamentaryFieldsSchema = z.object({
  title: z.string().trim().min(5).max(240), kind: z.enum(parliamentaryKinds), chamber: z.enum(parliamentaryChambers),
  reference: z.string().trim().max(100),
  sourceUrl: z.string().trim().max(2000).refine((value) => {
    if (!value) { return true; }
    try { const url = new URL(value); return url.protocol === "https:" && !url.username && !url.password; } catch { return false; }
  }, "Folosește o adresă HTTPS validă, fără date de autentificare."),
  description: z.string().trim().min(10).max(10000),
  assignedTo: z.string().regex(/^[1-9]\d{0,14}$/).nullable(), dueOn: calendarDate.nullable(),
}).strict();
export const createParliamentarySchema = parliamentaryFieldsSchema.extend({ requestId: z.string().uuid() }).strict();
export const updateParliamentarySchema = parliamentaryFieldsSchema.extend({ version: versionSchema }).strict();
export const transitionParliamentarySchema = z.object({ version: versionSchema, status: z.enum(parliamentaryStatuses), reason: reasonSchema }).strict();
export const listParliamentarySchema = z.object({ ...pagination,
  search: z.string().trim().max(120).default(""), status: z.enum(parliamentaryStatuses).optional(),
  chamber: z.enum(parliamentaryChambers).optional(), pending: z.enum(["true", "false"]).default("false"),
});
export type ParliamentaryFields = z.infer<typeof parliamentaryFieldsSchema>;
export type ParliamentaryQuery = z.infer<typeof listParliamentarySchema>;
