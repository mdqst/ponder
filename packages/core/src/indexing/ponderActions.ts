import { getTables } from "@/schema/utils.js";
import type { Prettify } from "@/types/utils.js";
import {
  type Abi,
  type Account,
  type Address,
  type Chain,
  type Client,
  type ContractFunctionArgs,
  type ContractFunctionName,
  type GetBlockReturnType,
  type GetBlockTransactionCountReturnType,
  type GetTransactionCountReturnType,
  type Hash,
  type MulticallParameters,
  type MulticallReturnType,
  type PublicActions,
  type PublicRpcSchema,
  type ReadContractParameters,
  type ReadContractReturnType,
  type SimulateContractParameters,
  type SimulateContractReturnType,
  type Transport,
  publicActions,
} from "viem";

import type { Service, create } from "./service.js";

/** Viem actions where the `block` property is optional and implicit. */
const blockDependentActions = [
  "getBalance",
  "call",
  "estimateGas",
  "getFeeHistory",
  "getProof",
  "getCode",
  "getStorageAt",
  "getEnsAddress",
  "getEnsAvatar",
  "getEnsName",
  "getEnsResolver",
  "getEnsText",
] as const satisfies readonly (keyof ReturnType<typeof publicActions>)[];

// TODO(kyle) "getBlock", "getBlockTransactionCount", "getTransactionCount";

/** Viem actions where the `block` property is non-existent. */
const nonBlockDependentActions = [
  "getTransaction",
  "getTransactionReceipt",
  "getTransactionConfirmations",
] as const satisfies readonly (keyof ReturnType<typeof publicActions>)[];

type BlockOptions =
  | {
      cache?: undefined;
      blockNumber?: undefined;
    }
  | {
      cache: "immutable";
      blockNumber?: undefined;
    }
  | {
      cache?: undefined;
      blockNumber: bigint;
    };

type RequiredBlockOptions =
  | {
      /** Hash of the block. */
      blockHash: Hash;
      blockNumber?: undefined;
    }
  | {
      blockHash?: undefined;
      /** The block number. */
      blockNumber: bigint;
    };

type BlockDependentAction<
  fn extends (client: any, args: any) => unknown,
  ///
  params = Parameters<fn>[0],
  returnType = ReturnType<fn>,
> = (
  args: Omit<params, "blockTag" | "blockNumber"> & BlockOptions,
) => returnType;

export type PonderActions = {
  [action in (typeof blockDependentActions)[number]]: BlockDependentAction<
    ReturnType<typeof publicActions>[action]
  >;
} & {
  multicall: <
    const contracts extends readonly unknown[],
    allowFailure extends boolean = true,
  >(
    args: Omit<
      MulticallParameters<contracts, allowFailure>,
      "blockTag" | "blockNumber"
    > &
      BlockOptions,
  ) => Promise<MulticallReturnType<contracts, allowFailure>>;
  readContract: <
    const abi extends Abi | readonly unknown[],
    functionName extends ContractFunctionName<abi, "pure" | "view">,
    const args extends ContractFunctionArgs<abi, "pure" | "view", functionName>,
  >(
    args: Omit<
      ReadContractParameters<abi, functionName, args>,
      "blockTag" | "blockNumber"
    > &
      BlockOptions,
  ) => Promise<ReadContractReturnType<abi, functionName, args>>;
  simulateContract: <
    const abi extends Abi | readonly unknown[],
    functionName extends ContractFunctionName<abi, "nonpayable" | "payable">,
    const args extends ContractFunctionArgs<
      abi,
      "nonpayable" | "payable",
      functionName
    >,
  >(
    args: Omit<
      SimulateContractParameters<abi, functionName, args>,
      "blockTag" | "blockNumber"
    > &
      BlockOptions,
  ) => Promise<SimulateContractReturnType<abi, functionName, args>>;
  getBlock: <includeTransactions extends boolean = false>(
    args: {
      /** Whether or not to include transaction data in the response. */
      includeTransactions?: includeTransactions | undefined;
    } & RequiredBlockOptions,
  ) => Promise<GetBlockReturnType<Chain | undefined, includeTransactions>>;
  getTransactionCount: (
    args: {
      /** The account address. */
      address: Address;
    } & RequiredBlockOptions,
  ) => Promise<GetTransactionCountReturnType>;
  getBlockTransactionCount: (
    args: RequiredBlockOptions,
  ) => Promise<GetBlockTransactionCountReturnType>;
} & Pick<PublicActions, (typeof nonBlockDependentActions)[number]>;

export type ReadOnlyClient<
  transport extends Transport = Transport,
  chain extends Chain | undefined = Chain | undefined,
