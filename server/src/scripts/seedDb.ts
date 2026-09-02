import { randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import type { PoolClient, QueryResultRow } from "pg";
import { closePool, pool, withTransaction } from "../lib/db.js";
import { hashPassword } from "../lib/password.js";
import { assertSafeTestDatabase } from "../lib/testDatabaseSafety.js";
import { countyNames, type CountyName } from "../modules/volunteers/counties.js";
import type { UserRole } from "../lib/authToken.js";
import type {
  VolunteerContactChannel,
  VolunteerPriority,
  VolunteerWorkflowStatus,
} from "../modules/volunteers/types.js";

type CountyRow = { id: number; name: CountyName };
type MembershipStatus =
  | "supporter"
  | "application"
  | "verified"
  | "approved"
  | "active"
  | "suspended"
  | "terminated";
type SqlValue = string | number | boolean | Date | null;

type SeedPerson = {
  key: string;
  fullName: string;
  email: string;
  phone: string;
  county: CountyName;
  countyId: number;
  locality: string;
  skills: string;
  skillTags: string[];
  motivation: string;
  workflowStatus: VolunteerWorkflowStatus;
  contactChannel: VolunteerContactChannel | null;
  priority: VolunteerPriority;
  role: UserRole;
  membershipStatus: MembershipStatus;
  organizationId: string | null;
  positionTitle: string | null;
  createdAt: Date;
};

type SeedOrganization = {
  id: string;
  code: string;
  level: "national" | "county" | "local";
  name: string;
  county: string;
  membersCount: number;
  status: "forming" | "active";
  parentId: string | null;
  officialEmail: string;
  phone: string;
  headquarters: string;
  foundedAt: Date;
  territoryType: "national" | "county" | "locality";
  countyId: number | null;
  locality: string;
};

type SeedEvent = {
  action: "import" | "submit" | "verify" | "approve" | "activate" | "suspend" | "terminate";
  previousStatus: MembershipStatus | null;
  nextStatus: MembershipStatus;
  effectiveAt: Date;
};

const SEED_EMAIL_DOMAIN = "seed.pcs.local";
const NATIONAL_ORGANIZATION_ID = "seed-org-national";
const DAY_MS = 24 * 60 * 60 * 1000;
const BATCH_SIZE = 150;
const PEOPLE_PER_STATUS_PER_COUNTY = 4;

const firstNames = [
  "Adriana", "Alexandru", "Alina", "Andrei", "Anca", "Bogdan", "Camelia", "Cătălin",
  "Carmen", "Cristian", "Daniel", "Daniela", "Diana", "Elena", "Florin", "Gabriela",
  "George", "Ioana", "Ion", "Irina", "Laura", "Liviu", "Lucian", "Maria",
  "Mariana", "Marius", "Mihaela", "Mihai", "Monica", "Nicoleta", "Oana", "Paul",
  "Raluca", "Radu", "Roxana", "Simona", "Sorin", "Teodora", "Valentin", "Victor",
] as const;

const lastNames = [
  "Avram", "Badea", "Barbu", "Bălan", "Chiriac", "Ciobanu", "Constantin", "Crăciun",
  "Dima", "Dobre", "Dumitrescu", "Enache", "Florea", "Georgescu", "Gheorghe", "Ilie",
  "Ionescu", "Lazar", "Manea", "Marin", "Matei", "Mihăilescu", "Mocanu", "Moldovan",
  "Munteanu", "Neagu", "Nedelcu", "Nistor", "Oprea", "Petrescu", "Pop", "Popa",
  "Popescu", "Radu", "Sandu", "Stan", "Stoica", "Toma", "Tudor", "Vasile",
] as const;

const countyCapitalByName: Record<CountyName, string> = {
  Alba: "Alba Iulia",
  Arad: "Arad",
  "Argeș": "Pitești",
  "Bacău": "Bacău",
  Bihor: "Oradea",
  "Bistrița-Năsăud": "Bistrița",
  "Botoșani": "Botoșani",
  "Brașov": "Brașov",
  "Brăila": "Brăila",
  "Buzău": "Buzău",
  "Caraș-Severin": "Reșița",
  "Călărași": "Călărași",
  Cluj: "Cluj-Napoca",
  "Constanța": "Constanța",
  Covasna: "Sfântu Gheorghe",
  "Dâmbovița": "Târgoviște",
  Dolj: "Craiova",
  "Galați": "Galați",
  Giurgiu: "Giurgiu",
  Gorj: "Târgu Jiu",
  Harghita: "Miercurea Ciuc",
  Hunedoara: "Deva",
  "Ialomița": "Slobozia",
  "Iași": "Iași",
  Ilfov: "Buftea",
  "Maramureș": "Baia Mare",
  "Mehedinți": "Drobeta-Turnu Severin",
  "Mureș": "Târgu Mureș",
  "Neamț": "Piatra Neamț",
  Olt: "Slatina",
  Prahova: "Ploiești",
  "Satu Mare": "Satu Mare",
  "Sălaj": "Zalău",
  Sibiu: "Sibiu",
  Suceava: "Suceava",
  Teleorman: "Alexandria",
  "Timiș": "Timișoara",
  Tulcea: "Tulcea",
  Vaslui: "Vaslui",
  "Vâlcea": "Râmnicu Vâlcea",
  Vrancea: "Focșani",
  "București": "București",
};

const localOrganizationCounties = new Set<CountyName>([
  "București", "Brașov", "Cluj", "Constanța", "Dolj", "Iași", "Prahova", "Timiș",
]);

const lifecycleSeeds: Array<{
  status: MembershipStatus;
  label: string;
  role: UserRole;
  workflowStatus: VolunteerWorkflowStatus;
  minimumAgeDays: number;
}> = [
  { status: "supporter", label: "Susținător", role: "SUSTINATOR", workflowStatus: "nou", minimumAgeDays: 2 },
  { status: "application", label: "Cerere nouă", role: "SUSTINATOR", workflowStatus: "nou", minimumAgeDays: 2 },
  { status: "verified", label: "Dosar verificat", role: "SUSTINATOR", workflowStatus: "validat", minimumAgeDays: 8 },
  { status: "approved", label: "Aderent aprobat", role: "ADERENT", workflowStatus: "contactat", minimumAgeDays: 15 },
  { status: "active", label: "Membru activ", role: "MEMBRU", workflowStatus: "activ", minimumAgeDays: 30 },
  { status: "suspended", label: "Membru suspendat", role: "SUSTINATOR", workflowStatus: "activ", minimumAgeDays: 60 },
  { status: "terminated", label: "Fost membru", role: "SUSTINATOR", workflowStatus: "activ", minimumAgeDays: 90 },
];

const skillSeedValues = [
  ["organizare", "relații comunitare"],
  ["comunicare", "social media"],
  ["logistică", "evenimente"],
  ["analiză", "politici publice"],
  ["juridic", "administrație"],
  ["teren", "dialog civic"],
] as const;

function buildSlug(value: string): string {
  return value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").replace(/-{2,}/g, "-");
}

function daysBefore(days: number): Date {
  return new Date(Date.now() - days * DAY_MS);
}

function daysAfter(value: Date, days: number): Date {
  return new Date(value.getTime() + days * DAY_MS);
}

function dateOnlyAfter(days: number): Date {
  const value = new Date(Date.now() + days * DAY_MS);
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}

function monthStart(monthOffset: number): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + monthOffset, 1));
}

