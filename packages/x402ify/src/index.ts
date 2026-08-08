/**
 * @glasscelo/x402ify — public API.
 *
 * `wrap()` turns any HTTP API into an x402 pay-per-call endpoint settled on
 * Celo. The upstream key never leaves this process: the gateway injects it
 * only AFTER a payment is verified by the Celo facilitator.
 */
export { wrap, type WrapOptions, type Gateway } from "./wrap.js";
export { CeloFacilitator } from "./facilitator.js";
export type {
  PaymentRequirements,
  VerifyResult,
  SettleResult,
  GatewayEvent,
} from "./types.js";
