import path from "node:path"
import fs from "node:fs/promises"
import { Config } from "@/config/config"

const [directory, output] = process.argv.slice(2)
if (!directory || !output || !path.isAbsolute(directory) || !path.isAbsolute(output)) {
  throw new Error("Config source reader requires owned absolute directory and output paths")
}
const config = await Config.snapshotForProject(directory)
await fs.writeFile(
  output,
  JSON.stringify({
    username: config.username,
    mode: config.permission_mode,
    tailTurns: config.compaction?.tail_turns,
    globalResource: config.command?.global_resource?.template,
  }),
  { flag: "wx" },
)
