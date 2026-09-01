import { closePool, query } from "../lib/db.js";
import type { UserRole } from "../lib/authToken.js";
import { recordAdminAudit } from "../lib/adminAudit.js";

type UserRow = {
  id: string;
  fullName: string;
  email: string;
  role: UserRole;
};

type ScriptArgs = {
  email: string;
  dryRun: boolean;
  targetRole: Exclude<UserRole, "PRESEDINTE">;
};

function printUsage(): void {
  console.log("Utilizare:");
  console.log("  npm run auth:demote-admin --workspace server -- --email user@example.com");
  console.log("Optiuni:");
  console.log("  --email <valoare>   Email-ul utilizatorului PRESEDINTE care va fi retrogradat");
  console.log("  --to <rol>          Rol tinta: SUSTINATOR (default), ADERENT, MEMBRU, CONSILIER, SECRETAR sau VICEPRESEDINTE");
  console.log("  --dry-run           Simuleaza operatia fara update in baza de date");
  console.log("  --help              Afiseaza acest mesaj");
}

function parseTargetRole(raw: string | undefined): Exclude<UserRole, "PRESEDINTE"> {
  const normalized = (raw ?? "SUSTINATOR").trim().toUpperCase();
  if (
    normalized === "SUSTINATOR"
    || normalized === "ADERENT"
    || normalized === "MEMBRU"
    || normalized === "CONSILIER"
    || normalized === "SECRETAR"
    || normalized === "VICEPRESEDINTE"
  ) {
    return normalized;
  }
  throw new Error(`Rol tinta invalid: ${raw}. Valorile permise sunt SUSTINATOR, ADERENT, MEMBRU, CONSILIER, SECRETAR sau VICEPRESEDINTE.`);
}

function parseArgs(argv: string[]): ScriptArgs {
  let email = "";
  let dryRun = false;
  let targetRoleRaw: string | undefined;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg) {
      continue;
    }

    if (arg === "--help") {
      printUsage();
      process.exit(0);
    }

    if (arg === "--dry-run") {
      dryRun = true;
      continue;
    }

    if (arg === "--email") {
      const maybeValue = argv[i + 1];
      if (!maybeValue) {
        throw new Error("Lipseste valoarea pentru --email.");
      }
      email = maybeValue;
      i += 1;
      continue;
    }

    if (arg.startsWith("--email=")) {
      email = arg.slice("--email=".length);
      continue;
    }

    if (arg === "--to") {
      const maybeValue = argv[i + 1];
      if (!maybeValue) {
        throw new Error("Lipseste valoarea pentru --to.");
      }
      targetRoleRaw = maybeValue;
      i += 1;
      continue;
    }

    if (arg.startsWith("--to=")) {
      targetRoleRaw = arg.slice("--to=".length);
      continue;
    }

    throw new Error(`Argument necunoscut: ${arg}`);
  }

  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail) {
    throw new Error("Email-ul este obligatoriu. Foloseste --email.");
  }

  const basicEmailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!basicEmailRegex.test(normalizedEmail)) {
    throw new Error(`Email invalid: ${email}`);
  }

  return {
    email: normalizedEmail,
    dryRun,
    targetRole: parseTargetRole(targetRoleRaw),
  };
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  const existingResult = await query<UserRow>(
    `
      SELECT
        id::text AS id,
        full_name AS "fullName",
        email,
        role
      FROM users
      WHERE LOWER(email) = LOWER($1)
      LIMIT 1
    `,
    [args.email]
  );

  const user = existingResult.rows[0];
  if (!user) {
    throw new Error(`Nu exista utilizator cu email-ul ${args.email}.`);
  }

  if (user.role !== "PRESEDINTE") {
    console.log(`Utilizatorul ${user.email} nu are rol PRESEDINTE (rol curent: ${user.role}).`);
    return;
  }

  if (args.dryRun) {
    console.log(
      `[dry-run] Utilizatorul ${user.email} ar fi retrogradat de la PRESEDINTE la ${args.targetRole}.`
    );
    return;
  }

  const updatedResult = await query<UserRow>(
    `
      UPDATE users
      SET role = $1
      WHERE id = $2
      RETURNING
        id::text AS id,
        full_name AS "fullName",
        email,
        role
    `,
    [args.targetRole, user.id]
  );

  const updated = updatedResult.rows[0];
  if (!updated) {
    throw new Error("Retrogradarea a esuat. Incearca din nou.");
  }

  await recordAdminAudit({
    actor: {
      email: "system-script",
      role: "SYSTEM",
    },
    action: "auth.demote_admin",
    targetType: "user",
    targetId: updated.id,
    details: {
      email: updated.email,
      previousRole: user.role,
      nextRole: updated.role,
    },
  });

  console.log(`Retrogradare reusita: ${updated.email} are acum rolul ${updated.role}.`);
}

main()
  .catch((error) => {
    console.error("Eroare la retrogradare PRESEDINTE:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closePool();
  });
