import type { PaymentRequirements, VerifyResult, SettleResult } from "./types.js";

/**
 * Thin HTTP client for a Celo x402 facilitator (default: https://x402.celo.org).
 *
 * The facilitator does two things and never custodies funds:
 *   POST /verify  — check the buyer's signed EIP-3009 authorization off-chain
 *   POST /settle  — submit transferWithAuthorization on-chain (facilitator pays gas)
 *
 * ┌──────────────────────────────────────────────────────────────────────┐
 * │ WIRE FORMAT — VERIFY AGAINST A LIVE PAYMENT BEFORE PRODUCTION.         │
 * │ The request/response JSON below follows the x402 "exact" scheme as     │
 * │ documented, but the Celo facilitator's exact envelope should be        │
 * │ confirmed with one real testnet settlement (or the reference example). │
 * │ Everything that touches money is isolated in THIS file on purpose.     │
 * └──────────────────────────────────────────────────────────────────────┘
 */
export class CeloFacilitator {
  constructor(
    private readonly baseUrl: string,
    private readonly x402Version = 1,
  ) {}

  private endpoint(path: string): string {
    return `${this.baseUrl.replace(/\/$/, "")}/${path}`;
  }

  private async post<T>(path: string, body: unknown): Promise<T> {
    const res = await fetch(this.endpoint(path), {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(body),
    });
    const text = await res.text();
    if (!res.ok) {
      throw new Error(`facilitator /${path} → ${res.status}: ${text.slice(0, 300)}`);
    }
    try {
      return JSON.parse(text) as T;
    } catch {
      throw new Error(`facilitator /${path} returned non-JSON: ${text.slice(0, 200)}`);
    }
  }

  /** Off-chain validation of the buyer's signed payment payload. */
  verify(
    paymentPayload: unknown,
    paymentRequirements: PaymentRequirements,
  ): Promise<VerifyResult> {
    return this.post<VerifyResult>("verify", {
      x402Version: this.x402Version,
      paymentPayload,
      paymentRequirements,
    });
  }

  /** On-chain settlement; returns the Celo transaction hash on success. */
  settle(
    paymentPayload: unknown,
    paymentRequirements: PaymentRequirements,
  ): Promise<SettleResult> {
    return this.post<SettleResult>("settle", {
      x402Version: this.x402Version,
      paymentPayload,
      paymentRequirements,
    });
  }

  /** GET /supported — which (scheme, network, asset) tuples this facilitator settles. */
  async supported(): Promise<unknown> {
    const res = await fetch(this.endpoint("supported"), {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) throw new Error(`facilitator /supported → ${res.status}`);
    return res.json();
  }
}
