import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptDirectory, "..");
const prismaSchemaPath = path.join(repositoryRoot, "server", "prisma", "schema.prisma");
const migrationsPath = path.join(repositoryRoot, "server", "sql", "migrations");

function fail(message) {
  console.error(`Schema drift: ${message}`);
  process.exitCode = 1;
}

function parsePrismaModels(schema) {
  const models = new Map();
  const modelPattern = /model\s+\w+\s*\{([\s\S]*?)\n\}/g;
  let match;

  while ((match = modelPattern.exec(schema)) !== null) {
    const body = match[1];
    const tableMatch = body.match(/@@map\("([^"]+)"\)/);
    if (!tableMatch) {
      continue;
    }

    const columns = new Set();
    for (const line of body.split("\n")) {
      const fieldMatch = line.trim().match(/^(\w+)\s+([\w?\[\]]+)(?:\s+.*)?$/);
      if (!fieldMatch || fieldMatch[1].startsWith("@@")) {
        continue;
      }

      const [, fieldName, fieldTypeAndOptionality] = fieldMatch;
      const scalarTypes = new Set(["String", "Int", "BigInt", "Float", "Decimal", "Boolean", "DateTime", "Json", "Bytes"]);
      if (fieldTypeAndOptionality.endsWith("]") || !scalarTypes.has(fieldTypeAndOptionality.replace("?", ""))) {
        continue;
      }

      const mappedName = line.match(/@map\("([^"]+)"\)/)?.[1] ?? fieldName;
      columns.add(mappedName);
    }

    models.set(tableMatch[1], columns);
  }

  return models;
}

function splitSqlColumns(tableBody) {
  const columns = [];
  let current = "";
  let parentheses = 0;

  for (const character of tableBody) {
    if (character === "(") parentheses += 1;
    if (character === ")") parentheses -= 1;
    if (character === "," && parentheses === 0) {
      columns.push(current.trim());
      current = "";
      continue;
    }
    current += character;
  }
  if (current.trim()) columns.push(current.trim());
  return columns;
}

function parseSqlTables(schema) {
  const tables = new Map();
  const tablePattern = /CREATE TABLE IF NOT EXISTS\s+(\w+)\s*\(([\s\S]*?)\n\);/gi;
  let match;

  while ((match = tablePattern.exec(schema)) !== null) {
    const columns = new Set();
    for (const definition of splitSqlColumns(match[2])) {
      const columnMatch = definition.match(/^([a-zA-Z_]\w*)\s+/);
      if (columnMatch && !/^(PRIMARY|UNIQUE|CHECK|CONSTRAINT|FOREIGN)$/i.test(columnMatch[1])) {
        columns.add(columnMatch[1]);
      }
    }
    tables.set(match[1], columns);
  }

  const alterTablePattern = /ALTER TABLE\s+(?:IF EXISTS\s+)?(\w+)([\s\S]*?);/gi;
  while ((match = alterTablePattern.exec(schema)) !== null) {
    const table = tables.get(match[1]) ?? new Set();
    for (const columnMatch of match[2].matchAll(/ADD COLUMN\s+(?:IF NOT EXISTS\s+)?(\w+)/gi)) {
      table.add(columnMatch[1]);
    }
    for (const columnMatch of match[2].matchAll(/DROP COLUMN\s+(?:IF EXISTS\s+)?(\w+)/gi)) {
      table.delete(columnMatch[1]);
    }
    tables.set(match[1], table);
  }

  return tables;
}

function compareSchemas(prismaModels, sqlTables) {
  const prismaNames = new Set(prismaModels.keys());
  const sqlNames = new Set(sqlTables.keys());

  for (const table of prismaNames) {
    if (!sqlNames.has(table)) fail(`tabelul Prisma '${table}' lipsește din schema.sql`);
  }
  for (const table of sqlNames) {
    if (!prismaNames.has(table)) fail(`tabelul SQL '${table}' lipsește din schema.prisma`);
  }

  for (const table of prismaNames) {
    if (!sqlTables.has(table)) continue;
    for (const column of prismaModels.get(table)) {
      if (!sqlTables.get(table).has(column)) fail(`coloana '${table}.${column}' lipsește din schema.sql`);
    }
    for (const column of sqlTables.get(table)) {
      if (!prismaModels.get(table).has(column)) fail(`coloana '${table}.${column}' lipsește din schema.prisma`);
    }
  }
}

const migrationFiles = (await fs.readdir(migrationsPath))
  .filter((fileName) => fileName.endsWith(".sql"))
  .sort();
const sqlSchema = (await Promise.all(
  migrationFiles.map((fileName) => fs.readFile(path.join(migrationsPath, fileName), "utf8"))
)).join("\n");

const prismaSchema = await fs.readFile(prismaSchemaPath, "utf8");

compareSchemas(parsePrismaModels(prismaSchema), parseSqlTables(sqlSchema));

if (process.exitCode !== 1) {
  console.log("Schema drift check passed: tables and columns are synchronized.");
}
