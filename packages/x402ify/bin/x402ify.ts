#!/usr/bin/env node
import { main } from "../src/cli.js";

main(process.argv.slice(2)).catch((err) => {
  console.error(`\n  ✗ ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
