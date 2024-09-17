import {
  type PromiseWithResolvers,
  promiseWithResolvers,
} from "@ponder/common";
import {
  type EIP1193Parameters,
  type EIP1193RequestFn,
  type PublicRpcSchema,
  type Transport,
  type TransportConfig,
  createTransport,
} from "viem";

// TODO(kyle) retry errors without timeout

type RequestReturnType<
  method extends EIP1193Parameters<PublicRpcSchema>["method"],
> = Extract<PublicRpcSchema[number], { Method: method }>["ReturnType"];

export type Request = <TParameters extends EIP1193Parameters<PublicRpcSchema>>(
  parameters: TParameters,
) => Promise<RequestReturnType<TParameters["method"]>>;

/** 50ms */
const BUCKET_SIZE = 50;
/** 5min */
const MAX_WINDOW = (1_000 / BUCKET_SIZE) * 5 * 60;
const _429_INTERVAL = 200;
const DEFAULT_RPS = 10;

type Super = {
  estimatedRPS: number;
  confirmedRPS: number | undefined;
  unsupportedMethods: Set<string>;
  is429: boolean;
  lastRequest: number;
  pendingRequests: number;
  requests: {
    timestamp: number;
    response: number;
    count: number;
    errors: number;
  }[];
};

const getTimestampBucket = () => {
  const now = Date.now();
  return Math.floor(now / BUCKET_SIZE) * BUCKET_SIZE;
};

const isAvailable = (s: Super, method: string): boolean => {
  if (s.unsupportedMethods.has(method)) return false;

  const now = Date.now();

  if (s.is429 && now - s.lastRequest < _429_INTERVAL) {
    return false;
  }

  if (s.requests.length === 0 && s.pendingRequests >= 5) return false;

  // get all requests for last second
  let count = 0;
  for (const { count: _count, timestamp } of s.requests) {
    if (timestamp > now - 1_000) {
      count += _count;
    }
  }

  if (count + s.pendingRequests >= (s.confirmedRPS ?? s.estimatedRPS)) {
    return false;
  }

  return true;
};

const expectedLatency = (s: Super): number => {
  if (s.requests.length === 0) return 100;

  let response = 0;
  let count = 0;
  let errors = 0;

  for (const r of s.requests) {
    response += r.response;
    count += r.count;
    errors += r.errors;
  }
  return response / (count * 1 - errors / count) + 1;
};

const request = async (
  body: EIP1193Parameters,
  transport: { request: EIP1193RequestFn },
  s: Super,
) => {
  const start = Date.now();
  const bucket = getTimestampBucket();

  // add 1 ms lag
  if (start - s.lastRequest < 1) {
    await new Promise((res) => setTimeout(res, 1));
  }

  s.lastRequest = start;
  s.pendingRequests++;

  try {
    const response = await transport.request(body);

    if (s.is429) {
      s.is429 = false;
    }

    if (s.requests[s.requests.length - 1]?.timestamp === bucket) {
      s.requests[s.requests.length - 1]!.response += Date.now() - start;
      s.requests[s.requests.length - 1]!.count++;
    } else {
      if (s.requests.length >= MAX_WINDOW) s.requests.shift();

      // updated `estimatedRPS` by 2% every second
      if (bucket % 1_000 === 0) {
        s.estimatedRPS *= 1.02;
      }

      s.requests.push({
        timestamp: bucket,
        response: Date.now() - start,
        count: 1,
        errors: 0,
      });
    }

    return response;
  } catch (error) {
    // @ts-ignore
    if (error.code === 429 || error.status === 429) {
      s.is429 = true;

      s.confirmedRPS = s.estimatedRPS * 0.95;
    }

    if (s.requests[s.requests.length - 1]?.timestamp === bucket) {
      s.requests[s.requests.length - 1]!.response += Date.now() - start;
      s.requests[s.requests.length - 1]!.count++;
      s.requests[s.requests.length - 1]!.errors++;
    } else {
      if (s.requests.length >= MAX_WINDOW) s.requests.shift();

      s.requests.push({
        timestamp: bucket,
        response: Date.now() - start,
        count: 1,
        errors: 1,
      });
    }

    throw error;
  } finally {
    s.pendingRequests--;
  }
};

// const formatMetrics = (transport: ReturnType<Transport>, s: Super) => {
//   let response = 0;
//   let count = 0;
//   let errors = 0;

//   let duration = 50;

//   if (s.requests.length >= 2) {
//     const from = s.requests[0]!.timestamp;
//     const to = s.requests[s.requests.length - 1]!.timestamp;

//     duration = (to - from) / 1_000;
//   }

//   for (const r of s.requests) {
//     response += r.response;
//     count += r.count;
//     errors += r.errors;
//   }

//   return {
//     // @ts-ignore
//     url: transport.value?.url,
//     count,
//     "requests per second": (count - errors) / duration,
//     "error rate": errors / count,
//     latency: response / (count * 1 - errors / count),
//     pending: s.pendingRequests,
//   };
// };

export const superPonder = (_transports: Transport[]): Transport => {
  return ({ chain, retryCount, timeout }) => {
    const q: [EIP1193Parameters, PromiseWithResolvers<unknown>][] = [];

    const dispatch = () => {
      if (q.length === 0) return;

      let minLatency = Number.POSITIVE_INFINITY;
      let index: number | undefined;
      for (let i = 0; i < supers.length; i++) {
        const s = supers[i]!;
        if (
          isAvailable(s, q[0]![0].method) &&
          expectedLatency(s) < minLatency
        ) {
          minLatency = expectedLatency(s);
          index = i;
        }
      }

      if (index === undefined) {
        new Promise((res) => setTimeout(res, 1)).then(dispatch);
      } else {
        const [body, { reject, resolve }] = q.shift()!;
        request(body, transports[index]!, supers[index]!)
          .then(resolve)
          .catch(reject);
      }
    };

    const transports = _transports.map((t) => t({ chain, retryCount: 0 }));

    const supers: Super[] = new Array(transports.length);
    for (let i = 0; i < supers.length; i++) {
      supers[i] = {
        estimatedRPS: DEFAULT_RPS,
        confirmedRPS: undefined,
        unsupportedMethods: new Set(),
        is429: false,
        lastRequest: 0,
        pendingRequests: 0,
        requests: [],
      };
    }

    // setInterval(() => {
    //   console.log(transports.map((t, i) => formatMetrics(t, supers[i]!)));
    // }, 5000);

    return createTransport({
      key: "super",
      name: "Super",
      request: async (body) => {
        const p = promiseWithResolvers();
        q.push([body, p]);
        dispatch();
        return p.promise;
      },
      retryCount,
      timeout,
      type: "super",
    } as TransportConfig);
  };
};
