import assert from "node:assert/strict";
import test from "node:test";
import { escapeCsvCell, preventCsvFormulaInjection } from "../../lib/csv.js";

test("preventCsvFormulaInjection should prefix risky spreadsheet formulas", () => {
  assert.equal(preventCsvFormulaInjection("=1+1"), "'=1+1");
  assert.equal(preventCsvFormulaInjection("+SUM(A1:A3)"), "'+SUM(A1:A3)");
  assert.equal(preventCsvFormulaInjection("-cmd|' /C calc'!A0"), "'-cmd|' /C calc'!A0");
  assert.equal(preventCsvFormulaInjection("@evil"), "'@evil");
  assert.equal(preventCsvFormulaInjection("safe text"), "safe text");
});

test("escapeCsvCell should escape quotes and preserve CSV safety", () => {
  assert.equal(escapeCsvCell("simple"), "simple");
  assert.equal(escapeCsvCell("value,with,comma"), "\"value,with,comma\"");
  assert.equal(escapeCsvCell("say \"hello\""), "\"say \"\"hello\"\"\"");
  assert.equal(escapeCsvCell("=2+2"), "'=2+2");
  assert.equal(escapeCsvCell(42), "42");
  assert.equal(escapeCsvCell(new Date("2026-02-20T00:00:00.000Z")), "2026-02-20T00:00:00.000Z");
});
