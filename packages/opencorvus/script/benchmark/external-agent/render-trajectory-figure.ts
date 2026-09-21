import fs from "node:fs/promises"
import path from "node:path"
import sharp from "sharp"
import { renderTrajectorySVG, type TokenBreakdown, type TrajectoryEvent } from "./contract"

const values = new Map<string, string>()
for (let index = 2; index < process.argv.length; index += 2) {
  const key = process.argv[index]
  const value = process.argv[index + 1]
  if (!key?.startsWith("--") || value === undefined) {
    throw new Error("Expected --result file --trajectory file --output file [--png file] [--title text]")
  }
  values.set(key.slice(2), value)
}
const resultPath = values.get("result")
const trajectoryPath = values.get("trajectory")
const outputPath = values.get("output")
if (!resultPath || !trajectoryPath || !outputPath) {
  throw new Error("--result, --trajectory, and --output are required")
}
const result = JSON.parse(await fs.readFile(path.resolve(resultPath), "utf8")) as {
  run: { duration_ms: number }
  benchmark: { task: string; tool_calls?: number }
  opencorvus: { profile: string; tokens: TokenBreakdown & { modelCalls?: number } }
}
const events = JSON.parse(await fs.readFile(path.resolve(trajectoryPath), "utf8")) as TrajectoryEvent[]
const title = values.get("title") ?? `AutomationBench ${result.benchmark.task} · ${result.opencorvus.profile}`
const output = path.resolve(outputPath)
await fs.mkdir(path.dirname(output), { recursive: true })
await fs.writeFile(
  output,
  renderTrajectorySVG({
    title,
    events,
    tokens: result.opencorvus.tokens,
    runDurationMs: result.run.duration_ms,
    modelCalls: result.opencorvus.tokens.modelCalls,
    toolCalls: result.benchmark.tool_calls,
  }),
  "utf8",
)
const png = values.get("png")
if (png) {
  const pngPath = path.resolve(png)
  await fs.mkdir(path.dirname(pngPath), { recursive: true })
  await sharp(output, { density: 150 }).png().toFile(pngPath)
}
process.stdout.write(JSON.stringify({ output, png: png ? path.resolve(png) : null, events: events.length }) + "\n")
