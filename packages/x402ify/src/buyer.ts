import { privateKeyToAccount } from "viem/accounts";
import { Mppx } from "mppx/client";
import { evm } from "mppx/evm/client";
import {
  getNetwork,
  getAsset,
  explorerTx,
  type NetworkConfig,
} from "@omni402/config";

/**
 * The buyer/agent side of MPP. `createBuyer` registers an EVM charge method
 * with a funded wallet, which patches global `fetch` so any MPP-gated endpoint
 * is paid automatically: the client answers the 402 by signing an EIP-3009
 * credential and retrying. The buyer needs USDC and NO native gas — the
 * facilitator sponsors settlement.
 *
 * This is what makes an AI agent a paying customer: no account, no API key,
 * just a wallet.
 */
export interface BuyerOptions {
  /** Buyer wallet private key (0x…). Read from BUYER_PRIVATE_KEY by the CLI. */
  privateKey: string;
  network?: string;
  asset?: string;
  /** Never pay more than this per request (safety cap). Default "1". */
  maxAmount?: string;
}

export interface PayResult {
  status: number;
  ok: boolean;
  body: unknown;
  paid: boolean;
  /** settlement tx hash, when the response carried an MPP receipt */
  reference?: string;
  explorerUrl?: string;
  receipt?: unknown;
}

export interface Buyer {
  account: `0x${string}`;
  network: NetworkConfig;
  pay(url: string, init?: RequestInit): Promise<PayResult>;
}

export function createBuyer(opts: BuyerOptions): Buyer {
  const network = getNetwork(opts.network || process.env.X402_NETWORK || "celo-sepolia");
  const asset = getAsset(network, opts.asset);
  const pk = (
    opts.privateKey.startsWith("0x") ? opts.privateKey : `0x${opts.privateKey}`
  ) as `0x${string}`;
  const account = privateKeyToAccount(pk);

  // Patches global fetch to transparently answer MPP challenges.
  Mppx.create({
    methods: [
      evm.charge({
        account,
        networks: [network.chainId],
        currencies: [asset.address],
        decimals: asset.decimals,
        authorization: asset.eip712,
        maxAmount: opts.maxAmount || "1",
      }),
    ],
  });

  return {
    account: account.address,
    network,
    async pay(url: string, init?: RequestInit): Promise<PayResult> {
      const res = await fetch(url, init);
      const text = await res.text();
      let body: unknown = text;
      try {
        body = JSON.parse(text);
      } catch {
        /* leave as text */
      }
      const result: PayResult = { status: res.status, ok: res.ok, body, paid: false };

      const hdr = res.headers.get("payment-receipt");
      if (hdr) {
        result.paid = true;
        try {
          const receipt = JSON.parse(Buffer.from(hdr, "base64url").toString("utf8"));
          result.receipt = receipt;
          const ref = (receipt as { reference?: unknown }).reference;
          if (typeof ref === "string" && /^0x[a-fA-F0-9]{64}$/.test(ref)) {
            result.reference = ref;
            result.explorerUrl = explorerTx(network, ref);
          }
        } catch {
          /* keep raw header only */
        }
      }
      return result;
    },
  };
}
