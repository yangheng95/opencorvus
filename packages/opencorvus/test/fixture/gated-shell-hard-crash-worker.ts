import { ProcessSupervisor } from "@/shell/process-supervisor"
import { Shell } from "@/shell/shell"

const effectFile = process.argv[2]
if (!effectFile) throw new Error("Gated shell hard-crash worker requires an effect-file path")

const encodedEffectFile = Buffer.from(effectFile, "utf8").toString("base64")
await ProcessSupervisor.spawnHostShellGated(
  {
    command:
      `${JSON.stringify(process.execPath)} -e ` +
      `"require('node:fs').writeFileSync(Buffer.from('${encodedEffectFile}','base64').toString(),'ran')"`,
    shell: Shell.preferred(),
    cwd: process.cwd(),
    owner: "test:gated-shell-hard-crash",
  },
  async () => {
    process.exit(86)
  },
)

throw new Error("Gated shell admission unexpectedly survived the hard crash cut")
