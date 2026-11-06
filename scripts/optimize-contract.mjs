import binaryen from "binaryen";
import { readFile, writeFile, mkdir } from "node:fs/promises";
const input =
  process.argv[2] ||
  "contracts/orby-market/target/wasm32-unknown-unknown/release/orby_market.wasm";
const bytes = await readFile(input);
const module = binaryen.readBinary(bytes);
module.setFeatures(
  binaryen.Features.All &
    ~binaryen.Features.Memory64 &
    ~binaryen.Features.MultiMemory,
);
module.runPasses([
  "signext-lowering",
  "llvm-nontrapping-fptoint-lowering",
  "llvm-memory-copy-fill-lowering",
]);
module.setFeatures(binaryen.Features.MVP);
binaryen.setOptimizeLevel(3);
binaryen.setShrinkLevel(2);
module.optimize();
module.runPasses(["strip-debug", "strip-producers"]);
if (!module.validate()) throw Error("Optimized contract failed validation.");
await mkdir(".data/near", { recursive: true });
const result = module.emitBinary();
await writeFile(process.argv[3] || ".data/near/orby_market.wasm", result);
module.dispose();
console.log("WASM optimized:", bytes.length, "→", result.length, "bytes");
