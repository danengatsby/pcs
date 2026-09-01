import { listFinanceRepository } from "./finance.repository.js";
import type { ListFinanceQuery } from "./finance.schema.js";

export async function listFinanceService(filters: ListFinanceQuery): Promise<{
  rows: Awaited<ReturnType<typeof listFinanceRepository>>["rows"];
  total: number;
  totals: {
    income: number;
    expense: number;
    balance: number;
  };
}> {
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
  };
}