function monthEnd(monthOffset: number): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + monthOffset + 1, 0));
}

function createBatchInsertSql(columnCount: number, rowCount: number): string {
  let parameterIndex = 1;
  return Array.from({ length: rowCount }, () => {
    const parameters = Array.from({ length: columnCount }, () => `$${parameterIndex++}`);
    return `(${parameters.join(", ")})`;
  }).join(",\n");
}

async function insertRowsInBatches<T extends QueryResultRow>(input: {
  client: PoolClient;
  statement: string;
  columnCount: number;
  rows: SqlValue[][];
  suffix?: string;
}): Promise<T[]> {
  const resultRows: T[] = [];
  for (let index = 0; index < input.rows.length; index += BATCH_SIZE) {
    const batch = input.rows.slice(index, index + BATCH_SIZE);
    const result = await input.client.query<T>(
      `${input.statement}\nVALUES\n${createBatchInsertSql(input.columnCount, batch.length)}\n${input.suffix ?? ""}`,
      batch.flat(),
    );
    resultRows.push(...result.rows);
  }
  return resultRows;
}

async function readCountyMap(): Promise<Map<CountyName, number>> {
  const result = await pool.query<CountyRow>("SELECT id, name FROM counties ORDER BY name ASC");
  const map = new Map<CountyName, number>(result.rows.map((row) => [row.name, row.id]));
  for (const county of countyNames) {
    if (!map.has(county)) {throw new Error(`Județul ${county} lipsește din tabela counties. Rulează mai întâi migrările.`);}
  }
  return map;
}

function countyOrganizationId(county: CountyName): string {
  return `seed-org-county-${buildSlug(county)}`;
}

function localOrganizationId(county: CountyName): string {
  return `seed-org-local-${buildSlug(countyCapitalByName[county])}`;
}

function personPhone(index: number): string {
  return `07${String(index + 1).padStart(8, "0")}`;
}

function personName(index: number): string {
  const firstName = firstNames[index % firstNames.length] ?? "Alexandru";
  const lastName = lastNames[Math.floor(index / firstNames.length) % lastNames.length] ?? "Popescu";
  return `${firstName} ${lastName}`;
}

