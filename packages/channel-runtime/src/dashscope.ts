import fs from "fs/promises"
import path from "path"
import { channelRuntimePaths } from "./runtime-paths"

const DASHSCOPE_CODING_BASE_URL = "https://coding.dashscope.aliyuncs.com/v1"
const DASHSCOPE_MAINLAND_BASE_URL = "https://dashscope.aliyuncs.com/compatible-mode/v1"

function dashscopeBaseURL(key: string | undefined) {
  if (key?.startsWith("sk-") && !key?.startsWith("sk-sp-")) return DASHSCOPE_MAINLAND_BASE_URL
  return DASHSCOPE_CODING_BASE_URL
}

function authPath() {
  return path.join(channelRuntimePaths().data, "auth.json")
}

async function keyFromAuth() {
  const file = authPath()
  try {
    const raw = await fs.readFile(file, "utf-8")
    const json = JSON.parse(raw) as Record<string, unknown>
    const provider = "alibaba-cn"
    const data = json[provider]
    if (!data || typeof data !== "object" || Array.isArray(data)) return { key: undefined, path: file, provider }
    const type = (data as Record<string, unknown>)["type"]
    const key = (data as Record<string, unknown>)["key"]
    if (type !== "api" || typeof key !== "string" || !key.trim()) return { key: undefined, path: file, provider }
    return { key: key.trim(), path: file, provider }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return { key: undefined, path: file, provider: "alibaba-cn" }
    }
    throw new Error(`Failed to read canonical OpenCorvus auth file ${file}: ${String(error)}`, { cause: error })
  }
}

export async function applyDashscopeRuntime() {
  const result = await keyFromAuth()
  return {
    key: result.key,
    authPath: result.path,
    authProvider: result.provider,
    baseURL: dashscopeBaseURL(result.key),
    useCodingPlan: !!result.key?.startsWith("sk-sp-"),
  }
}
