/**
 * Smoke test: spawn the MCP server over stdio, list its tools, and call
 * list_paid_apis — a real MCP protocol roundtrip. No wallet/funds needed
 * (discovery is free). Run: node --import tsx test/mcp.smoke.ts
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const serverEntry = path.resolve(__dirname, "../src/server.ts");

let failures = 0;
const check = (c: boolean, label: string) => {
  console.log(`  ${c ? "✓" : "✗"} ${label}`);
  if (!c) failures++;
};

const transport = new StdioClientTransport({
  command: "node",
  args: ["--import", "tsx", serverEntry],
  env: {
    ...process.env,
    X402_NETWORK: "celo-sepolia",
    PUBLIC_BASE: "http://localhost:4021",
  } as Record<string, string>,
});

const client = new Client({ name: "smoke-agent", version: "0.0.1" });

try {
  await client.connect(transport);

  const tools = await client.listTools();
  const names = tools.tools.map((t) => t.name);
  console.log(`  tools: ${names.join(", ")}`);
  check(names.includes("list_paid_apis"), "exposes list_paid_apis");
  check(names.includes("paid_fetch"), "exposes paid_fetch");

  const res = await client.callTool({ name: "list_paid_apis", arguments: {} });
  const text =
    Array.isArray(res.content) && res.content[0]?.type === "text" ? res.content[0].text : "";
  console.log(`\n  --- list_paid_apis returned ---\n${text}\n`);
  check(/Celo Token Prices/.test(text), "catalog includes the Celo Token Prices lane");
  check(/USDC\/call/.test(text), "shows a per-call USDC price");
  check(
    /http:\/\/localhost:4021\/pay\/celo-token-prices/.test(text),
    "shows the public /pay/<slug> URL",
  );
} finally {
  await client.close();
}

console.log(failures === 0 ? "MCP SERVER OK" : `\n${failures} FAILED`);
process.exit(failures === 0 ? 0 : 1);