function buildSeedPeople(countyIdByName: Map<CountyName, number>): SeedPerson[] {
  const people: SeedPerson[] = [];
  let personIndex = 0;
  for (const [countyIndex, county] of countyNames.entries()) {
    const countyId = countyIdByName.get(county);
    if (!countyId) {throw new Error(`Nu am putut rezolva ID-ul județului ${county}.`);}
    const countySlug = buildSlug(county);
    const organizationId = countyOrganizationId(county);
    const locality = countyCapitalByName[county];

    for (const [statusIndex, lifecycle] of lifecycleSeeds.entries()) {
      for (let replicaIndex = 0; replicaIndex < PEOPLE_PER_STATUS_PER_COUNTY; replicaIndex += 1) {
        const skills = skillSeedValues[(countyIndex + statusIndex + replicaIndex) % skillSeedValues.length] ?? skillSeedValues[0];
        const ageDays = lifecycle.minimumAgeDays + ((countyIndex * 17 + statusIndex * 7 + replicaIndex * 13) % 150);
        people.push({
          key: `${countySlug}-${lifecycle.status}-${replicaIndex + 1}`,
          fullName: personName(personIndex),
          email: `seed.${countySlug}.${lifecycle.status}.${replicaIndex + 1}@${SEED_EMAIL_DOMAIN}`,
          phone: personPhone(personIndex++),
          county,
          countyId,
          locality,
          skills: skills.join(", "),
          skillTags: [...skills],
          motivation: `Doresc să contribui la inițiativele comunitare și la activitatea organizației PCS din ${county}.`,
          workflowStatus: lifecycle.workflowStatus,
          contactChannel: lifecycle.workflowStatus === "nou" ? null : (statusIndex + replicaIndex) % 2 === 0 ? "telefon" : "email",
          priority: (["scazuta", "medie", "ridicata", "critica"] as const)[(countyIndex + statusIndex + replicaIndex) % 4],
          role: lifecycle.role,
          membershipStatus: lifecycle.status,
          organizationId: ["approved", "active", "suspended", "terminated"].includes(lifecycle.status) ? organizationId : null,
          positionTitle: null,
          createdAt: daysBefore(ageDays),
        });
      }
    }

    const leadershipSeeds: Array<{ suffix: string; label: string; role: UserRole; positionTitle: string }> = [
      { suffix: "presedinte", label: "Președinte filială", role: "PRESEDINTE", positionTitle: "Președinte organizație județeană" },
      { suffix: "secretar", label: "Secretar filială", role: "SECRETAR", positionTitle: "Secretar organizație județeană" },
    ];
    for (const [leaderIndex, leader] of leadershipSeeds.entries()) {
      const skills = leaderIndex === 0 ? ["coordonare", "relații comunitare"] : ["organizare", "administrație"];
      people.push({
        key: `${countySlug}-${leader.suffix}`,
        fullName: personName(personIndex),
        email: `seed.${countySlug}.${leader.suffix}@${SEED_EMAIL_DOMAIN}`,
        phone: personPhone(personIndex++),
        county,
        countyId,
        locality,
        skills: skills.join(", "),
        skillTags: skills,
        motivation: `Coordonez activitatea și echipa organizației județene PCS ${county}.`,
        workflowStatus: "activ",
        contactChannel: "telefon",
        priority: "ridicata",
        role: leader.role,
        membershipStatus: "active",
        organizationId,
        positionTitle: leader.positionTitle,
        createdAt: daysBefore(120 + ((countyIndex * 11 + leaderIndex * 19) % 160)),
      });
    }
  }

  const bucharestId = countyIdByName.get("București");
  if (!bucharestId) {throw new Error("Județul București lipsește din tabela counties.");}
  const nationalLeaders: Array<{ suffix: string; label: string; role: UserRole; positionTitle: string }> = [
    { suffix: "presedinte", label: "Președinte național", role: "PRESEDINTE", positionTitle: "Președinte" },
    { suffix: "vicepresedinte", label: "Vicepreședinte național", role: "VICEPRESEDINTE", positionTitle: "Vicepreședinte" },
    { suffix: "secretar-general", label: "Secretar general", role: "SECRETAR", positionTitle: "Secretar general" },
    { suffix: "consilier", label: "Consilier politic", role: "CONSILIER", positionTitle: "Consilier politic" },
  ];
  for (const [leaderIndex, leader] of nationalLeaders.entries()) {
    people.push({
      key: `national-${leader.suffix}`,
      fullName: personName(personIndex),
      email: `seed.national.${leader.suffix}@${SEED_EMAIL_DOMAIN}`,
      phone: personPhone(personIndex++),
      county: "București",
      countyId: bucharestId,
      locality: "București",
      skills: "coordonare națională, strategie",
      skillTags: ["coordonare", "strategie"],
      motivation: "Contribui la coordonarea, strategia și dezvoltarea structurii naționale PCS.",
      workflowStatus: "activ",
      contactChannel: "email",
      priority: "critica",
      role: leader.role,
      membershipStatus: "active",
      organizationId: NATIONAL_ORGANIZATION_ID,
      positionTitle: leader.positionTitle,
      createdAt: daysBefore(240 + leaderIndex * 10),
    });
  }
  return people;
}

function buildSeedOrganizations(countyIdByName: Map<CountyName, number>): SeedOrganization[] {
  const organizations: SeedOrganization[] = [{
    id: NATIONAL_ORGANIZATION_ID,
    code: "DEMO-NATIONAL",
    level: "national",
    name: "PCS — Organizația Națională (Demo)",
    county: "",
    membersCount: countyNames.length * (PEOPLE_PER_STATUS_PER_COUNTY + 2) + 4,
    status: "active",
    parentId: null,
    officialEmail: `national@${SEED_EMAIL_DOMAIN}`,
    phone: "0700000000",
    headquarters: "Sediu demonstrativ — București",
    foundedAt: new Date(Date.UTC(2024, 0, 15)),
    territoryType: "national",
    countyId: null,
    locality: "",
  }];
  for (const [index, county] of countyNames.entries()) {
    const countyId = countyIdByName.get(county);
    if (!countyId) {throw new Error(`Nu am putut rezolva ID-ul județului ${county}.`);}
    const slug = buildSlug(county);
    const capital = countyCapitalByName[county];
    organizations.push({
      id: countyOrganizationId(county),
      code: `DEMO-J-${slug.toUpperCase()}`,
      level: "county",
      name: `PCS ${county} (Demo)`,
      county,
      membersCount: PEOPLE_PER_STATUS_PER_COUNTY + 2,
      status: "active",
      parentId: NATIONAL_ORGANIZATION_ID,
      officialEmail: `${slug}@${SEED_EMAIL_DOMAIN}`,
      phone: personPhone(500 + index),
      headquarters: `Sediu demonstrativ, ${capital}`,
      foundedAt: new Date(Date.UTC(2025, index % 12, 1 + (index % 20))),
      territoryType: "county",
      countyId,
      locality: "",
    });
    if (localOrganizationCounties.has(county)) {
      organizations.push({
        id: localOrganizationId(county),
        code: `DEMO-L-${buildSlug(capital).toUpperCase()}`,
        level: "local",
        name: `PCS ${capital} (Demo)`,
        county,
        membersCount: 0,
        status: index % 3 === 0 ? "forming" : "active",
        parentId: countyOrganizationId(county),
        officialEmail: `${buildSlug(capital)}@${SEED_EMAIL_DOMAIN}`,
        phone: personPhone(600 + index),
        headquarters: `Punct de lucru demonstrativ, ${capital}`,
        foundedAt: new Date(Date.UTC(2026, index % 8, 1 + (index % 20))),
        territoryType: "locality",
        countyId,
        locality: capital,
      });
    }
  }
  return organizations;
}

