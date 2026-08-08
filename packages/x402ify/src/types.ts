/**
 * x402 wire types (the "exact" EIP-3009 scheme), plus our internal events.
 *
 * PaymentRequirements is what the gateway returns in a 402 body so the buyer's
 * wallet knows what to sign. Field names follow the x402 spec's `exact` scheme.
 */
export interface PaymentRequirements {
  scheme: "exact";
  /** CAIP-2 network id, e.g. "eip155:42220" (Celo mainnet). */
  network: string;
  /** Price in the token's atomic base units (e.g. "10000" = 0.01 USDC). */
  maxAmountRequired: string;
  /** The URL being paid for. */
  resource: string;
  description: string;
  mimeType: string;
  /** Seller payout address. */
  payTo: string;
  maxTimeoutSeconds: number;
  /** ERC-20 token contract address. */
  asset: string;
  /** EIP-712 domain of the token, needed to build the transferWithAuthorization signature. */
  extra: { name: string; version: string };
}

export interface VerifyResult {
  isValid: boolean;
  invalidReason?: string;
  payer?: string;
}

export interface SettleResult {
  success: boolean;
  /** Settlement transaction hash on Celo. */
  transaction?: string;
  network?: string;
  payer?: string;
  errorReason?: string;
}

/** Emitted by the gateway for the hub/dashboard to render. */
export interface GatewayEvent {
  type: "register" | "request" | "payment" | "error";
  ts: number;
  api: string;
  method?: string;
  path?: string;
  status?: number;
  /** atomic base units */
  amount?: string;
  assetSymbol?: string;
  network?: string;
  payer?: string;
  txHash?: string;
  explorerUrl?: string;
  error?: string;
  /** register-only: the wrapped upstream + human price, for the dashboard. */
  upstream?: string;
  price?: string;
}
