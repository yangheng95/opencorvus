import path from "path"
import { Global } from "../global"
import { Filesystem } from "../util/filesystem"
import { sha256Text } from "../util/canonical-digest"
import z from "zod"

const stateFile = path.join(Global.Path.state, "dashscope-embedded.json")
const State = z
  .object({
    schema_version: z.literal(2),
    credential_sha256: z.string().regex(/^[a-f0-9]{64}$/),
    first: z.number().finite(),
  })
  .strict()

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
  const credentialSHA256 = sha256Text("opencorvus.provider.dashscope-credential.v2", key)
  const saved = await Filesystem.readJson(stateFile)
    .then((value) => State.safeParse(value).data)
    .catch(() => undefined)
  const same = saved?.credential_sha256 === credentialSHA256
  const first = same ? saved.first : now

  if (!same) {
    await Filesystem.writeAtomic(
      stateFile,
      JSON.stringify({ schema_version: 2, credential_sha256: credentialSHA256, first }),
      0o600,
    )
  }

  if (now - first >= ttlMs()) return
  return key
}