function buildLifecycleEvents(person: SeedPerson): SeedEvent[] {
  if (person.membershipStatus === "supporter") {
    return [{ action: "import", previousStatus: null, nextStatus: "supporter", effectiveAt: person.createdAt }];
  }
  const events: SeedEvent[] = [{
    action: "submit", previousStatus: "supporter", nextStatus: "application", effectiveAt: person.createdAt,
  }];
  const stages: Array<{ status: MembershipStatus; action: SeedEvent["action"]; previousStatus: MembershipStatus; dayOffset: number }> = [
    { status: "verified", action: "verify", previousStatus: "application", dayOffset: 2 },
    { status: "approved", action: "approve", previousStatus: "verified", dayOffset: 4 },
    { status: "active", action: "activate", previousStatus: "approved", dayOffset: 6 },
  ];
  const statusOrder = lifecycleSeeds.map((item) => item.status);
  const finalStatusIndex = statusOrder.indexOf(person.membershipStatus);
  for (const stage of stages) {
    if (finalStatusIndex >= statusOrder.indexOf(stage.status)) {
      events.push({ ...stage, nextStatus: stage.status, effectiveAt: daysAfter(person.createdAt, stage.dayOffset) });
    }
  }
  if (person.membershipStatus === "suspended" || person.membershipStatus === "terminated") {
    events.push({
      action: person.membershipStatus === "suspended" ? "suspend" : "terminate",
      previousStatus: "active",
      nextStatus: person.membershipStatus,
      effectiveAt: daysAfter(person.createdAt, 10),
    });
  }
  return events;
}

function membershipVersion(status: MembershipStatus): number {
  return { supporter: 1, application: 1, verified: 2, approved: 3, active: 4, suspended: 5, terminated: 5 }[status];
}

async function cleanupDemoPeople(client: PoolClient): Promise<void> {
  const emailPattern = `%@${SEED_EMAIL_DOMAIN}`;
  await client.query("DELETE FROM communication_dispatches WHERE created_by IN (SELECT id FROM users WHERE email ILIKE $1)", [emailPattern]);
  await client.query(`DELETE FROM communication_dispatch_recipients recipient USING communication_consents consent
    WHERE recipient.consent_id = consent.id AND consent.email ILIKE $1`, [emailPattern]);
  await client.query("DELETE FROM mobilization_participants WHERE email ILIKE $1", [emailPattern]);
  await client.query("DELETE FROM mobilization_responses WHERE email ILIKE $1", [emailPattern]);
  await client.query("DELETE FROM communication_consents WHERE email ILIKE $1", [emailPattern]);
  await client.query("DELETE FROM membership_records WHERE email ILIKE $1", [emailPattern]);
  await client.query("DELETE FROM organization_leadership_mandates WHERE organization_id LIKE 'seed-org-%'");
  await client.query(`DELETE FROM organization_objectives
    WHERE organization_id LIKE 'seed-org-%' AND title LIKE '[Demo] %'`);
  await client.query("DELETE FROM volunteers WHERE email ILIKE $1", [emailPattern]);
  await client.query("DELETE FROM users WHERE email ILIKE $1", [emailPattern]);
}

async function seedUsers(client: PoolClient, people: SeedPerson[], passwordHash: string): Promise<Map<string, string>> {
  const inserted = await insertRowsInBatches<{ id: string; email: string }>({
    client,
    statement: "INSERT INTO users (full_name, email, password_hash, role, created_at)",
    columnCount: 5,
    rows: people.map((person) => [person.fullName, person.email, passwordHash, person.role, person.createdAt]),
    suffix: "RETURNING id, email",
  });
  return new Map(inserted.map((row) => [row.email.toLowerCase(), row.id.toString()]));
}

function findNationalPresidentId(userIdByEmail: Map<string, string>): string | null {
  return userIdByEmail.get(`seed.national.presedinte@${SEED_EMAIL_DOMAIN}`) ?? null;
}

function buildCountyPresidentMap(people: SeedPerson[], userIdByEmail: Map<string, string>): Map<CountyName, string> {
  const result = new Map<CountyName, string>();
  for (const person of people) {
    if (person.positionTitle === "Președinte organizație județeană") {
      const userId = userIdByEmail.get(person.email);
      if (userId) {result.set(person.county, userId);}
    }
  }
  return result;
}