> = Prettify<
  Omit<
    Client<transport, chain, undefined, PublicRpcSchema, PonderActions>,
    | "extend"
    | "key"
    | "batch"
    | "cacheTime"
    | "account"
    | "type"
    | "uid"
    | "chain"
    | "name"
    | "pollingInterval"
    | "transport"
    | "ccipRead"
  >
>;

export const getPonderActions = (
  contextState: Pick<Service["currentEvent"]["contextState"], "blockNumber">,
) => {
  return <
    TTransport extends Transport = Transport,
    TChain extends Chain | undefined = Chain | undefined,
    TAccount extends Account | undefined = Account | undefined,
  >(
    client: Client<TTransport, TChain, TAccount>,
  ): PonderActions => {
    const actions = {} as PonderActions;
    const _publicActions = publicActions(client);

    const addAction = <
      action extends
        | (typeof blockDependentActions)[number]
        | "multicall"
        | "readContract"
        | "simulateContract",
    >(
      action: action,
    ) => {
      // @ts-ignore
      actions[action] = ({
        cache,
        blockNumber: userBlockNumber,
        ...args
      }: Parameters<PonderActions[action]>[0]) =>
        // @ts-ignore
        publicActions[action](client, {
          ...args,
          ...(cache === "immutable"
            ? { blockTag: "latest" }
            : { blockNumber: userBlockNumber ?? contextState.blockNumber }),
        } as Parameters<ReturnType<typeof publicActions>[action]>[0]);
    };

    for (const action of blockDependentActions) {
      addAction(action);
    }

    addAction("multicall");
    addAction("readContract");
    addAction("simulateContract");

    for (const action of nonBlockDependentActions) {
      // @ts-ignore
      actions[action] = _publicActions[action];
    }

    return actions;
  };
};

export const buildDb = ({
  common,
  schema,
  indexingStore,
  contextState,
}: Pick<Parameters<typeof create>[0], "common" | "schema" | "indexingStore"> & {
  contextState: Pick<
    Service["currentEvent"]["contextState"],
    "encodedCheckpoint"
  >;
}) => {
  return Object.keys(getTables(schema)).reduce<
    Service["currentEvent"]["context"]["db"]
  >((acc, tableName) => {
    acc[tableName] = {
      findUnique: async ({ id }) => {
        common.logger.trace({
          service: "store",
          msg: `${tableName}.findUnique(id=${id})`,
        });
        return indexingStore.findUnique({
          tableName,
          id,
        });
      },
      findMany: async ({ where, orderBy, limit, before, after } = {}) => {
        common.logger.trace({
          service: "store",
          msg: `${tableName}.findMany`,
        });
        return indexingStore.findMany({
          tableName,
          where,
          orderBy,
          limit,
          before,
          after,
        });
      },
      create: async ({ id, data }) => {
        common.logger.trace({
          service: "store",
          msg: `${tableName}.create(id=${id})`,
        });
        return indexingStore.create({
          tableName,
          encodedCheckpoint: contextState.encodedCheckpoint,
          id,
          data,
        });
      },
      createMany: async ({ data }) => {
        common.logger.trace({
          service: "store",
          msg: `${tableName}.createMany(count=${data.length})`,
        });
        return indexingStore.createMany({
          tableName,
          encodedCheckpoint: contextState.encodedCheckpoint,
          data,
        });
      },
      update: async ({ id, data }) => {
        common.logger.trace({
          service: "store",
          msg: `${tableName}.update(id=${id})`,
        });
        return indexingStore.update({
          tableName,
          encodedCheckpoint: contextState.encodedCheckpoint,
          id,
          data,
        });
      },
      updateMany: async ({ where, data }) => {
        common.logger.trace({
          service: "store",
          msg: `${tableName}.updateMany`,
        });
        return indexingStore.updateMany({
          tableName,
          encodedCheckpoint: contextState.encodedCheckpoint,
          where,
          data,
        });
      },
      upsert: async ({ id, create, update }) => {
        common.logger.trace({
          service: "store",
          msg: `${tableName}.upsert(id=${id})`,
        });
        return indexingStore.upsert({
          tableName,
          encodedCheckpoint: contextState.encodedCheckpoint,
          id,
          create,
          update,
        });
      },
      delete: async ({ id }) => {
        common.logger.trace({
          service: "store",
          msg: `${tableName}.delete(id=${id})`,
        });
        return indexingStore.delete({
          tableName,
          encodedCheckpoint: contextState.encodedCheckpoint,
          id,
        });
      },
    };
    return acc;
  }, {});
};
