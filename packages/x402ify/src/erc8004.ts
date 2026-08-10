import { createWalletClient, createPublicClient, http, defineChain, decodeEventLog } from "viem";
import { celo } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import { getNetwork } from "@omni402/config";

/**
 * ERC-8004 agent identity registration on Celo — the trust layer that sits on
 * top of Omni402's payment layer. Registering mints an ERC-721 that is your
 * agent's portable, on-chain identity (browsable, queryable, reputation-ready).
 *
 * Verified against erc-8004/erc-8004-contracts (IdentityRegistryUpgradeable):
 *   function register(string agentURI) returns (uint256 agentId)
 *   event    Registered(uint256 indexed agentId, string agentURI, address indexed owner)
 *
 * We never hold your key: the owner wallet signs the mint. Reused as a feature
 * so any Omni402 operator can give their agent an on-chain identity.
 */
const IDENTITY_REGISTRY: Record<string, `0x${string}`> = {
  celo: "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432",
  "celo-sepolia": "0x8004A818BFB912233c491871b3d84c89A494BD9e",
};

const ABI = [
  {
    type: "function",
    name: "register",
    stateMutability: "nonpayable",
    inputs: [{ name: "agentURI", type: "string" }],
    outputs: [{ name: "agentId", type: "uint256" }],
  },
  {
    type: "event",
    name: "Registered",
    inputs: [
      { name: "agentId", type: "uint256", indexed: true },
      { name: "agentURI", type: "string", indexed: false },
      { name: "owner", type: "address", indexed: true },
    ],
  },
] as const;

export interface RegisterResult {
  agentId: string;
  txHash: string;
  explorerUrl: string;
  scanUrl: string;
  owner: `0x${string}`;
}

export async function registerAgent(opts: {
  /** Private key of the wallet that will OWN the agent NFT (needs a little CELO). */
  privateKey: string;
  /** Public URL of the agent registration JSON (the agentURI). */
  agentURI: string;
  network?: string;
}): Promise<RegisterResult> {
  const network = getNetwork(opts.network || process.env.X402_NETWORK || "celo");
  const registry = IDENTITY_REGISTRY[network.key];
  if (!registry) throw new Error(`No ERC-8004 Identity Registry configured for ${network.key}.`);

  const pk = (opts.privateKey.startsWith("0x") ? opts.privateKey : `0x${opts.privateKey}`) as `0x${string}`;
  const account = privateKeyToAccount(pk);

  const chain =
    network.key === "celo"
      ? celo
      : defineChain({
          id: network.chainId,
          name: network.name,
          nativeCurrency: { name: "CELO", symbol: "CELO", decimals: 18 },
          rpcUrls: { default: { http: [network.rpcUrl] } },
          blockExplorers: { default: { name: "Explorer", url: network.explorer } },
        });

  const wallet = createWalletClient({ account, chain, transport: http(network.rpcUrl) });
  const pub = createPublicClient({ chain, transport: http(network.rpcUrl) });

  const txHash = await wallet.writeContract({
    address: registry,
    abi: ABI,
    functionName: "register",
    args: [opts.agentURI],
  });
  const receipt = await pub.waitForTransactionReceipt({ hash: txHash });

  let agentId = "";
  for (const log of receipt.logs) {
    if (log.address.toLowerCase() !== registry.toLowerCase()) continue;
    try {
      const ev = decodeEventLog({ abi: ABI, data: log.data, topics: log.topics });
      if (ev.eventName === "Registered") {
        agentId = (ev.args as { agentId: bigint }).agentId.toString();
        break;
      }
    } catch {
      /* not our event */
    }
  }

  return {
    agentId,
    txHash,
    explorerUrl: `${network.explorer}/tx/${txHash}`,
    scanUrl: `https://8004scan.io/agents/celo/${agentId}`,
    owner: account.address,
  };
}