async function seedOrganizations(
  client: PoolClient,
  organizations: SeedOrganization[],
  userIdByEmail: Map<string, string>,
  people: SeedPerson[],
): Promise<void> {
  const nationalPresidentId = findNationalPresidentId(userIdByEmail);
  const leaderIdByCounty = buildCountyPresidentMap(people, userIdByEmail);
  await insertRowsInBatches({
    client,
    statement: `INSERT INTO organizations (
      id, code, level, name, county, members_count, status, parent_id,
      official_email, phone, headquarters, founded_at, created_by, updated_by
    )`,
    columnCount: 14,
    rows: organizations.map((organization) => {
      const actorId = organization.level === "national"
        ? nationalPresidentId
        : leaderIdByCounty.get(organization.county as CountyName) ?? nationalPresidentId;
      return [organization.id, organization.code, organization.level, organization.name, organization.county,
        organization.membersCount, organization.status, organization.parentId, organization.officialEmail,
        organization.phone, organization.headquarters, organization.foundedAt, actorId, actorId];
    }),
    suffix: `ON CONFLICT (id) DO UPDATE SET
      code = EXCLUDED.code, level = EXCLUDED.level, name = EXCLUDED.name,
      county = EXCLUDED.county, members_count = EXCLUDED.members_count, status = EXCLUDED.status,
      parent_id = EXCLUDED.parent_id, official_email = EXCLUDED.official_email, phone = EXCLUDED.phone,
      headquarters = EXCLUDED.headquarters, founded_at = EXCLUDED.founded_at,
      created_by = EXCLUDED.created_by, updated_by = EXCLUDED.updated_by, updated_at = NOW()`,
  });
  await insertRowsInBatches({
    client,
    statement: "INSERT INTO organization_territories (organization_id, territory_type, county_id, locality)",
    columnCount: 4,
    rows: organizations.map((organization) => [organization.id, organization.territoryType, organization.countyId, organization.locality]),
    suffix: "ON CONFLICT DO NOTHING",
  });
}

async function seedVolunteers(
  client: PoolClient,
  people: SeedPerson[],
  userIdByEmail: Map<string, string>,
): Promise<Map<string, string>> {
  const presidentIdByCounty = buildCountyPresidentMap(people, userIdByEmail);
  const nationalPresidentId = findNationalPresidentId(userIdByEmail);
  const inserted = await insertRowsInBatches<{ id: string; email: string }>({
    client,
    statement: `INSERT INTO volunteers (
      full_name, email, phone, county, county_id, locality, skills, motivation,
      workflow_status, internal_notes, status_updated_at, status_updated_by,
      owner_user_id, follow_up_at, reminder_at, last_contact_at, contact_channel,
      crm_priority, rejection_reason, crm_tags, skill_tags, created_at
    )`,
    columnCount: 22,
    rows: people.map((person, index) => {
      const actorId = person.organizationId === NATIONAL_ORGANIZATION_ID
        ? nationalPresidentId : presidentIdByCounty.get(person.county) ?? nationalPresidentId;
      const contacted = person.workflowStatus !== "nou";
      const overdue = !contacted && index % 3 === 0;
      return [person.fullName, person.email, person.phone, person.county, person.countyId, person.locality,
        person.skills, person.motivation, person.workflowStatus, `Date demonstrative. Cheie seed: ${person.key}.`,
        contacted ? daysAfter(person.createdAt, 2) : null, contacted ? actorId : null, actorId,
        person.workflowStatus === "activ" ? null : daysAfter(new Date(), overdue ? -4 : 7 + (index % 12)),
        person.workflowStatus === "activ" ? null : daysAfter(new Date(), overdue ? -2 : 10 + (index % 8)),
        contacted ? daysAfter(person.createdAt, 3) : null, person.contactChannel, person.priority,
        person.membershipStatus === "terminated" ? "Încheiere demonstrativă a calității de membru." : "",
        JSON.stringify(["seed-demo", buildSlug(person.county), person.membershipStatus]),
        JSON.stringify(person.skillTags), person.createdAt];
    }),
    suffix: "RETURNING id, email",
  });
  return new Map(inserted.map((row) => [row.email.toLowerCase(), row.id.toString()]));
}

async function seedMemberships(
  client: PoolClient,
  people: SeedPerson[],
  userIdByEmail: Map<string, string>,
  volunteerIdByEmail: Map<string, string>,
): Promise<Map<string, string>> {
  const nationalPresidentId = findNationalPresidentId(userIdByEmail);
  const presidentIdByCounty = buildCountyPresidentMap(people, userIdByEmail);
  const statusOrder = lifecycleSeeds.map((item) => item.status);
  const numberedPeopleCount = people.filter(
    (person) => ["active", "suspended", "terminated"].includes(person.membershipStatus),
  ).length;
  await client.query(`
    SELECT setval(
      'membership_number_seq',
      GREATEST(
        (SELECT last_value FROM membership_number_seq),
        COALESCE((
          SELECT MAX(SUBSTRING(member_number FROM '([0-9]+)$')::BIGINT)
          FROM membership_records
          WHERE member_number ~ '^PCS-[0-9]{4}-[0-9]+$'
        ), 0),
        1
      ),
      TRUE
    )
  `);
  const sequenceResult = await client.query<{ value: string }>(`
    SELECT nextval('membership_number_seq')::TEXT AS value
    FROM generate_series(1, $1)
  `, [numberedPeopleCount]);
  let memberNumberIndex = 0;
  const inserted = await insertRowsInBatches<{ id: string; email: string }>({
    client,
    statement: `INSERT INTO membership_records (
      user_id, volunteer_id, full_name, email, status, organization_id, member_number,
      application_at, validated_at, approved_at, approval_organization_id, approval_body,
      joined_at, suspended_at, ended_at, status_reason, version, created_by, updated_by,
      created_at, updated_at
    )`,
    columnCount: 21,
    rows: people.map((person) => {
      const stage = statusOrder.indexOf(person.membershipStatus);
      const verifiedAt = stage >= statusOrder.indexOf("verified") ? daysAfter(person.createdAt, 2) : null;
      const approvedAt = stage >= statusOrder.indexOf("approved") ? daysAfter(person.createdAt, 4) : null;
      const joinedAt = stage >= statusOrder.indexOf("active") ? daysAfter(person.createdAt, 6) : null;
      const decisionAt = ["suspended", "terminated"].includes(person.membershipStatus)
        ? daysAfter(person.createdAt, 10) : joinedAt ?? approvedAt ?? verifiedAt ?? person.createdAt;
      const sequenceValue = joinedAt ? sequenceResult.rows[memberNumberIndex++]?.value : null;
      const memberNumber = joinedAt && sequenceValue
        ? `PCS-${joinedAt.getUTCFullYear()}-${sequenceValue.padStart(6, "0")}` : null;
      const actorId = person.organizationId === NATIONAL_ORGANIZATION_ID
        ? nationalPresidentId : presidentIdByCounty.get(person.county) ?? nationalPresidentId;
      return [userIdByEmail.get(person.email) ?? null, volunteerIdByEmail.get(person.email) ?? null,
        person.fullName, person.email, person.membershipStatus, person.organizationId, memberNumber,
        person.createdAt, verifiedAt, approvedAt, approvedAt ? person.organizationId : null,
        approvedAt ? "Conducerea organizației teritoriale — set demonstrativ" : "", joinedAt,
        person.membershipStatus === "suspended" ? decisionAt : null,
        person.membershipStatus === "terminated" ? decisionAt : null,
        person.membershipStatus === "suspended" ? "Suspendare temporară demonstrativă"
          : person.membershipStatus === "terminated" ? "Retragere demonstrativă" : "",
        membershipVersion(person.membershipStatus), actorId, actorId, person.createdAt, decisionAt];
    }),
    suffix: "RETURNING id, email",
  });
  return new Map(inserted.map((row) => [row.email.toLowerCase(), row.id.toString()]));
}

