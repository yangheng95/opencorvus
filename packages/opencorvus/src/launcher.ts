import { runCompiledBinaryEntrypoint } from "./runtime/binary-launcher"

await runCompiledBinaryEntrypoint(() => import("./index.ts"))
