import {
  setupCommon,
  setupDatabaseServices,
  setupIsolatedDatabase,
} from "@/_test/setup.js";
import { onchainTable } from "@/drizzle/db.js";
import { eq } from "@/drizzle/db.js";
import { encodeCheckpoint, zeroCheckpoint } from "@/utils/checkpoint.js";
import { pgEnum, pgTable } from "drizzle-orm/pg-core";
import { zeroAddress } from "viem";
import { beforeEach, expect, test, vi } from "vitest";
import { createIndexingStore } from "./index.js";

beforeEach(setupCommon);
beforeEach(setupIsolatedDatabase);

vi.mock("@/generated", async () => {
  return {
    instanceId: "test",
  };
});

test("find", async (context) => {
  const { database, cleanup } = await setupDatabaseServices(context);

  const schema = {
    account: onchainTable("account", (p) => ({
      address: p.evmHex().primaryKey(),
      balance: p.evmBigint().notNull(),
    })),
  };

  const indexingStore = createIndexingStore({
    common: context.common,
    database,
    schema,
    initialCheckpoint: encodeCheckpoint(zeroCheckpoint),
  });

  // empty

  let result = await indexingStore.find(schema.account, {
    address: zeroAddress,
  });

  expect(result).toBe(null);

  // with entry

  await indexingStore
    .insert(schema.account)
    .values({ address: zeroAddress, balance: 10n });

  result = await indexingStore.find(schema.account, {
    address: zeroAddress,
  });

  expect(result).toStrictEqual({ address: zeroAddress, balance: 10n });

  await cleanup();
});

test("insert", async (context) => {
  const { database, cleanup } = await setupDatabaseServices(context);

  const schema = {
    account: onchainTable("account", (p) => ({
      address: p.evmHex().primaryKey(),
      balance: p.evmBigint().notNull(),
    })),
  };

  const indexingStore = createIndexingStore({
    common: context.common,
    database,
    schema,
    initialCheckpoint: encodeCheckpoint(zeroCheckpoint),
  });

  // single

  await indexingStore
    .insert(schema.account)
    .values({ address: zeroAddress, balance: 10n });

  let result = await indexingStore.find(schema.account, {
    address: zeroAddress,
  });

  expect(result).toStrictEqual({ address: zeroAddress, balance: 10n });

  // multiple

  await indexingStore.insert(schema.account).values([
    { address: "0x0000000000000000000000000000000000000001", balance: 12n },
    { address: "0x0000000000000000000000000000000000000002", balance: 52n },
  ]);

  result = await indexingStore.find(schema.account, {
    address: "0x0000000000000000000000000000000000000001",
  });

  expect(result).toStrictEqual({
    address: "0x0000000000000000000000000000000000000001",
    balance: 12n,
  });

  result = await indexingStore.find(schema.account, {
    address: "0x0000000000000000000000000000000000000002",
  });

  expect(result).toStrictEqual({
    address: "0x0000000000000000000000000000000000000002",
    balance: 52n,
  });

  await cleanup();
});

test("update", async (context) => {
  const { database, cleanup } = await setupDatabaseServices(context);

  const schema = {
    account: onchainTable("account", (p) => ({
      address: p.evmHex().primaryKey(),
      balance: p.evmBigint().notNull(),
    })),
  };

  const indexingStore = createIndexingStore({
    common: context.common,
    database,
    schema,
    initialCheckpoint: encodeCheckpoint(zeroCheckpoint),
  });

  // setup

  await indexingStore
    .insert(schema.account)
    .values({ address: zeroAddress, balance: 10n });

  // no function

  await indexingStore
    .update(schema.account, { address: zeroAddress })
    .set({ balance: 12n });

  let result = await indexingStore.find(schema.account, {
    address: zeroAddress,
  });

  expect(result).toStrictEqual({
    address: zeroAddress,
    balance: 12n,
  });

  // function

  await indexingStore
    .update(schema.account, { address: zeroAddress })
    .set((row) => ({ balance: row.balance + 10n }));

  result = await indexingStore.find(schema.account, {
    address: zeroAddress,
  });

  expect(result).toStrictEqual({
    address: zeroAddress,
    balance: 22n,
  });

  await cleanup();
});

