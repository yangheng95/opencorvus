import { applyBundledEnv } from "../../src/bundled-env"

const result = await applyBundledEnv()
process.stdout.write(JSON.stringify(result))
