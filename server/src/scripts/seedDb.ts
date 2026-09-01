import { readFile } from "node:fs/promises";
import { closePool, pool, withTransaction } from "../lib/db.js";
import { hashPassword } from "../lib/password.js";
import { countyNames, normalizeCountyKey, type CountyName } from "../modules/volunteers/counties.js";
import { volunteerStatusValues, type VolunteerWorkflowStatus } from "../modules/volunteers/types.js";
import type { UserRole } from "../lib/authToken.js";

type CountyRow = {
  id: number;
  name: string;
};

type SeedEntry = {
  fullName: string;
  email: string;
  role: UserRole;
  county: string;
  countyId: number;
  locality: string;
  interest: string;
  status: VolunteerWorkflowStatus;
};

const DEFAULT_SEED_PASSWORD = "PcpSeed!2026";
const SEED_EMAIL_DOMAIN = "seed.pcp.local";

function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .trim();
}

function buildSlug(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-")
    .slice(0, 48);
}

function createBatchInsertSql(columnCount: number, rowCount: number): string {
  const rows: string[] = [];
  let param = 1;

  for (let rowIndex = 0; rowIndex < rowCount; rowIndex += 1) {
    const values: string[] = [];
    for (let colIndex = 0; colIndex < columnCount; colIndex += 1) {
      values.push(`$${param}`);
      param += 1;
    }
    rows.push(`(${values.join(", ")})`);
  }

  return rows.join(",\n");
}

function parseArrayLiteral(fileContent: string, exportName: string): string[] {
  const marker = `export const ${exportName}`;
  const markerIndex = fileContent.indexOf(marker);
  if (markerIndex === -1) {
    throw new Error(`Nu am gasit ${exportName} in fisierul de constante.`);
  }

  const start = fileContent.indexOf("[", markerIndex);
  const end = fileContent.indexOf("]", start);
  if (start === -1 || end === -1) {
    throw new Error(`Nu am putut parsa array-ul ${exportName}.`);
  }

  const literal = fileContent.slice(start, end + 1);
  const parsed = Function(`"use strict"; return (${literal});`)() as unknown;

  if (!Array.isArray(parsed) || !parsed.every((value) => typeof value === "string")) {
    throw new Error(`Array-ul ${exportName} are format invalid.`);
  }

  return parsed;
}

function parseLocalitiesMap(fileContent: string): Record<CountyName, readonly string[]> {
  const marker = "export const localitiesByCounty";
  const markerIndex = fileContent.indexOf(marker);
  if (markerIndex === -1) {
    throw new Error("Nu am gasit localitiesByCounty in fisierul de constante.");
  }

  const objectStart = fileContent.indexOf("{", markerIndex);
  const objectEnd = fileContent.indexOf("};", objectStart);
  if (objectStart === -1 || objectEnd === -1) {
    throw new Error("Nu am putut parsa localitiesByCounty.");
  }

  const literal = fileContent.slice(objectStart, objectEnd + 1);
  const parsed = Function(`"use strict"; return (${literal});`)() as unknown;

  if (!parsed || typeof parsed !== "object") {
    throw new Error("Structura localitiesByCounty este invalida.");
  }

  return parsed as Record<CountyName, readonly string[]>;
}

function mapInterestToRole(interest: string): UserRole {
  const normalized = normalizeText(interest);

  if (normalized === "simpatizant" || normalized === "sustinator") {
    return "SUSTINATOR";
  }
  if (normalized === "aderent") {
    return "ADERENT";
  }
  if (normalized === "membru") {
    return "MEMBRU";
  }
  if (normalized === "organizator" || normalized === "consilier") {
    return "CONSILIER";
  }
  if (normalized === "secretar") {
    return "SECRETAR";
  }
  if (normalized === "vicepresedinte") {
    return "VICEPRESEDINTE";
  }
  if (normalized === "presedinte") {
    return "PRESEDINTE";
  }

  return "ADERENT";
}

async function loadLocalityAndInterestConstants(): Promise<{
  localitiesByCounty: Record<CountyName, readonly string[]>;
  interestOptions: string[];
}> {
  const localitiesFile = await readFile(
    new URL("../../../client/src/react/modules/volunteers/constants/localities.ts", import.meta.url),
    "utf8"
  );
  const interestsFile = await readFile(
    new URL("../../../client/src/react/modules/volunteers/constants/interests.ts", import.meta.url),
    "utf8"
  );

  const localitiesByCounty = parseLocalitiesMap(localitiesFile);
  const interestOptions = parseArrayLiteral(interestsFile, "interestOptions");

  if (interestOptions.length === 0) {
    throw new Error("Lista de interese este goala.");
  }

  return { localitiesByCounty, interestOptions };
}

