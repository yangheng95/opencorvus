#!/usr/bin/env bun
// Recomputes panel_revision and patches both i18n JSON files in-place.
import { createHash } from "node:crypto"
import * as path from "node:path"
import { readdirSync } from "node:fs"

const dir = path.resolve(import.meta.dir, "..")

const panel = readdirSync(path.join(dir, "src"))
  .filter((f) => /\.(?:html|js)$/.test(f))
  .map((f) => path.join(dir, "src", f))
  .sort()

function relPosix(file: string) {
  return path.relative(dir, file).replaceAll("\\", "/")
}

const panelText = await Promise.all(panel.map((f) => Bun.file(f).text()))
const revision = createHash("sha256")
  .update(panel.map((f, i) => `${relPosix(f)}\n${panelText[i]}`).join("\n\n"))
  .digest("hex")
  .slice(0, 16)

const i18nDir = path.join(dir, "src", "i18n")
for (const locale of ["en-US.json", "zh-CN.json"]) {
  const file = path.join(i18nDir, locale)
  const data = JSON.parse(await Bun.file(file).text())
  data._meta.panel_revision = revision
  await Bun.write(file, JSON.stringify(data, null, 2) + "\n")
  console.log(`Updated ${locale} → panel_revision: ${revision}`)
}
