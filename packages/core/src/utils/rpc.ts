import type { Request } from "@/sync/request.js";
import type {
  SyncBlock,
  SyncLog,
  SyncTrace,
  SyncTransactionReceipt,
} from "@/types/sync.js";
import { toLowerCase } from "@/utils/lowercase.js";
import {
  type Address,
  BlockNotFoundError,
  type Hash,
  type Hex,
  type LogTopic,
  TransactionReceiptNotFoundError,
  numberToHex,
} from "viem";

/**
 * Helper function for "eth_getBlockByNumber" request.
 */
export const _eth_getBlockByNumber = (
  request: Request,
  {
    blockNumber,
    blockTag,
  }:
    | { blockNumber: Hex | number; blockTag?: never }
    | { blockNumber?: never; blockTag: "latest" },
): Promise<SyncBlock> =>
  request({
    method: "eth_getBlockByNumber",
    params: [
      typeof blockNumber === "number"
        ? numberToHex(blockNumber)
        : blockNumber ?? blockTag,
      true,
    ],
  }).then((_block) => {
    if (!_block)
      throw new BlockNotFoundError({
        blockNumber: (blockNumber ?? blockTag) as any,
      });
    return _block as SyncBlock;
  });

/**
 * Helper function for "eth_getBlockByNumber" request.
 */
export const _eth_getBlockByHash = (
  request: Request,
  { hash }: { hash: Hex },
): Promise<SyncBlock> =>
  request({
    method: "eth_getBlockByHash",
    params: [hash, true],
  }).then((_block) => {
    if (!_block)
      throw new BlockNotFoundError({
        blockHash: hash,
      });
    return _block as SyncBlock;
  });

/**
 * Helper function for "eth_getLogs" rpc request.
 * Handles different error types and retries the request if applicable.
 */
export const _eth_getLogs = async (
  request: Request,
  params: {
    address?: Address | Address[];
    topics?: LogTopic[];
  } & (
    | { fromBlock: Hex | number; toBlock: Hex | number }
    | { blockHash: Hash }
  ),
): Promise<SyncLog[]> => {
  if ("blockHash" in params) {
    return request({
      method: "eth_getLogs",
      params: [
        {
          blockHash: params.blockHash,

          topics: params.topics,
          address: params.address
            ? Array.isArray(params.address)
              ? params.address.map((a) => toLowerCase(a))
              : toLowerCase(params.address)
            : undefined,
        },
      ],
    }).then((l) => l as SyncLog[]);
  }

  return request({
    method: "eth_getLogs",
    params: [
      {
        fromBlock:
          typeof params.fromBlock === "number"
            ? numberToHex(params.fromBlock)
            : params.fromBlock,
        toBlock:
          typeof params.toBlock === "number"
            ? numberToHex(params.toBlock)
            : params.toBlock,

        topics: params.topics,
        address: params.address
          ? Array.isArray(params.address)
            ? params.address.map((a) => toLowerCase(a))
            : toLowerCase(params.address)
          : undefined,
      },
    ],
  }).then((l) => l as SyncLog[]);
};

/**
 * Helper function for "eth_getTransactionReceipt" request.
 */
export const _eth_getTransactionReceipt = (
  request: Request,
  { hash }: { hash: Hex },
): Promise<SyncTransactionReceipt> =>
  request({
    method: "eth_getTransactionReceipt",
    params: [hash],
  }).then((receipt) => {
    if (!receipt)
      throw new TransactionReceiptNotFoundError({
        hash,
      });
    return receipt as SyncTransactionReceipt;
  });

/**
 * Helper function for "trace_filter" request.
 *
 * Note: No strict typing is available.
 */
export const _trace_filter = (
  request: Request,
  params: {
    fromBlock: Hex | number;
    toBlock: Hex | number;
    fromAddress?: Address[];
    toAddress?: Address[];
  },
): Promise<SyncTrace[]> =>
  request({
    method: "trace_filter",
    params: [
      {
        fromBlock:
          typeof params.fromBlock === "number"
            ? numberToHex(params.fromBlock)
            : params.fromBlock,
        toBlock:
          typeof params.toBlock === "number"
            ? numberToHex(params.toBlock)
            : params.toBlock,
        fromAddress: params.fromAddress
          ? params.fromAddress.map((a) => toLowerCase(a))
          : undefined,
        toAddress: params.toAddress
          ? params.toAddress.map((a) => toLowerCase(a))
          : undefined,
      },
    ],
  } as any).then((traces) => traces as unknown as SyncTrace[]);

/**
 * Helper function for "trace_block" request.
 */
export const _trace_block = (
  request: Request,
  params: {
    blockNumber: Hex | number;
  },
): Promise<SyncTrace[]> =>
  request({
    method: "trace_block",
    params: [
      typeof params.blockNumber === "number"
        ? numberToHex(params.blockNumber)
        : params.blockNumber,
    ],
  } as any).then((traces) => traces as unknown as SyncTrace[]);