test("upsert", async (context) => {
  const { database, cleanup } = await setupDatabaseServices(context);

  const schema = {
    account: onchainTable("account", (p) => ({
      address: p.evmHex().primaryKey(),
      balance: p.evmBigint().notNull(),
    })),
  };

  const indexingStore = createIndexingStore({
    common: context.common,
    database,
    schema,
    initialCheckpoint: encodeCheckpoint(zeroCheckpoint),
  });

  // insert

  await indexingStore
    .upsert(schema.account, { address: zeroAddress })
    .insert({ balance: 12n })
    .update({ balance: 5n });

  let result = await indexingStore.find(schema.account, {
    address: zeroAddress,
  });

  expect(result).toStrictEqual({
    address: zeroAddress,
    balance: 12n,
  });

  // insert then

  await indexingStore
    .upsert(schema.account, {
      address: "0x0000000000000000000000000000000000000001",
    })
    .insert({ balance: 88n });

  result = await indexingStore.find(schema.account, {
    address: "0x0000000000000000000000000000000000000001",
  });

  expect(result).toStrictEqual({
    address: "0x0000000000000000000000000000000000000001",
    balance: 88n,
  });

  // update

  await indexingStore
    .upsert(schema.account, { address: zeroAddress })
    .insert({ balance: 12n })
    .update({ balance: 5n });

  result = await indexingStore.find(schema.account, {
    address: zeroAddress,
  });

  expect(result).toStrictEqual({
    address: zeroAddress,
    balance: 5n,
  });

  // update fn

  await indexingStore
    .upsert(schema.account, { address: zeroAddress })
    .insert({ balance: 12n })
    .update((row) => ({ balance: row.balance * 2n }));

  result = await indexingStore.find(schema.account, {
    address: zeroAddress,
  });

  expect(result).toStrictEqual({
    address: zeroAddress,
    balance: 10n,
  });

  // update then

  await indexingStore
    .upsert(schema.account, {
      address: "0x0000000000000000000000000000000000000002",
    })
    .update({ balance: 88n });

  result = await indexingStore.find(schema.account, {
    address: "0x0000000000000000000000000000000000000002",
  });

  expect(result).toBe(null);

  await cleanup();
});

test("delete", async (context) => {
  const { database, cleanup } = await setupDatabaseServices(context);

  const schema = {
    account: onchainTable("account", (p) => ({
      address: p.evmHex().primaryKey(),
      balance: p.evmBigint().notNull(),
    })),
  };

  const indexingStore = createIndexingStore({
    common: context.common,
    database,
    schema,
    initialCheckpoint: encodeCheckpoint(zeroCheckpoint),
  });

  // no entry

  let deleted = await indexingStore.delete(schema.account, {
    address: zeroAddress,
  });

  expect(deleted).toBe(false);

  // entry

  await indexingStore
    .insert(schema.account)
    .values({ address: zeroAddress, balance: 12n });

  deleted = await indexingStore.delete(schema.account, {
    address: zeroAddress,
  });

  expect(deleted).toBe(true);

  const result = await indexingStore.find(schema.account, {
    address: zeroAddress,
  });

  expect(result).toBe(null);

  await cleanup();
});

test("flush", async (context) => {
  const schema = {
    account: onchainTable("account", (p) => ({
      address: p.evmHex().primaryKey(),
      balance: p.evmBigint().notNull(),
    })),
  };

  const { database, cleanup } = await setupDatabaseServices(context, {
    schema,
  });

  const indexingStore = createIndexingStore({
    common: context.common,
    database,
    schema,
    initialCheckpoint: encodeCheckpoint(zeroCheckpoint),
  });

  // insert

  await indexingStore.insert(schema.account).values({
    address: zeroAddress,
    balance: 10n,
  });

  await indexingStore.flush({ force: true });

  let result = await indexingStore.find(schema.account, {
    address: zeroAddress,
  });

  expect(result).toStrictEqual({
    address: zeroAddress,
    balance: 10n,
  });

  // update

  await indexingStore.update(schema.account, { address: zeroAddress }).set({
    balance: 12n,
  });

  await indexingStore.flush({ force: true });

  result = await indexingStore.find(schema.account, {
    address: zeroAddress,
  });

  expect(result).toStrictEqual({
    address: zeroAddress,
    balance: 12n,
  });

  await cleanup();
});

