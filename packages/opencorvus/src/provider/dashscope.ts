import path from "path"
import { Global } from "../global"
import { Filesystem } from "../util/filesystem"

const stateFile = path.join(Global.Path.state, "dashscope-embedded.json")

function ttlMs() {
  const raw = Number(process.env.OPENCORVUS_EMBEDDED_DASHSCOPE_TTL_HOURS ?? "24")
  if (!Number.isFinite(raw) || raw <= 0) return 24 * 60 * 60 * 1000
  return raw * 60 * 60 * 1000
}

export async function dashscopeKey(env: Record<string, string | undefined>) {
  const direct = env["DASHSCOPE_API_KEY"]?.trim()
  if (direct) return direct

  const key = process.env.OPENCORVUS_EMBEDDED_DASHSCOPE_KEY?.trim()
  if (!key) return

  const now = Date.now()
  const hash = Bun.hash.xxHash32(key)
  const saved = await Filesystem.readJson<{ hash?: number; first?: number }>(stateFile).catch(() => ({
    hash: undefined,
    first: undefined,
  }))
  const firstSaved = typeof saved.first === "number" && Number.isFinite(saved.first) ? saved.first : undefined
  const same = saved.hash === hash && firstSaved !== undefined
  const first = firstSaved ?? now

  if (!same) {
    await Filesystem.writeJson(
      stateFile,
      {
        hash,
        first,
      },
      0o600,
    )
  }

  if (now - first >= ttlMs()) return
  return key
}