async function seedMembershipEvents(
  client: PoolClient,
  people: SeedPerson[],
  membershipIdByEmail: Map<string, string>,
  userIdByEmail: Map<string, string>,
): Promise<number> {
  const nationalPresidentId = findNationalPresidentId(userIdByEmail);
  const presidentIdByCounty = buildCountyPresidentMap(people, userIdByEmail);
  const rows: SqlValue[][] = [];
  for (const person of people) {
    const membershipId = membershipIdByEmail.get(person.email);
    if (!membershipId) {continue;}
    const actorId = person.organizationId === NATIONAL_ORGANIZATION_ID
      ? nationalPresidentId : presidentIdByCounty.get(person.county) ?? nationalPresidentId;
    for (const event of buildLifecycleEvents(person)) {
      const organizationAssigned = ["approved", "active", "suspended", "terminated"].includes(event.nextStatus);
      rows.push([membershipId, event.action, event.previousStatus, event.nextStatus,
        organizationAssigned ? person.organizationId : null, organizationAssigned ? person.organizationId : null,
        "Eveniment generat pentru setul demonstrativ.", actorId, event.effectiveAt, event.effectiveAt]);
    }
  }
  await insertRowsInBatches({
    client,
    statement: `INSERT INTO membership_events (
      membership_id, action, previous_status, next_status, previous_organization_id,
      next_organization_id, reason, actor_user_id, effective_at, created_at
    )`,
    columnCount: 10,
    rows,
  });
  return rows.length;
}

async function seedMandatesAndObjectives(
  client: PoolClient,
  people: SeedPerson[],
  organizations: SeedOrganization[],
  userIdByEmail: Map<string, string>,
): Promise<{ mandates: number; objectives: number }> {
  const mandateRows: SqlValue[][] = people.filter((person) => person.positionTitle).map((person) => [
    person.organizationId, userIdByEmail.get(person.email) ?? null, person.fullName,
    person.positionTitle, daysAfter(person.createdAt, 6), null, "active",
  ]);
  for (const organization of organizations) {
    if (organization.level !== "local") {continue;}
    const countyPresident = people.find(
      (person) => person.county === organization.county && person.positionTitle === "Președinte organizație județeană",
    );
    if (countyPresident) {
      mandateRows.push([organization.id, userIdByEmail.get(countyPresident.email) ?? null,
        countyPresident.fullName, "Coordonator local interimar", daysAfter(countyPresident.createdAt, 10), null, "active"]);
    }
  }
  await insertRowsInBatches({
    client,
    statement: `INSERT INTO organization_leadership_mandates (
      organization_id, user_id, full_name, position_title, started_at, ended_at, status
    )`,
    columnCount: 7,
    rows: mandateRows,
  });

  const objectiveRows = organizations.map<SqlValue[]>((organization, index) => {
    const title = organization.level === "national" ? "[Demo] Extinderea rețelei teritoriale"
      : organization.level === "county" ? `[Demo] Creșterea comunității din ${organization.county}`
        : `[Demo] Lansarea echipei locale din ${organization.locality}`;
    const targetValue = organization.level === "national" ? 42 : organization.level === "county" ? 25 : 10;
    const currentValue = organization.level === "national" ? 42 : organization.membersCount;
    return [organization.id, title,
      "Obiectiv demonstrativ folosit pentru verificarea planificării și raportării.",
      organization.level === "national" ? "județe acoperite" : "membri activi",
      targetValue, currentValue, "număr", dateOnlyAfter(90 + (index % 120)),
      currentValue >= targetValue ? "achieved" : index % 5 === 0 ? "at_risk" : "in_progress"];
  });
  await insertRowsInBatches({
    client,
    statement: `INSERT INTO organization_objectives (
      organization_id, title, description, metric_name, target_value,
      current_value, unit, due_date, status
    )`,
    columnCount: 9,
    rows: objectiveRows,
  });
  return { mandates: mandateRows.length, objectives: objectiveRows.length };
}