function buildSeedEntries(input: {
  countyIdByName: Map<string, number>;
  localitiesByCounty: Record<CountyName, readonly string[]>;
  interestOptions: string[];
}): SeedEntry[] {
  const result: SeedEntry[] = [];

  for (const county of countyNames) {
    const countyId = input.countyIdByName.get(county);
    if (!countyId) {
      throw new Error(`Judetul ${county} nu exista in tabela counties.`);
    }

    const localities = input.localitiesByCounty[county] ?? [];
    if (localities.length === 0) {
      throw new Error(`Judetul ${county} nu are localitati definite.`);
    }

    for (const locality of localities) {
      for (const interest of input.interestOptions) {
        const role = mapInterestToRole(interest);

        for (const status of volunteerStatusValues) {
          const countySlug = buildSlug(county);
          const localitySlug = buildSlug(locality);
          const interestSlug = buildSlug(interest);
          const email = `${countySlug}.${localitySlug}.${interestSlug}.${status}@${SEED_EMAIL_DOMAIN}`;
          const indexLabel = `${county}-${locality}-${interest}-${status}`;

          result.push({
            fullName: `Demo ${interest} ${status} ${county}`.slice(0, 160),
            email,
            role,
            county,
            countyId,
            locality,
            interest,
            status,
          });

          if (indexLabel.length === 0) {
            throw new Error("Seed label invalid.");
          }
        }
      }
    }
  }

  return result;
}

async function readCountyMap(): Promise<Map<string, number>> {
  const result = await pool.query<CountyRow>(
    `
      SELECT id, name
      FROM counties
      ORDER BY name ASC
    `
  );

  const map = new Map<string, number>();

  for (const row of result.rows) {
    map.set(row.name, row.id);
    map.set(normalizeCountyKey(row.name), row.id);
  }

  return map;
}

async function insertUsersInBatches(input: {
  entries: SeedEntry[];
  passwordHash: string;
  batchSize: number;
}): Promise<number> {
  let inserted = 0;

  for (let index = 0; index < input.entries.length; index += input.batchSize) {
    const batch = input.entries.slice(index, index + input.batchSize);
    const valuesSql = createBatchInsertSql(4, batch.length);
    const params: Array<string> = [];

    for (const item of batch) {
      params.push(item.fullName, item.email, input.passwordHash, item.role);
    }

    const result = await pool.query<{ id: string }>(
      `
        INSERT INTO users (
          full_name,
          email,
          password_hash,
          role
        )
        VALUES
        ${valuesSql}
        ON CONFLICT DO NOTHING
        RETURNING id
      `,
      params
    );

    inserted += result.rowCount ?? 0;
  }

  return inserted;
}

async function insertVolunteersInBatches(input: {
  entries: SeedEntry[];
  batchSize: number;
}): Promise<number> {
  let inserted = 0;

  for (let index = 0; index < input.entries.length; index += input.batchSize) {
    const batch = input.entries.slice(index, index + input.batchSize);
    const valuesSql = createBatchInsertSql(12, batch.length);
    const params: Array<string | number | Date | null> = [];

    for (const item of batch) {
      const statusUpdatedAt = item.status === "nou" ? null : new Date();
      params.push(
        item.fullName,
        item.email,
        "0700000000",
        item.county,
        item.countyId,
        item.locality,
        item.interest,
        `Inscriere demo generata automat pentru ${item.county} - ${item.locality}.`,
        item.status,
        `Seed status ${item.status}`,
        statusUpdatedAt,
        null
      );
    }

    const result = await pool.query<{ id: string }>(
      `
        INSERT INTO volunteers (
          full_name,
          email,
          phone,
          county,
          county_id,
          locality,
          skills,
          motivation,
          workflow_status,
          internal_notes,
          status_updated_at,
          status_updated_by
        )
        VALUES
        ${valuesSql}
        ON CONFLICT DO NOTHING
        RETURNING id
      `,
      params
    );

    inserted += result.rowCount ?? 0;
  }

  return inserted;
}

async function cleanupExistingSeedUsers(): Promise<void> {
  await withTransaction(async (client) => {
    await client.query(
      `
        DELETE FROM volunteers
        WHERE email ILIKE $1
      `,
      [`%@${SEED_EMAIL_DOMAIN}`]
    );

    await client.query(
      `
        DELETE FROM users
        WHERE email ILIKE $1
      `,
      [`%@${SEED_EMAIL_DOMAIN}`]
    );
  });
}

async function main(): Promise<void> {
  const seedSql = await readFile(new URL("../../sql/seed.sql", import.meta.url), "utf8");
  await pool.query(seedSql);

  const { localitiesByCounty, interestOptions } = await loadLocalityAndInterestConstants();
  const countyIdByName = await readCountyMap();
  const entries = buildSeedEntries({
    countyIdByName,
    localitiesByCounty,
    interestOptions,
  });

  await cleanupExistingSeedUsers();

  const passwordHash = await hashPassword(DEFAULT_SEED_PASSWORD);
  const usersInserted = await insertUsersInBatches({
    entries,
    passwordHash,
    batchSize: 300,
  });
  const volunteersInserted = await insertVolunteersInBatches({
    entries,
    batchSize: 300,
  });

  console.log(
    [
      "Seed complet finalizat.",
      `Interese: ${interestOptions.length}`,
      `Statusuri: ${volunteerStatusValues.length}`,
      `Inregistrari generate: ${entries.length}`,
      `Users inserati: ${usersInserted}`,
      `Aderenti inserati: ${volunteersInserted}`,
      `Parola comuna seed: ${DEFAULT_SEED_PASSWORD}`,
    ].join(" ")
  );
}

main()
  .catch((error) => {
    console.error("Eroare la seed DB:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closePool();
  });