test("sql", async (context) => {
  const schema = {
    account: onchainTable("account", (p) => ({
      address: p.evmHex().primaryKey(),
      balance: p.evmBigint().notNull(),
    })),
  };

  const { database, cleanup } = await setupDatabaseServices(context, {
    schema,
  });

  const indexingStore = createIndexingStore({
    common: context.common,
    database,
    schema,
    initialCheckpoint: encodeCheckpoint(zeroCheckpoint),
  });

  // setup

  await indexingStore.insert(schema.account).values({
    address: zeroAddress,
    balance: 10n,
  });

  // select

  const result = await indexingStore.sql
    .select()
    .from(schema.account)
    .where(eq(schema.account.address, zeroAddress));

  expect(result).toStrictEqual([
    {
      address: zeroAddress,
      balance: 10n,
    },
  ]);

  // TODO(kyle) triggers

  await cleanup();
});

test("onchain table", async (context) => {
  const { database, cleanup } = await setupDatabaseServices(context);

  const schema = {
    account: pgTable("account", (p) => ({
      address: p.text().primaryKey(),
      balance: p.integer().notNull(),
    })),
  };

  const indexingStore = createIndexingStore({
    common: context.common,
    database,
    schema,
    initialCheckpoint: encodeCheckpoint(zeroCheckpoint),
  });

  // check error

  const error = await indexingStore
    // @ts-ignore
    .find(schema.account, { address: zeroAddress })
    .catch((error) => error);

  expect(error).toBeDefined();

  await cleanup();
});

test("missing rows", async (context) => {
  const { database, cleanup } = await setupDatabaseServices(context);

  const schema = {
    account: onchainTable("account", (p) => ({
      address: p.evmHex().primaryKey(),
      balance: p.evmBigint().notNull(),
    })),
  };

  const indexingStore = createIndexingStore({
    common: context.common,
    database,
    schema,
    initialCheckpoint: encodeCheckpoint(zeroCheckpoint),
  });

  // error

  const error = await indexingStore
    .insert(schema.account)
    // @ts-ignore
    .values({ address: zeroAddress })
    .catch((error) => error);

  expect(error).toBeDefined();

  await cleanup();
});

test("serial", async (context) => {
  const { database, cleanup } = await setupDatabaseServices(context);

  const schema = {
    account: onchainTable("account", (p) => ({
      id: p.serial().primaryKey(),
      balance: p.evmBigint().notNull(),
    })),
  };

  const indexingStore = createIndexingStore({
    common: context.common,
    database,
    schema,
    initialCheckpoint: encodeCheckpoint(zeroCheckpoint),
  });

  // check error

  const error = await indexingStore
    // @ts-ignore
    .find(schema.account, { id: 0 })
    .catch((error) => error);

  expect(error).toBeDefined();

  // insert

  await indexingStore.insert(schema.account).values({
    balance: 10n,
  });

  await cleanup();
});

test("notNull", async (context) => {
  const { database, cleanup } = await setupDatabaseServices(context);

  let schema = {
    account: onchainTable("account", (p) => ({
      address: p.evmHex().primaryKey(),
      balance: p.evmBigint(),
    })),
  };

  let indexingStore = createIndexingStore({
    common: context.common,
    database,
    schema,
    initialCheckpoint: encodeCheckpoint(zeroCheckpoint),
  });

  // insert

  await indexingStore.insert(schema.account).values({ address: zeroAddress });

  const result = await indexingStore.find(schema.account, {
    address: zeroAddress,
  });

  expect(result).toStrictEqual({ address: zeroAddress, balance: null });

  // error

  schema = {
    // @ts-ignore
    account: onchainTable("account", (p) => ({
      address: p.evmHex().primaryKey(),
      balance: p.evmBigint().notNull(),
    })),
  };

  indexingStore = createIndexingStore({
    common: context.common,
    database,
    schema,
    initialCheckpoint: encodeCheckpoint(zeroCheckpoint),
  });

  let error = await indexingStore
    .insert(schema.account)
    .values({ address: zeroAddress })
    .catch((error) => error);

  expect(error).toBeDefined();

  error = await indexingStore
    .insert(schema.account)
    .values({ address: zeroAddress, balance: null })
    .catch((error) => error);

  expect(error).toBeDefined();

  await cleanup();
});

