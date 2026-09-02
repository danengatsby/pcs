import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import request from "supertest";
import { createApp } from "../../app.js";
import { query } from "../../lib/db.js";
import { deleteUserByEmail, deleteVolunteerByEmail } from "../helpers/dbTestUtils.js";

const app = createApp();
const password = "ParolaFoarteBuna#2026";

function authorization(token: string): { Authorization: string } {
  return { Authorization: `Bearer ${token}` };
}

async function createAccount(input: { fullName: string; email: string; role: string }) {
  await request(app).post("/api/auth/signup").send({
    fullName: input.fullName,
    email: input.email,
    password,
  }).expect(201);
  await query("UPDATE users SET role = $2 WHERE LOWER(email) = LOWER($1)", [input.email, input.role]);
  const signin = await request(app).post("/api/auth/signin").send({ email: input.email, password }).expect(200);
  return {
    id: signin.body?.data?.user?.id as string,
    token: signin.body?.data?.token as string,
  };
}

test("political mobilization connects operations, member reporting and consent-controlled communication", async () => {
  const suffix = randomUUID().replaceAll("-", "").slice(0, 12);
  const presidentEmail = `mobilization.${suffix}.president@example.test`;
  const memberEmail = `mobilization.${suffix}.member@example.test`;
  const organizationId = `mobilization-${suffix}-cluj`;
  const actionIds: string[] = [];

  try {
    const president = await createAccount({ fullName: "Președinte Mobilizare", email: presidentEmail, role: "PRESEDINTE" });

    await request(app).post("/api/volunteers").send({
      fullName: "Membru Mobilizare",
      email: memberEmail,
      password,
      phone: "0712345678",
      county: "Cluj",
      locality: "Cluj-Napoca",
      skills: "organizare, comunicare",
      motivation: "Doresc să contribui la acțiunile și campaniile organizației locale.",
      website: "",
    }).expect(201);
    await query("UPDATE users SET role = 'MEMBRU' WHERE LOWER(email) = LOWER($1)", [memberEmail]);
    const memberSignin = await request(app).post("/api/auth/signin").send({ email: memberEmail, password }).expect(200);
    const memberId = memberSignin.body?.data?.user?.id as string;
    const memberToken = memberSignin.body?.data?.token as string;

    const countyResult = await query<{ id: number }>("SELECT id FROM counties WHERE name = 'Cluj'");
    const countyId = countyResult.rows[0]?.id;
    assert.ok(countyId);
    await query(`
      INSERT INTO organizations (
        id, code, level, name, county, members_count, status, official_email, phone, headquarters, founded_at
      ) VALUES ($1, $2, 'county', 'Filiala Cluj Mobilizare', 'Cluj', 1, 'active', 'cluj@example.test', '0264000000', 'Cluj-Napoca', CURRENT_DATE)
    `, [organizationId, `MOB-${suffix}`]);
    await query("INSERT INTO organization_territories (organization_id, territory_type, county_id, locality) VALUES ($1, 'county', $2, '')", [organizationId, countyId]);
    await query(`
      UPDATE membership_records
      SET status = 'active', organization_id = $2, member_number = $3,
        validated_at = NOW(), approved_at = NOW(), joined_at = NOW(), user_id = $4
      WHERE LOWER(email) = LOWER($1)
    `, [memberEmail, organizationId, `PCS-TEST-${suffix}`, memberId]);

    const consent = await request(app)
      .patch("/api/member-portal/consents")
      .set(authorization(memberToken))
      .send({
        emailConsent: true,
        smsConsent: false,
        whatsappConsent: false,
        phone: "0712345678",
        interests: ["organizare"],
        consentVersion: "portal-membru-v1",
      })
      .expect(200);
    assert.equal(consent.body?.data?.emailConsent, true);

    const createAction = async (type: "event" | "campaign" | "volunteer_task", title: string) => {
      const response = await request(app)
        .post("/api/admin/mobilization/actions")
        .set(authorization(president.token))
        .send({
          type,
          title,
          summary: `Rezumat operațional pentru ${title}`,
          description: "Detalii complete pentru echipa autorizată.",
          objective: "Mobilizarea măsurabilă a membrilor filialei.",
          status: "open",
          visibility: "members",
          organizationId,
          coordinatorUserId: president.id,
          countyIds: [countyId],
          startsAt: type === "event" ? "2026-10-10T10:00:00.000Z" : null,
          endsAt: null,
          participationMode: "La sediul filialei",
          commitment: "Confirmare și detalii disponibile în portal.",
          capacity: type === "event" ? 50 : null,
          targetMetric: "participanți",
          targetValue: 20,
        })
        .expect(201);
      const id = response.body?.data?.id as string;
      assert.match(id, /^[1-9]\d*$/);
      actionIds.push(id);
      return id;
    };

    const eventId = await createAction("event", `Ședință ${suffix}`);
    await createAction("campaign", `Campanie ${suffix}`);
    const taskId = await createAction("volunteer_task", `Sarcină ${suffix}`);

    const publicActions = await request(app).get("/api/mobilization/actions").expect(200);
    assert.equal(publicActions.body?.data?.some((action: { id: string }) => action.id === eventId), false);

    const addEventParticipant = await request(app)
      .post(`/api/admin/mobilization/actions/${eventId}/participants`)
      .set(authorization(president.token))
      .send({ email: memberEmail, dueAt: null, notes: "Invitație la ședință." })
      .expect(201);
    const eventParticipantId = addEventParticipant.body?.data?.participant?.id as string;
    assert.equal(addEventParticipant.body?.data?.notification, "queued");

    const taskAssignment = await request(app)
      .post(`/api/admin/mobilization/actions/${taskId}/participants`)
      .set(authorization(president.token))
      .send({ email: memberEmail, dueAt: "2026-10-15T18:00:00.000Z", notes: "Contactează membrii filialei." })
      .expect(201);
    const taskParticipantId = taskAssignment.body?.data?.participant?.id as string;

    const portal = await request(app).get("/api/member-portal").set(authorization(memberToken)).expect(200);
    assert.equal(portal.body?.data?.membership?.memberNumber, `PCS-TEST-${suffix}`);
    assert.equal(portal.body?.data?.organization?.id, organizationId);
    assert.equal(portal.body?.data?.events?.[0]?.actionId, eventId);
    assert.equal(portal.body?.data?.tasks?.[0]?.participantId, taskParticipantId);
    assert.equal(portal.body?.data?.regulatedModules?.every((gate: { enabled: boolean }) => !gate.enabled), true);

    await request(app)
      .post(`/api/member-portal/events/${eventId}/response`)
      .set(authorization(memberToken))
      .send({ response: "confirmed" })
      .expect(200);
    await request(app)
      .patch(`/api/admin/mobilization/participants/${eventParticipantId}`)
      .set(authorization(president.token))
      .send({ attendanceStatus: "present", status: "completed" })
      .expect(200);
    await request(app)
      .patch(`/api/member-portal/tasks/${taskParticipantId}`)
      .set(authorization(memberToken))
      .send({ status: "reported", report: "Am contactat membrii alocați.", result: "12 confirmări", hours: 2.5 })
      .expect(200);

    const operations = await request(app).get("/api/admin/mobilization").set(authorization(president.token)).expect(200);
    assert.ok(operations.body?.data?.summary?.events >= 1);
    assert.ok(operations.body?.data?.summary?.campaigns >= 1);
    assert.ok(operations.body?.data?.summary?.tasks >= 1);
    const testedTask = operations.body?.data?.actions?.find((action: { id: string }) => action.id === taskId);
    assert.equal(testedTask?.metrics?.reportedHours, 2.5);

    const audience = {
      channel: "email",
      organizationId,
      countyIds: [countyId],
      roles: ["MEMBRU"],
      interests: ["organizare"],
    };
    const preview = await request(app)
      .post("/api/admin/communications/preview")
      .set(authorization(president.token))
      .send(audience)
      .expect(200);
    assert.equal(preview.body?.data?.eligible, 1);
    assert.equal("recipients" in preview.body.data, false);

    const dispatch = await request(app)
      .post("/api/admin/communications/dispatches")
      .set(authorization(president.token))
      .send({ ...audience, title: "Informare organizațională", message: "Mesaj segmentat pentru membrii cu acord activ.", mode: "send", confirmConsentSelection: true })
      .expect(201);
    assert.equal(dispatch.body?.data?.status, "queued");
    assert.equal(dispatch.body?.data?.recipientCount, 1);

    const finance = await request(app).get("/api/finance").expect(200);
    const elections = await request(app).get("/api/elections").expect(200);
    assert.equal(finance.body?.meta?.governance?.enabled, false);
    assert.equal(elections.body?.meta?.governance?.enabled, false);

    await assert.rejects(
      query("UPDATE regulated_module_gates SET enabled = TRUE WHERE module_key = 'electoral'"),
      (error: unknown) => Boolean(error && typeof error === "object" && "code" in error && error.code === "23514"),
    );
  } finally {
    if (actionIds.length > 0) {await query("DELETE FROM mobilization_actions WHERE id = ANY($1::bigint[])", [actionIds]);}
    await query("DELETE FROM communication_dispatches WHERE created_by IN (SELECT id FROM users WHERE LOWER(email) = LOWER($1))", [presidentEmail]);
    await query("DELETE FROM communication_consents WHERE LOWER(email) = LOWER($1)", [memberEmail]);
    await deleteVolunteerByEmail(memberEmail);
    await deleteUserByEmail(memberEmail);
    await query("DELETE FROM organizations WHERE id = $1", [organizationId]);
    await deleteUserByEmail(presidentEmail);
  }
});
