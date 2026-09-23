import path from "node:path"

export type OverlayBuildRow = { runner: string; platform: string }

export async function selectOverlayBuildMatrix(selection: string): Promise<OverlayBuildRow[]> {
  const file = path.resolve(import.meta.dir, "../.github/workflows/build.yml")
  const workflow = Bun.YAML.parse(await Bun.file(file).text()) as {
    jobs: { "package-overlay": { strategy: { matrix: { include: OverlayBuildRow[] } } } }
  }
  const rows = workflow.jobs["package-overlay"].strategy.matrix.include
  const selected = rows.filter(
    (row) =>
      selection === "all" || (selection === "linux" ? row.platform.startsWith("linux-") : row.platform === selection),
  )
  if (selected.length === 0) throw new Error(`Unknown overlay build platform: ${selection}`)
  return selected
}

if (import.meta.main) {
  console.log(
    `matrix=${JSON.stringify({ include: await selectOverlayBuildMatrix(process.env.OVERLAY_BUILD_PLATFORM ?? "all") })}`,
  )
}