async function seedCommunicationConsents(
  client: PoolClient,
  people: SeedPerson[],
  userIdByEmail: Map<string, string>,
  membershipIdByEmail: Map<string, string>,
): Promise<number> {
  const interests = ["pensii", "sanatate", "servicii_locale", "combaterea_izolarii", "comunicare", "organizare"];
  const rows = people.map<SqlValue[]>((person, index) => {
    const emailConsent = index % 5 !== 0;
    const smsConsent = index % 3 === 0;
    const whatsappConsent = index % 4 === 0;
    const hasConsent = emailConsent || smsConsent || whatsappConsent;
    return [userIdByEmail.get(person.email) ?? null, membershipIdByEmail.get(person.email) ?? null,
      person.fullName, person.email, person.phone, person.countyId, person.county, person.locality,
      JSON.stringify([interests[index % interests.length], interests[(index + 2) % interests.length]]),
      emailConsent, smsConsent, whatsappConsent, "portal-membru-v1", "seed_demo",
      JSON.stringify({ demo: true, seedKey: person.key }), hasConsent ? daysAfter(person.createdAt, 1) : null,
      hasConsent ? null : daysAfter(person.createdAt, 1), person.createdAt, daysAfter(person.createdAt, 1)];
  });
  await insertRowsInBatches({
    client,
    statement: `INSERT INTO communication_consents (
      user_id, membership_id, full_name, email, phone, county_id, county, locality,
      interests, email_consent, sms_consent, whatsapp_consent, consent_version,
      source, evidence, granted_at, withdrawn_at, created_at, updated_at
    )`,
    columnCount: 19,
    rows,
  });
  return rows.length;
}

async function seedMobilization(
  client: PoolClient,
  people: SeedPerson[],
  userIdByEmail: Map<string, string>,
  membershipIdByEmail: Map<string, string>,
): Promise<{ participants: number; responses: number }> {
  const coordinatorEmailBySlug = new Map<string, string>([
    ["orientare-voluntari-online-septembrie-2026", `seed.national.presedinte@${SEED_EMAIL_DOMAIN}`],
    ["harta-problemelor-seniorilor", `seed.national.vicepresedinte@${SEED_EMAIL_DOMAIN}`],
    ["echipa-apeluri-consultare-seniori", `seed.national.secretar-general@${SEED_EMAIL_DOMAIN}`],
  ]);
  for (const [slug, email] of coordinatorEmailBySlug) {
    await client.query(`UPDATE mobilization_actions SET organization_id = $2,
      coordinator_user_id = $3, created_by = $3,
      objective = CASE WHEN objective = '' THEN 'Obiectiv demonstrativ pentru coordonarea și raportarea activității.' ELSE objective END,
      target_metric = CASE WHEN target_metric = '' THEN 'participanți' ELSE target_metric END,
      target_value = COALESCE(target_value, 50), updated_at = NOW() WHERE slug = $1`,
    [slug, NATIONAL_ORGANIZATION_ID, userIdByEmail.get(email) ?? null]);
  }

  const actionResult = await client.query<{ id: string; slug: string; action_type: string }>(
    "SELECT id, slug, action_type FROM mobilization_actions ORDER BY sort_order, id",
  );
  const operationalActions = actionResult.rows.filter((action) => coordinatorEmailBySlug.has(action.slug));
  if (operationalActions.length === 0) {return { participants: 0, responses: 0 };}
  const eligible = people.filter((person) => ["active", "approved"].includes(person.membershipStatus));
  const participantRows = eligible.map<SqlValue[]>((person, index) => {
    const action = operationalActions[index % operationalActions.length];
    const statuses = action.action_type === "event" ? ["invited", "confirmed", "declined"]
      : action.action_type === "campaign" ? ["active", "reported", "completed"] : ["in_progress", "reported", "completed"];
    const status = statuses[index % statuses.length] ?? statuses[0];
    const finished = status === "reported" || status === "completed";
    return [action.id, userIdByEmail.get(person.email) ?? null, membershipIdByEmail.get(person.email) ?? null,
      person.fullName, person.email, action.action_type === "event" ? "invitee"
        : action.action_type === "campaign" ? "volunteer" : "assignee",
      status, action.action_type === "event" && status === "confirmed" ? "pending" : "not_applicable",
      dateOnlyAfter(14 + (index % 30)), "Alocare demonstrativă.",
      finished ? "Raport demonstrativ de activitate." : "", finished ? "Obiectiv demonstrativ realizat." : "",
      finished ? 2 + (index % 6) : 0, person.createdAt, status !== "invited" ? daysAfter(person.createdAt, 2) : null,
      null, finished ? daysAfter(person.createdAt, 8) : null, status === "completed" ? daysAfter(person.createdAt, 9) : null,
      userIdByEmail.get(coordinatorEmailBySlug.get(action.slug) ?? "") ?? null,
      person.createdAt, finished ? daysAfter(person.createdAt, 9) : person.createdAt];
  });
  await insertRowsInBatches({
    client,
    statement: `INSERT INTO mobilization_participants (
      action_id, user_id, membership_id, full_name, email, participation_role,
      status, attendance_status, due_at, notes, report, result, hours,
      invited_at, responded_at, checked_in_at, reported_at, reviewed_at,
      assigned_by, created_at, updated_at
    )`,
    columnCount: 21,
    rows: participantRows,
  });

  const responsePeople = people.filter((person) => ["supporter", "application", "verified"].includes(person.membershipStatus)).slice(0, 240);
  const responseRows = responsePeople.map<SqlValue[]>((person, index) => {
    const action = actionResult.rows[index % actionResult.rows.length];
    return [action.id, person.fullName, person.email, person.phone, person.county, person.locality,
      JSON.stringify(index % 2 === 0 ? ["organizare", "comunicare"] : ["pensii", "sanatate"]),
      index % 3 === 0 ? "weekend" : "flexibil", "Răspuns demonstrativ pentru testarea mobilizării.",
      index % 4 !== 0, index % 4 !== 0, index % 3 === 0, index % 5 === 0,
      "mobilizare-v2", true, person.createdAt];
  });
  if (responseRows.length > 0 && actionResult.rows.length > 0) {
    await insertRowsInBatches({
      client,
      statement: `INSERT INTO mobilization_responses (
        action_id, full_name, email, phone, county, locality, interests, availability,
        message, updates_consent, email_consent, sms_consent, whatsapp_consent,
        consent_version, privacy_consent, created_at
      )`,
      columnCount: 16,
      rows: responseRows,
    });
  }
  return { participants: participantRows.length, responses: responseRows.length };
}

