import { HttpRequestError, numberToHex } from "viem";
import { expect, test } from "vitest";
import { getLogsRetryHelper } from "../getLogsRetryHelper.js";
import type { Params } from "./utils.js";

const fromBlock = 54750959n;
const toBlock = 54800958n;
const maxBlockRange = 10_000n;

test("erpc block range", async () => {
  const params: Params = [
    {
      fromBlock: numberToHex(fromBlock),
      toBlock: numberToHex(toBlock),
      topics: [
        "0x3910bed511b4ecc0d6ae24498d585722a54c6ce9ab5e65b4be534cec981f7f6f",
      ],
      address: "0x24825b3c44742600d3995d1d3760ccee999a7f0b",
    },
  ];

  const error = new HttpRequestError({
    url: "http://localhost:4000/main/evm/137",
    details: JSON.stringify({
      code: -32602,
      message: "Invalid params",
      data: {
        range:
          "the range 54750959 - 54800958 exceeds the range allowed for your plan (49999 > 2000).",
      },
    }),
  });

  const retry = getLogsRetryHelper({ params, error });

  expect(retry).toStrictEqual({
    shouldRetry: true,
    ranges: [
      {
        fromBlock: numberToHex(fromBlock),
        toBlock: numberToHex(fromBlock + maxBlockRange),
      },
      {
        fromBlock: numberToHex(fromBlock + maxBlockRange + 1n),
        toBlock: numberToHex(fromBlock + maxBlockRange + 1n),
      },
    ],
  });
});
