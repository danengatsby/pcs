import { listFinanceRepository } from "./finance.repository.js";
import type { ListFinanceQuery } from "./finance.schema.js";
import { readRegulatedModuleGate } from "../governance/regulatedModules.repository.js";

export async function listFinanceService(filters: ListFinanceQuery): Promise<{
  rows: Awaited<ReturnType<typeof listFinanceRepository>>["rows"];
  total: number;
  totals: {
    income: number;
    expense: number;
    balance: number;
  };
  governance: Awaited<ReturnType<typeof readRegulatedModuleGate>>;
}> {
  const governance = await readRegulatedModuleGate("financial_transparency");
  if (!governance.enabled) {
    return { rows: [], total: 0, totals: { income: 0, expense: 0, balance: 0 }, governance };
  }
  const result = await listFinanceRepository(filters);

  let income = 0;
  let expense = 0;
  for (const row of result.rows) {
    if (row.type === "income") {
      income += row.amount;
    } else {
      expense += row.amount;
    }
  }

  return {
    rows: result.rows,
    total: result.total,
    totals: {
      income,
      expense,
      balance: income - expense,
    },
    governance,
  };
}