async function seedMembershipDues(
  client: PoolClient,
  people: SeedPerson[],
  membershipIdByEmail: Map<string, string>,
): Promise<number> {
  const rows: SqlValue[][] = [];
  for (const [personIndex, person] of people.entries()) {
    if (!["active", "suspended", "terminated"].includes(person.membershipStatus)) {continue;}
    const membershipId = membershipIdByEmail.get(person.email);
    if (!membershipId) {continue;}
    for (const monthOffset of [-2, -1, 0]) {
      let status: "paid" | "due" | "overdue" | "waived" | "cancelled";
      if (person.membershipStatus === "suspended") {status = "waived";}
      else if (person.membershipStatus === "terminated") {status = "cancelled";}
      else if (monthOffset < 0) {status = personIndex % 7 === 0 && monthOffset === -1 ? "overdue" : "paid";}
      else {status = "due";}
      const periodStart = monthStart(monthOffset);
      const periodEnd = monthEnd(monthOffset);
      const dueAt = new Date(Date.UTC(periodStart.getUTCFullYear(), periodStart.getUTCMonth(), 15));
      rows.push([membershipId, periodStart, periodEnd, 10, "RON", status, dueAt,
        status === "paid" ? daysAfter(dueAt, -2) : null,
        `DEMO-${person.key}-${periodStart.toISOString().slice(0, 7)}`.slice(0, 120),
        periodStart, status === "paid" ? daysAfter(dueAt, -2) : periodStart]);
    }
  }
  await insertRowsInBatches({
    client,
    statement: `INSERT INTO membership_dues (
      membership_id, period_start, period_end, amount, currency, status,
      due_at, paid_at, reference, created_at, updated_at
    )`,
    columnCount: 11,
    rows,
  });
  return rows.length;
}

async function main(): Promise<void> {
  if (process.env.NODE_ENV?.trim().toLowerCase() === "production") {
    throw new Error("Seed-ul demonstrativ este dezactivat in productie.");
  }
  assertSafeTestDatabase({
    nodeEnv: process.env.NODE_ENV ?? "development",
    databaseUrl: process.env.NODE_ENV?.trim().toLowerCase() === "test"
      ? process.env.TEST_DATABASE_URL ?? ""
      : process.env.DATABASE_URL ?? "",
    testDatabaseUrl: process.env.TEST_DATABASE_URL ?? "",
  });

  const seedSql = await readFile(new URL("../../sql/seed.sql", import.meta.url), "utf8");
  await pool.query(seedSql);
  const countyIdByName = await readCountyMap();
  const people = buildSeedPeople(countyIdByName);
  const organizations = buildSeedOrganizations(countyIdByName);
  const configuredPassword = process.env.SEED_DEMO_PASSWORD?.trim();
  const passwordHash = await hashPassword(configuredPassword || randomBytes(48).toString("base64url"));

  const result = await withTransaction(async (client) => {
    await cleanupDemoPeople(client);
    const userIdByEmail = await seedUsers(client, people, passwordHash);
    await seedOrganizations(client, organizations, userIdByEmail, people);
    const volunteerIdByEmail = await seedVolunteers(client, people, userIdByEmail);
    const membershipIdByEmail = await seedMemberships(client, people, userIdByEmail, volunteerIdByEmail);
    const membershipEvents = await seedMembershipEvents(client, people, membershipIdByEmail, userIdByEmail);
    const organizationDetails = await seedMandatesAndObjectives(client, people, organizations, userIdByEmail);
    const consents = await seedCommunicationConsents(client, people, userIdByEmail, membershipIdByEmail);
    const mobilization = await seedMobilization(client, people, userIdByEmail, membershipIdByEmail);
    const dues = await seedMembershipDues(client, people, membershipIdByEmail);
    return {
      users: userIdByEmail.size,
      volunteers: volunteerIdByEmail.size,
      memberships: membershipIdByEmail.size,
      membershipEvents,
      organizations: organizations.length,
      mandates: organizationDetails.mandates,
      objectives: organizationDetails.objectives,
      consents,
      participants: mobilization.participants,
      responses: mobilization.responses,
      dues,
    };
  });

  console.log("Seed demonstrativ finalizat:", result);
  console.log(configuredPassword
    ? "Conturile demo folosesc parola configurată prin SEED_DEMO_PASSWORD."
    : "Conturile demo au parole aleatorii necunoscute; setează SEED_DEMO_PASSWORD numai într-un mediu de test dacă ai nevoie de autentificare.");
}

main().catch((error) => {
  console.error("Eroare la seed DB:", error);
  process.exitCode = 1;
}).finally(async () => {
  await closePool();
});
