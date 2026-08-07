import { runCompiledBinaryEntrypoint } from "./runtime/binary-launcher"

await runCompiledBinaryEntrypoint(() => import("./overlay-server.ts"))
