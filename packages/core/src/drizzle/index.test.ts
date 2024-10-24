import { expect, test } from "vitest";
import { onchainTable, primaryKey } from "./drizzle.js";
import { getPrimaryKeyColumns } from "./index.js";

test("getPrimaryKeyColumns()", () => {
  const table = onchainTable("table", (p) => ({
    account: p.evmHex().primaryKey(),
    balance: p.evmBigint().notNull(),
  }));

  const primaryKeys = getPrimaryKeyColumns(table);

  expect(primaryKeys).toStrictEqual([{ js: "account", sql: "account" }]);
});

test("getPrimaryKeyColumns() sql", () => {
  const table = onchainTable("table", (p) => ({
    name: p.integer("unique_name").primaryKey(),
  }));

  const primaryKeys = getPrimaryKeyColumns(table);

  expect(primaryKeys).toStrictEqual([{ js: "name", sql: "unique_name" }]);
});

test("getPrimaryKeyColumns() snake case", () => {
  const table = onchainTable(
    "table",
    (p) => ({
      name: p.text(),
      age: p.integer(),
      address: p.evmHex(),
    }),
    (table) => ({
      primaryKeys: primaryKey({ columns: [table.name, table.address] }),
    }),
  );

  const primaryKeys = getPrimaryKeyColumns(table);

  expect(primaryKeys).toStrictEqual([
    { js: "name", sql: "name" },
    { js: "address", sql: "address" },
  ]);
});

test("getPrimaryKeyColumns() composite");