test("default", async (context) => {
  const { database, cleanup } = await setupDatabaseServices(context);

  const schema = {
    account: onchainTable("account", (p) => ({
      address: p.evmHex().primaryKey(),
      balance: p.evmBigint().default(10n),
    })),
  };

  const indexingStore = createIndexingStore({
    common: context.common,
    database,
    schema,
    initialCheckpoint: encodeCheckpoint(zeroCheckpoint),
  });

  await indexingStore.insert(schema.account).values({ address: zeroAddress });

  const result = await indexingStore.find(schema.account, {
    address: zeroAddress,
  });

  expect(result).toStrictEqual({ address: zeroAddress, balance: 10n });

  await cleanup();
});

test("$default", async (context) => {
  const { database, cleanup } = await setupDatabaseServices(context);

  const schema = {
    account: onchainTable("account", (p) => ({
      address: p.evmHex().primaryKey(),
      balance: p.evmBigint().$default(() => 10n),
    })),
  };

  const indexingStore = createIndexingStore({
    common: context.common,
    database,
    schema,
    initialCheckpoint: encodeCheckpoint(zeroCheckpoint),
  });

  await indexingStore.insert(schema.account).values({ address: zeroAddress });

  const result = await indexingStore.find(schema.account, {
    address: zeroAddress,
  });

  expect(result).toStrictEqual({ address: zeroAddress, balance: 10n });

  await cleanup();
});

test("$onUpdateFn", async (context) => {
  const { database, cleanup } = await setupDatabaseServices(context);

  const schema = {
    account: onchainTable("account", (p) => ({
      address: p.evmHex().primaryKey(),
      balance: p
        .evmBigint()
        .notNull()
        .$onUpdateFn(() => 10n),
    })),
  };

  const indexingStore = createIndexingStore({
    common: context.common,
    database,
    schema,
    initialCheckpoint: encodeCheckpoint(zeroCheckpoint),
  });

  // insert

  await indexingStore.insert(schema.account).values({ address: zeroAddress });

  const result = await indexingStore.find(schema.account, {
    address: zeroAddress,
  });

  expect(result).toStrictEqual({ address: zeroAddress, balance: 10n });

  // update

  await cleanup();
});

test("array", async (context) => {
  const { database, cleanup } = await setupDatabaseServices(context);

  // dynamic size

  const schema = {
    account: onchainTable("account", (p) => ({
      address: p.evmHex().primaryKey(),
      balances: p.evmBigint().array().notNull(),
    })),
  };

  const indexingStore = createIndexingStore({
    common: context.common,
    database,
    schema,
    initialCheckpoint: encodeCheckpoint(zeroCheckpoint),
  });

  await indexingStore.insert(schema.account).values({
    address: zeroAddress,
    balances: [20n],
  });

  const result = await indexingStore.find(schema.account, {
    address: zeroAddress,
  });

  expect(result).toStrictEqual({
    address: zeroAddress,
    balances: [20n],
  });

  // TODO(kyle) fixed size

  await cleanup();
});

test("enum", async (context) => {
  const { database, cleanup } = await setupDatabaseServices(context);

  const moodEnum = pgEnum("mood", ["sad", "ok", "happy"]);
  const schema = {
    moodEnum,
    account: onchainTable("account", (p) => ({
      address: p.evmHex().primaryKey(),
      mood: moodEnum(),
    })),
  };

  const indexingStore = createIndexingStore({
    common: context.common,
    database,
    schema,
    initialCheckpoint: encodeCheckpoint(zeroCheckpoint),
  });

  await indexingStore.insert(schema.account).values({
    address: zeroAddress,
    mood: "ok",
  });

  const result = await indexingStore.find(schema.account, {
    address: zeroAddress,
  });

  expect(result).toStrictEqual({
    address: zeroAddress,
    mood: "ok",
  });

  // TODO(kyle) error

  await cleanup();
});
