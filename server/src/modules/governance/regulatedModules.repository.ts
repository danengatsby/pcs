import { query } from "../../lib/db.js";

export type RegulatedModuleKey = "financial_transparency" | "electoral";

export async function readRegulatedModuleGate(moduleKey: RegulatedModuleKey) {
  const result = await query<{
    module_key: RegulatedModuleKey;
    legal_status: string;
    dpo_status: string;
    enabled: boolean;
    updated_at: Date;
  }>(`
    SELECT module_key, legal_status, dpo_status, enabled, updated_at
    FROM regulated_module_gates
    WHERE module_key = $1
    LIMIT 1
  `, [moduleKey]);
  const row = result.rows[0];
  return row ? {
    key: row.module_key,
    legalStatus: row.legal_status,
    dpoStatus: row.dpo_status,
    enabled: row.enabled && row.legal_status === "approved" && row.dpo_status === "approved",
    updatedAt: row.updated_at.toISOString(),
    message: row.enabled && row.legal_status === "approved" && row.dpo_status === "approved"
      ? "Modul validat și activ."
      : "Modulul se activează numai după validarea fluxului de către juridic și responsabilul cu protecția datelor.",
  } : {
    key: moduleKey,
    legalStatus: "pending",
    dpoStatus: "pending",
    enabled: false,
    updatedAt: null,
    message: "Modulul se activează numai după validarea fluxului de către juridic și responsabilul cu protecția datelor.",
  };
}
