import assert from "node:assert/strict";
import { test } from "node:test";
import request from "supertest";
import { createApp } from "../../app.js";
import { flushAdminAuditOutboxWorker } from "../../lib/adminAuditOutboxWorker.js";
import { query } from "../../lib/db.js";
import { buildTestEmail, deleteUserByEmail, deleteVolunteerByEmail } from "../helpers/dbTestUtils.js";

const app = createApp();

type AuditListItem = {
  action: string;
  targetType: string;
};

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

test("admin endpoints should update volunteer workflow, export csv and expose audit entries", async () => {
  const adminEmail = buildTestEmail("admin-workflow");
  const ownerEmail = buildTestEmail("admin-owner");
  const volunteerEmail = buildTestEmail("admin-volunteer");
  const password = "ParolaFoarteBuna#2026";

  try {
    await request(app)
      .post("/api/auth/signup")
      .send({
        fullName: "Admin Workflow",
        email: adminEmail,
        password,
      })
      .expect(201);

    await query(
      `
        UPDATE users
        SET role = 'PRESEDINTE'
        WHERE LOWER(email) = LOWER($1)
      `,
      [adminEmail]
    );

    await request(app)
      .post("/api/auth/signup")
      .send({
        fullName: "Owner Workflow",
        email: ownerEmail,
        password,
      })
      .expect(201);

    await query(
      `
        UPDATE users
        SET role = 'CONSILIER'
        WHERE LOWER(email) = LOWER($1)
      `,
      [ownerEmail]
    );

    const signinResponse = await request(app)
      .post("/api/auth/signin")
      .send({
        email: adminEmail,
        password,
      })
      .expect(200);

    const token = signinResponse.body?.data?.token as string | undefined;
    const adminUserId = signinResponse.body?.data?.user?.id as string | undefined;
    assert.ok(token);
    assert.ok(adminUserId);

    await request(app)
      .post("/api/volunteers")
      .send({
        fullName: "Voluntar Admin",
        email: volunteerEmail,
        password: "ParolaFoarteBuna#2026",
        phone: "0712345678",
        county: "Iasi",
        locality: "Iasi",
        skills: "organizare",
        motivation: "Imi doresc sa contribui la proiecte locale pe termen lung.",
        website: "",
      })
      .expect(201);

    const volunteersResponse = await request(app)
      .get("/api/admin/volunteers")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    const volunteers = volunteersResponse.body?.data as Array<{ id: number; email: string; county: string }> | undefined;
    assert.ok(Array.isArray(volunteers));
    const volunteer = volunteers?.find((item) => item.email === volunteerEmail.toLowerCase());
    assert.ok(volunteer);
    assert.equal(volunteer?.county, "Iași");

    const volunteerDetailResponse = await request(app)
      .get(`/api/admin/volunteers/${volunteer!.id}`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    const volunteerDetail = volunteerDetailResponse.body?.data as {
      id: number;
      volunteerId: number | null;
      email: string;
      county: string;
    } | undefined;
    assert.ok(volunteerDetail);
    assert.equal(volunteerDetail?.id, volunteer?.id);
    assert.equal(volunteerDetail?.volunteerId, volunteer?.id);
    assert.equal(volunteerDetail?.email, volunteerEmail.toLowerCase());
    assert.equal(volunteerDetail?.county, "Iași");

    const filteredResponse = await request(app)
      .get(
        `/api/admin/volunteers?limit=5&search=${encodeURIComponent(
          volunteerEmail
        )}&county=${encodeURIComponent("Iași")}&locality=${encodeURIComponent("Iasi")}&skills=organizare`
      )
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    const filteredRows = filteredResponse.body?.data as Array<{
      email: string;
      county: string;
      locality: string;
      skills: string;
    }> | undefined;
    assert.ok(Array.isArray(filteredRows));
    assert.ok((filteredRows?.length ?? 0) > 0);
    const filteredVolunteer = filteredRows?.find((item) => item.email === volunteerEmail.toLowerCase());
    assert.ok(filteredVolunteer);
    assert.equal(filteredVolunteer?.county, "Iași");
    assert.equal(filteredVolunteer?.locality, "Iasi");
    assert.match(filteredVolunteer?.skills ?? "", /organizare/i);

    const filteredMeta = filteredResponse.body?.meta as Record<string, unknown> | undefined;
    assert.equal(filteredMeta?.mode, "keyset");
    const nextCursor = filteredMeta?.nextCursor;
    assert.equal(nextCursor === null || typeof nextCursor === "string", true);

    const ownersResponse = await request(app)
      .get("/api/admin/volunteers/owners")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    const owners = ownersResponse.body?.data as Array<{
      id: string;
      email: string;
      role: string;
    }> | undefined;
    assert.ok(Array.isArray(owners));
    const selectedOwner = owners?.find((item) => item.email === ownerEmail.toLowerCase());
    assert.ok(selectedOwner);
    assert.equal(selectedOwner?.role, "CONSILIER");

    const workflowResponse = await request(app)
      .patch(`/api/admin/volunteers/${volunteer!.id}/workflow`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        status: "contactat",
        internalNotes: "Voluntar contactat telefonic de echipa locala.",
        ownerUserId: Number(selectedOwner!.id),
        followUpAt: "2026-04-05T08:30:00.000Z",
        reminderAt: "2026-04-04T18:00:00.000Z",
        lastContactAt: "2026-04-03T07:15:00.000Z",
        contactChannel: "telefon",
        priority: "ridicata",
        rejectionReason: "",
        tags: ["student", "organizator"],
        skillTags: ["telefonic", "teren"],
      })
      .expect(200);

    const updatedVolunteer = workflowResponse.body?.data?.volunteer as {
      statusUpdatedByUserId?: string | null;
      statusUpdatedByName?: string | null;
      statusUpdatedByEmail?: string | null;
      ownerUserId?: string | null;
      ownerEmail?: string | null;
      priority?: string | null;
      contactChannel?: string | null;
      followUpAt?: string | null;
      reminderAt?: string | null;
      lastContactAt?: string | null;
      tags?: string[];
      skillTags?: string[];
    } | undefined;
    assert.equal(updatedVolunteer?.statusUpdatedByUserId, adminUserId);
    assert.equal(updatedVolunteer?.statusUpdatedByName, "Admin Workflow");
    assert.equal(updatedVolunteer?.statusUpdatedByEmail, adminEmail.toLowerCase());
    assert.equal(updatedVolunteer?.ownerUserId, selectedOwner?.id);
    assert.equal(updatedVolunteer?.ownerEmail, ownerEmail.toLowerCase());
    assert.equal(updatedVolunteer?.priority, "ridicata");
    assert.equal(updatedVolunteer?.contactChannel, "telefon");
    assert.equal(updatedVolunteer?.followUpAt, "2026-04-05T08:30:00.000Z");
    assert.equal(updatedVolunteer?.reminderAt, "2026-04-04T18:00:00.000Z");
    assert.equal(updatedVolunteer?.lastContactAt, "2026-04-03T07:15:00.000Z");
    assert.deepEqual(updatedVolunteer?.tags, ["student", "organizator"]);
    assert.deepEqual(updatedVolunteer?.skillTags, ["telefonic", "teren"]);

    await request(app)
      .patch(`/api/admin/volunteers/${volunteer!.id}/workflow`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        status: "activ",
        internalNotes: "Voluntar confirmat pentru teren si follow-up local.",
        ownerUserId: Number(selectedOwner!.id),
        followUpAt: "2026-04-06T09:00:00.000Z",
        reminderAt: "2026-04-05T16:00:00.000Z",
        lastContactAt: "2026-04-04T08:00:00.000Z",
        contactChannel: "email",
        priority: "critica",
        rejectionReason: "",
        tags: ["coordonator"],
        skillTags: ["door-to-door", "fundraising"],
      })
      .expect(200);

    const csvResponse = await request(app)
      .get(`/api/admin/volunteers/export.csv?search=${encodeURIComponent(volunteerEmail)}`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    assert.match(String(csvResponse.headers["content-type"] ?? ""), /text\/csv/i);
    assert.match(csvResponse.text, new RegExp(escapeRegExp(volunteerEmail.toLowerCase())));
    assert.match(csvResponse.text, /door-to-door \| fundraising/);

    const auditResponse = await request(app)
      .get("/api/admin/audit?limit=100")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    const auditRows = auditResponse.body?.data as AuditListItem[] | undefined;
    assert.ok(Array.isArray(auditRows));
    const hasWorkflowAudit = auditRows?.some(
      (row) => row.action === "volunteer.workflow_update" && row.targetType === "volunteer"
    );
    assert.equal(hasWorkflowAudit, true);

    const volunteerAuditResponse = await request(app)
      .get(`/api/admin/audit?limit=1&targetType=volunteer&targetId=${encodeURIComponent(String(volunteer!.id))}`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    const volunteerAuditRows = volunteerAuditResponse.body?.data as Array<{
      action: string;
      targetType: string;
      targetId: string;
      actorEmail: string;
      details: {
        nextStatus?: string;
      };
    }> | undefined;
    const volunteerAuditMeta = volunteerAuditResponse.body?.meta as { nextCursor?: string | null } | undefined;
    assert.ok(Array.isArray(volunteerAuditRows));
    assert.equal(volunteerAuditRows?.length, 1);
    assert.equal(volunteerAuditRows?.[0]?.action, "volunteer.workflow_update");
    assert.equal(volunteerAuditRows?.[0]?.targetType, "volunteer");
    assert.equal(volunteerAuditRows?.[0]?.targetId, String(volunteer!.id));
    assert.equal(volunteerAuditRows?.[0]?.actorEmail, adminEmail.toLowerCase());
    assert.equal(volunteerAuditRows?.[0]?.details?.nextStatus, "activ");
    assert.equal(typeof volunteerAuditMeta?.nextCursor, "string");

    const volunteerAuditPageTwoResponse = await request(app)
      .get(
        `/api/admin/audit?limit=1&targetType=volunteer&targetId=${encodeURIComponent(
          String(volunteer!.id)
        )}&cursor=${encodeURIComponent(String(volunteerAuditMeta?.nextCursor ?? ""))}`
      )
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    const volunteerAuditPageTwoRows = volunteerAuditPageTwoResponse.body?.data as Array<{
      details: {
        nextStatus?: string;
      };
    }> | undefined;
    assert.ok(Array.isArray(volunteerAuditPageTwoRows));
    assert.equal(volunteerAuditPageTwoRows?.length, 1);
    assert.equal(volunteerAuditPageTwoRows?.[0]?.details?.nextStatus, "contactat");
  } finally {
    await deleteVolunteerByEmail(volunteerEmail);
    await deleteUserByEmail(volunteerEmail);
    await deleteUserByEmail(ownerEmail);
    await deleteUserByEmail(adminEmail);
  }
});

test("admin volunteers should include aderent users even without volunteer form rows", async () => {
  const adminEmail = buildTestEmail("admin-users-list");
  const aderentEmail = buildTestEmail("admin-users-list-aderent");
  const password = "ParolaFoarteBuna#2026";

  try {
    await request(app)
      .post("/api/auth/signup")
      .send({
        fullName: "Admin Users List",
        email: adminEmail,
        password,
      })
      .expect(201);

    await query(
      `
        UPDATE users
        SET role = 'PRESEDINTE'
        WHERE LOWER(email) = LOWER($1)
      `,
      [adminEmail]
    );

    await request(app)
      .post("/api/auth/signup")
      .send({
        fullName: "Aderent Fara Formular",
        email: aderentEmail,
        password,
      })
      .expect(201);

    const signinResponse = await request(app)
      .post("/api/auth/signin")
      .send({
        email: adminEmail,
        password,
      })
      .expect(200);

    const token = signinResponse.body?.data?.token as string | undefined;
    assert.ok(token);

    const volunteersResponse = await request(app)
      .get(`/api/admin/volunteers?search=${encodeURIComponent(aderentEmail)}`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    const volunteers = volunteersResponse.body?.data as Array<{
      id: number;
      email: string;
      volunteerId: number | null;
      accountRole: string | null;
      recordSource: string;
      workflowStatus: string;
    }> | undefined;
    assert.ok(Array.isArray(volunteers));

    const aderent = volunteers?.find((item) => item.email === aderentEmail.toLowerCase());
    assert.ok(aderent);
    assert.equal(aderent?.volunteerId, null);
    assert.equal(aderent?.accountRole, "ADERENT");
    assert.equal(aderent?.recordSource, "user");
    assert.equal(aderent?.workflowStatus, "validat");

    const aderentDetailResponse = await request(app)
      .get(`/api/admin/volunteers/${aderent!.id}`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    const aderentDetail = aderentDetailResponse.body?.data as {
      id: number;
      volunteerId: number | null;
      email: string;
      accountRole: string | null;
      recordSource: string;
      workflowStatus: string;
    } | undefined;
    assert.ok(aderentDetail);
    assert.equal(aderentDetail?.id, aderent?.id);
    assert.equal(aderentDetail?.volunteerId, null);
    assert.equal(aderentDetail?.email, aderentEmail.toLowerCase());
    assert.equal(aderentDetail?.accountRole, "ADERENT");
    assert.equal(aderentDetail?.recordSource, "user");
    assert.equal(aderentDetail?.workflowStatus, "validat");
  } finally {
    await deleteUserByEmail(aderentEmail);
    await deleteUserByEmail(adminEmail);
  }
});

test("admin should bulk update volunteer workflow for multiple records", async () => {
  const adminEmail = buildTestEmail("admin-bulk-workflow");
  const volunteerEmailOne = buildTestEmail("admin-bulk-volunteer-one");
  const volunteerEmailTwo = buildTestEmail("admin-bulk-volunteer-two");
  const password = "ParolaFoarteBuna#2026";

  try {
    await request(app)
      .post("/api/auth/signup")
      .send({
        fullName: "Admin Bulk Workflow",
        email: adminEmail,
        password,
      })
      .expect(201);

    await query(
      `
        UPDATE users
        SET role = 'PRESEDINTE'
        WHERE LOWER(email) = LOWER($1)
      `,
      [adminEmail]
    );

    const signinResponse = await request(app)
      .post("/api/auth/signin")
      .send({
        email: adminEmail,
        password,
      })
      .expect(200);

    const token = signinResponse.body?.data?.token as string | undefined;
    assert.ok(token);

    for (const email of [volunteerEmailOne, volunteerEmailTwo]) {
      await request(app)
        .post("/api/volunteers")
        .send({
          fullName: `Voluntar ${email}`,
          email,
          password: "ParolaFoarteBuna#2026",
          phone: "0712345678",
          county: "Cluj",
          locality: "Cluj-Napoca",
          skills: "organizare",
          motivation: "Imi doresc sa contribui la proiecte locale pe termen lung.",
          website: "",
        })
        .expect(201);
    }

    const volunteersResponse = await request(app)
      .get(`/api/admin/volunteers?search=${encodeURIComponent("admin-bulk-volunteer")}`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    const volunteers = volunteersResponse.body?.data as Array<{
      id: number;
      volunteerId: number | null;
      email: string;
      workflowStatus: string;
    }> | undefined;
    assert.ok(Array.isArray(volunteers));

    const selectedVolunteerIds = (volunteers ?? [])
      .filter((item) => item.email === volunteerEmailOne.toLowerCase() || item.email === volunteerEmailTwo.toLowerCase())
      .map((item) => item.volunteerId)
      .filter((value): value is number => typeof value === "number");

    assert.equal(selectedVolunteerIds.length, 2);

    const bulkResponse = await request(app)
      .patch("/api/admin/volunteers/workflow/bulk")
      .set("Authorization", `Bearer ${token}`)
      .send({
        target: {
          type: "ids",
          volunteerIds: selectedVolunteerIds,
        },
        status: "activ",
      })
      .expect(200);

    const bulkData = bulkResponse.body?.data as {
      updatedCount: number;
      skippedCount: number;
      missingCount: number;
      updatedVolunteerIds: number[];
    } | undefined;
    assert.ok(bulkData);
    assert.equal(bulkData?.updatedCount, 2);
    assert.equal(bulkData?.skippedCount, 0);
    assert.equal(bulkData?.missingCount, 0);
    assert.deepEqual(new Set(bulkData?.updatedVolunteerIds ?? []), new Set(selectedVolunteerIds));

    await flushAdminAuditOutboxWorker("test:bulk-update:first");

    const updatedVolunteersResponse = await request(app)
      .get(`/api/admin/volunteers?search=${encodeURIComponent("admin-bulk-volunteer")}`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    const updatedVolunteers = updatedVolunteersResponse.body?.data as Array<{
      email: string;
      workflowStatus: string;
    }> | undefined;
    assert.ok(Array.isArray(updatedVolunteers));
    assert.equal(updatedVolunteers?.every((item) => item.workflowStatus === "activ"), true);

    const auditResponse = await request(app)
      .get("/api/admin/audit?limit=50&action=volunteer.workflow_bulk_update&targetType=volunteer")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    const auditRows = auditResponse.body?.data as Array<{
      targetId: string;
      action: string;
      actorEmail: string;
      details: {
        nextStatus?: string;
      };
    }> | undefined;
    assert.ok(Array.isArray(auditRows));
    const matchingAuditRows = (auditRows ?? []).filter(
      (row) => row.actorEmail === adminEmail.toLowerCase()
        && selectedVolunteerIds.includes(Number(row.targetId))
    );
    assert.equal(matchingAuditRows.length, 2);
    assert.equal(matchingAuditRows.every((row) => row.action === "volunteer.workflow_bulk_update"), true);
    assert.equal(matchingAuditRows.every((row) => row.details?.nextStatus === "activ"), true);

    const filteredBulkResponse = await request(app)
      .patch("/api/admin/volunteers/workflow/bulk")
      .set("Authorization", `Bearer ${token}`)
      .send({
        target: {
          type: "filters",
          filters: {
            search: "admin-bulk-volunteer",
            county: "Cluj",
          },
        },
        status: "contactat",
      })
      .expect(200);

    const filteredBulkData = filteredBulkResponse.body?.data as {
      updatedCount: number;
      skippedCount: number;
      missingCount: number;
      updatedVolunteerIds: number[];
    } | undefined;
    assert.ok(filteredBulkData);
    assert.equal(filteredBulkData?.updatedCount, 2);
    assert.equal(filteredBulkData?.skippedCount, 0);
    assert.equal(filteredBulkData?.missingCount, 0);
    assert.deepEqual(new Set(filteredBulkData?.updatedVolunteerIds ?? []), new Set(selectedVolunteerIds));

    await flushAdminAuditOutboxWorker("test:bulk-update:filters");

    const filteredAuditResponse = await request(app)
      .get("/api/admin/audit?limit=50&action=volunteer.workflow_bulk_update&targetType=volunteer")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    const filteredAuditRows = filteredAuditResponse.body?.data as Array<{
      targetId: string;
      actorEmail: string;
      details: {
        nextStatus?: string;
      };
    }> | undefined;
    assert.ok(Array.isArray(filteredAuditRows));

    const filteredMatchingAuditRows = (filteredAuditRows ?? []).filter(
      (row) => row.actorEmail === adminEmail.toLowerCase()
        && selectedVolunteerIds.includes(Number(row.targetId))
        && row.details?.nextStatus === "contactat"
    );
    assert.equal(filteredMatchingAuditRows.length, 2);
  } finally {
    await deleteVolunteerByEmail(volunteerEmailOne);
    await deleteVolunteerByEmail(volunteerEmailTwo);
    await deleteUserByEmail(volunteerEmailOne);
    await deleteUserByEmail(volunteerEmailTwo);
    await deleteUserByEmail(adminEmail);
  }
});

test("admin should bulk delete volunteer records for multiple selections", async () => {
  const adminEmail = buildTestEmail("admin-bulk-delete");
  const volunteerEmailOne = buildTestEmail("admin-bulk-delete-volunteer-one");
  const volunteerEmailTwo = buildTestEmail("admin-bulk-delete-volunteer-two");
  const password = "ParolaFoarteBuna#2026";

  try {
    await request(app)
      .post("/api/auth/signup")
      .send({
        fullName: "Admin Bulk Delete",
        email: adminEmail,
        password,
      })
      .expect(201);

    await query(
      `
        UPDATE users
        SET role = 'PRESEDINTE'
        WHERE LOWER(email) = LOWER($1)
      `,
      [adminEmail]
    );

    const signinResponse = await request(app)
      .post("/api/auth/signin")
      .send({
        email: adminEmail,
        password,
      })
      .expect(200);

    const token = signinResponse.body?.data?.token as string | undefined;
    assert.ok(token);

    for (const email of [volunteerEmailOne, volunteerEmailTwo]) {
      await request(app)
        .post("/api/volunteers")
        .send({
          fullName: `Voluntar ${email}`,
          email,
          password: "ParolaFoarteBuna#2026",
          phone: "0712345678",
          county: "Cluj",
          locality: "Cluj-Napoca",
          skills: "organizare",
          motivation: "Imi doresc sa contribui la proiecte locale pe termen lung.",
          website: "",
        })
        .expect(201);
    }

    const volunteersResponse = await request(app)
      .get(`/api/admin/volunteers?search=${encodeURIComponent("admin-bulk-delete-volunteer")}`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    const volunteers = volunteersResponse.body?.data as Array<{
      volunteerId: number | null;
      email: string;
    }> | undefined;
    assert.ok(Array.isArray(volunteers));

    const selectedVolunteerIds = (volunteers ?? [])
      .filter((item) => item.email === volunteerEmailOne.toLowerCase() || item.email === volunteerEmailTwo.toLowerCase())
      .map((item) => item.volunteerId)
      .filter((value): value is number => typeof value === "number");

    assert.equal(selectedVolunteerIds.length, 2);

    const bulkDeleteResponse = await request(app)
      .delete("/api/admin/volunteers/bulk")
      .set("Authorization", `Bearer ${token}`)
      .send({
        target: {
          type: "ids",
          volunteerIds: selectedVolunteerIds,
        },
      })
      .expect(200);

    const bulkDeleteData = bulkDeleteResponse.body?.data as {
      deletedCount: number;
      missingCount: number;
      deletedVolunteerIds: number[];
      missingVolunteerIds: number[];
    } | undefined;
    assert.ok(bulkDeleteData);
    assert.equal(bulkDeleteData?.deletedCount, 2);
    assert.equal(bulkDeleteData?.missingCount, 0);
    assert.deepEqual(new Set(bulkDeleteData?.deletedVolunteerIds ?? []), new Set(selectedVolunteerIds));
    assert.deepEqual(bulkDeleteData?.missingVolunteerIds ?? [], []);

    await flushAdminAuditOutboxWorker("test:bulk-delete:first");

    const remainingRowsResponse = await request(app)
      .get(`/api/admin/volunteers?search=${encodeURIComponent("admin-bulk-delete-volunteer")}`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    const remainingRows = remainingRowsResponse.body?.data as Array<{
      email: string;
      volunteerId: number | null;
      recordSource: string;
      workflowStatus: string;
    }> | undefined;
    assert.ok(Array.isArray(remainingRows));

    const remainingMatches = (remainingRows ?? []).filter(
      (item) => item.email === volunteerEmailOne.toLowerCase() || item.email === volunteerEmailTwo.toLowerCase()
    );
    assert.equal(remainingMatches.length, 2);
    assert.equal(remainingMatches.every((item) => item.volunteerId === null), true);
    assert.equal(remainingMatches.every((item) => item.recordSource === "user"), true);
    assert.equal(remainingMatches.every((item) => item.workflowStatus === "validat"), true);

    const auditResponse = await request(app)
      .get("/api/admin/audit?limit=50&action=volunteer.delete&targetType=volunteer")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    const auditRows = auditResponse.body?.data as Array<{
      action: string;
      actorEmail: string;
      details: {
        email?: string;
      };
    }> | undefined;
    assert.ok(Array.isArray(auditRows));

    const matchingAuditRows = (auditRows ?? []).filter(
      (row) => row.actorEmail === adminEmail.toLowerCase()
        && (row.details?.email === volunteerEmailOne.toLowerCase() || row.details?.email === volunteerEmailTwo.toLowerCase())
    );

    assert.equal(matchingAuditRows.length, 2);
    assert.equal(matchingAuditRows.every((row) => row.action === "volunteer.delete"), true);

    for (const email of [volunteerEmailOne, volunteerEmailTwo]) {
      await request(app)
        .post("/api/volunteers")
        .send({
          fullName: `Voluntar ${email}`,
          email,
          password: "ParolaFoarteBuna#2026",
          phone: "0712345678",
          county: "Cluj",
          locality: "Cluj-Napoca",
          skills: "organizare",
          motivation: "Imi doresc sa contribui la proiecte locale pe termen lung.",
          website: "",
        })
        .expect(201);
    }

    const filteredBulkDeleteResponse = await request(app)
      .delete("/api/admin/volunteers/bulk")
      .set("Authorization", `Bearer ${token}`)
      .send({
        target: {
          type: "filters",
          filters: {
            search: "admin-bulk-delete-volunteer",
            county: "Cluj",
          },
        },
      })
      .expect(200);

    const filteredBulkDeleteData = filteredBulkDeleteResponse.body?.data as {
      deletedCount: number;
      missingCount: number;
      deletedVolunteerIds: number[];
    } | undefined;
    assert.ok(filteredBulkDeleteData);
    assert.equal(filteredBulkDeleteData?.deletedCount, 2);
    assert.equal(filteredBulkDeleteData?.missingCount, 0);
  } finally {
    await deleteVolunteerByEmail(volunteerEmailOne);
    await deleteVolunteerByEmail(volunteerEmailTwo);
    await deleteUserByEmail(volunteerEmailOne);
    await deleteUserByEmail(volunteerEmailTwo);
    await deleteUserByEmail(adminEmail);
  }
});
