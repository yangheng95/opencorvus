import { readFile } from "node:fs/promises"
import { fileURLToPath } from "node:url"
import path from "node:path"
import sharp from "sharp"

const root = path.dirname(fileURLToPath(import.meta.url))
const assetDir = path.join(root, "assets", "promo-redraw")

const jobs = [
  {
    template: "architecture-promo-v1.svg",
    background: "architecture-plate-v1.png",
    output: "architecture-promo-v1.png",
  },
  {
    template: "lifecycle-promo-v1.svg",
    background: "lifecycle-plate-v2.png",
    output: "lifecycle-promo-v1.png",
  },
  {
    template: "brand-opener-v1.svg",
    background: "architecture-plate-v1.png",
    logo: path.resolve(root, "../../../packages/overlay/src/opencorvus-logo-dark.svg"),
    output: "brand-opener-v1.png",
  },
  {
    template: "brand-outro-v1.svg",
    background: "lifecycle-plate-v2.png",
    logo: path.resolve(root, "../../../packages/overlay/src/opencorvus-logo-dark.svg"),
    output: "brand-outro-v1.png",
  },
]

for (const job of jobs) {
  const [template, background, logo] = await Promise.all([
    readFile(path.join(assetDir, job.template), "utf8"),
    readFile(path.join(assetDir, job.background)),
    job.logo ? readFile(job.logo) : undefined,
  ])
  let svg = template.replace(
    "__BACKGROUND__",
    `data:image/png;base64,${background.toString("base64")}`,
  )
  if (logo) {
    svg = svg.replace("__LOGO__", `data:image/svg+xml;base64,${logo.toString("base64")}`)
  }
  await sharp(Buffer.from(svg))
    .png({ compressionLevel: 9 })
    .toFile(path.join(assetDir, job.output))
  console.log(job.output)
}
