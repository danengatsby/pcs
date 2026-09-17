import { open, unlink, type FileHandle } from "node:fs/promises";
import { resolve } from "node:path";
import { closePool } from "../lib/db.js";
import { manageAdminSecurity } from "../lib/adminSecurityManagement.js";
import { adminProfileNames, type AdminProfile } from "../lib/adminAccessProfiles.js";
import { issueAdminActivation } from "../lib/adminActivation.js";
import { issueAdminDirectLogin } from "../lib/adminDirectLogin.js";

async function main(): Promise<void> {
  const [action, ...argv] = process.argv.slice(2);
  if (action === "--help" || !action) {
    console.log("node server/dist/scripts/adminSecurity.js <direct-link|invite|enroll-mfa|reset-mfa|set-profile> --email titular@example.org --operator operator@example.org --reason 'Motiv documentat' [--output /cale/privata/inrolare.json] [--profile secretariat]");
    console.log(`Profiluri: ${adminProfileNames.join(", ")}. Înrolarea cere --output; fișierul nou are permisiuni 0600.`);
    return;
  }
  if (!["direct-link", "invite", "enroll-mfa", "reset-mfa", "set-profile"].includes(action)) { throw new Error("Acțiune necunoscută."); }
  const options: Record<string, string> = {};
  for (let i = 0; i < argv.length; i += 2) {
    const option = argv[i];
    const value = argv[i + 1];
    if (!option || !["--email", "--operator", "--reason", "--output", "--profile"].includes(option) || !value || value.startsWith("--") || options[option]) {
      throw new Error("Argumente invalide. Folosește --help.");
    }
    options[option] = value;
  }
  const common = { email: options["--email"] ?? "", operator: options["--operator"] ?? "", reason: options["--reason"] ?? "" };
  if (action === "enroll-mfa" || action === "invite" || action === "direct-link") {
    if (!options["--output"]) { throw new Error("Înrolarea necesită --output într-un director privat, în afara site-ului."); }
    const output = resolve(options["--output"]);
    // Keep enrollment secrets outside application assets and the repository.
    const repository = resolve(import.meta.dirname, "../../..");
    if (output === repository || output.startsWith(`${repository}/`)) {
      throw new Error("Fișierul de înrolare trebuie salvat în afara directorului aplicației.");
    }
    let file: FileHandle | undefined;
    try {
      file = await open(output, "wx", 0o600);
      const deliverEnrollment = async (enrollment: unknown) => {
        await file!.writeFile(`${JSON.stringify(enrollment, null, 2)}\n`);
        await file!.sync();
      };
      if (action === "direct-link") {await issueAdminDirectLogin({ ...common, deliver: deliverEnrollment });}
      else if (action === "invite") {await issueAdminActivation({ ...common, deliver: deliverEnrollment });}
      else {await manageAdminSecurity({ ...common, action, deliverEnrollment });}
    } catch (error) {
      if (file) { await unlink(output); }
      throw error;
    } finally {
      await file?.close();
    }
    console.log(action === "direct-link" ? "Linkul personal de acces direct, valabil 30 de minute și cu o singură utilizare, este în fișierul privat." : action === "invite" ? "Linkul de activare, valabil 24 de ore, a fost pregătit în fișierul privat. Transmite titularului linkul; acesta își alege parola și configurează MFA pe site." : "Înrolarea a fost pregătită în fișierul privat. Transmite-o titularului printr-un canal verificat, apoi șterge fișierul.");
  } else if (action === "reset-mfa") {
    await manageAdminSecurity({ ...common, action });
    console.log("Cheia MFA și sesiunile administrative au fost revocate. Contul necesită o înrolare nouă.");
  } else {
    await manageAdminSecurity({ ...common, action: "set-profile", profile: options["--profile"] as AdminProfile });
    console.log("Atribuțiile au fost actualizate și auditate. Titularul trebuie să se autentifice din nou.");
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Operația a eșuat.");
  process.exitCode = 1;
}).finally(closePool);
