import { onchainTable } from "@ponder/core";

export const depositEvent = onchainTable("deposit_event", (t) => ({
  id: t.serial().primaryKey(),
  timestamp: t.integer().notNull(),
  amount: t.bigint().notNull(),
  account: t.hex().notNull(),
}));
