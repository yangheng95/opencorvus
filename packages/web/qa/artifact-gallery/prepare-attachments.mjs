/**
 * Put the real bytes the attachment-backed renderers need into the project's Attachment Store.
 *
 * The Host re-reads these bytes on publish and compares sha/size against whatever the model wrote,
 * so the driver hands the model the reference this script returns rather than asking it to describe
 * a file it cannot hash.
 */
import fs from "node:fs/promises"
import path from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"

const here = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(here, "../../../..")

const BASE = process.env.GALLERY_BASE ?? "http://127.0.0.1:7893"
const DIRECTORY = process.env.GALLERY_DIRECTORY ?? path.join(repoRoot, "tmp/gallery-workspace")
const CACHE = path.join(repoRoot, "tmp", "gallery-attachments")

/** Real, citable sources: two shipped repository images, one IETF PDF, one Khronos sample model. */
const sources = [
  { filename: "agent-teams-workflow.png", mime: "image/png", from: path.join(repoRoot, "assets/agent-teams-workflow.png") },
  { filename: "readme-head.png", mime: "image/png", from: path.join(repoRoot, "assets/readme-head.png") },
  { filename: "rfc9110.pdf", mime: "application/pdf", url: "https://www.rfc-editor.org/rfc/rfc9110.pdf" },
  {
    filename: "DamagedHelmet.glb",
    mime: "model/gltf-binary",
    url: "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/DamagedHelmet/glTF-Binary/DamagedHelmet.glb",
  },
]

async function bytesFor(source) {
  if (source.from) return await fs.readFile(source.from)
  await fs.mkdir(CACHE, { recursive: true })
  const cached = path.join(CACHE, source.filename)
  try {
    return await fs.readFile(cached)
  } catch {
    const response = await fetch(source.url)
    if (!response.ok) throw new Error(`${source.url} -> HTTP ${response.status}`)
    const bytes = Buffer.from(await response.arrayBuffer())
    await fs.writeFile(cached, bytes)
    return bytes
  }
}

export async function prepareAttachments() {
  const stored = {}
  for (const source of sources) {
    const bytes = await bytesFor(source)
    const query = new URLSearchParams({ filename: source.filename, directory: DIRECTORY })
    const response = await fetch(`${BASE}/attachment?${query}`, {
      method: "POST",
      headers: { "content-type": source.mime },
      body: bytes,
    })
    if (!response.ok) throw new Error(`upload ${source.filename} -> HTTP ${response.status} ${await response.text()}`)
    stored[source.filename] = await response.json()
  }
  return stored
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const stored = await prepareAttachments()
  const out = path.join(repoRoot, "tmp", "gallery-attachments.json")
  await fs.writeFile(out, JSON.stringify(stored, null, 2))
  console.log(JSON.stringify(stored, null, 2))
}
