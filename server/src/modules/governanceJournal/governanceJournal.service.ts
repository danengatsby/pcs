import { listGovernanceJournal } from "./governanceJournal.repository.js";
import type { GovernanceJournalQuery } from "./governanceJournal.schema.js";

export function listGovernanceJournalService(input: GovernanceJournalQuery) {
  return listGovernanceJournal(input);
}