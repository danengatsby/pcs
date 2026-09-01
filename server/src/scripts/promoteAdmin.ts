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
};

function printUsage(): void {
  console.log("Utilizare:");
  console.log("  npm run auth:promote-admin --workspace server -- --email user@example.com");
  console.log("Optiuni:");
  console.log("  --email <valoare>   Email-ul utilizatorului care va deveni PRESEDINTE");
  console.log("  --dry-run           Simuleaza operatia fara update in baza de date");
  console.log("  --help              Afiseaza acest mesaj");
}

function parseArgs(argv: string[]): ScriptArgs {
  let email = "";
  let dryRun = false;

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

  if (user.role === "PRESEDINTE") {
    console.log(`Utilizatorul ${user.email} este deja PRESEDINTE.`);
    return;
  }

  if (args.dryRun) {
    console.log(`[dry-run] Utilizatorul ${user.email} ar fi promovat de la ${user.role} la PRESEDINTE.`);
    return;
  }

  const updatedResult = await query<UserRow>(
    `
      UPDATE users
      SET role = 'PRESEDINTE'
      WHERE id = $1
      RETURNING
        id::text AS id,
        full_name AS "fullName",
        email,
        role
    `,
    [user.id]
  );

  const updated = updatedResult.rows[0];
  if (!updated) {
    throw new Error("Promovarea a esuat. Incearca din nou.");
  }

  await recordAdminAudit({
    actor: {
      email: "system-script",
      role: "SYSTEM",
    },
    action: "auth.promote_admin",
    targetType: "user",
    targetId: updated.id,
    details: {
      email: updated.email,
      previousRole: user.role,
      nextRole: updated.role,
    },
  });

  console.log(`Promovare reusita: ${updated.email} are acum rolul ${updated.role}.`);
}

main()
  .catch((error) => {
    console.error("Eroare la promovare PRESEDINTE:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closePool();
  });
