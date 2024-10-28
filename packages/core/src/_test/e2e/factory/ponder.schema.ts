import { onchainTable } from "../../../drizzle/index.js";

export const swapEvent = onchainTable("swap_event", (p) => ({
  id: p.serial().primaryKey(),
  pair: p.hex().notNull(),
  from: p.hex().notNull(),
  to: p.hex().notNull(),
}));
