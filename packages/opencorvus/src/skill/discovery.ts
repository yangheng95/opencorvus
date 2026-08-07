import path from "path"
import { mkdir } from "fs/promises"
import { Log } from "../util/log"
import { Global } from "../global"
import { Filesystem } from "../util/filesystem"

export namespace Discovery {
  const log = Log.create({ service: "skill-discovery" })

  type Index = {
    skills: Array<{
      name: string
      description: string
      files: string[]
    }>
  }

  export function dir() {
    return path.join(Global.Path.cache, "skills")
  }

  function resolveDiscoveryChild(parent: string, value: string, label: string, options?: { singleSegment?: boolean }) {
    const trimmed = value.trim()
    const segments = trimmed.split("/")
    if (
      !trimmed ||
      trimmed !== value ||
      value.includes("\\") ||
      value.includes(":") ||
      value.includes("?") ||
      value.includes("#") ||
      (options?.singleSegment && segments.length !== 1) ||
      segments.some((segment) => !segment || segment === "." || segment === "..") ||
      path.isAbsolute(value) ||
      path.posix.isAbsolute(value) ||
      path.win32.isAbsolute(value)
    ) {
      throw new Error(`Unsafe skill discovery path ${label}: ${value}`)
    }

    const root = path.resolve(parent)
    const resolved = path.resolve(root, ...segments)
    if (resolved === root || !Filesystem.contains(root, resolved)) {
      throw new Error(`Unsafe skill discovery path ${label}: ${value}`)
    }
    return {
      localPath: resolved,
      remotePath: segments.map(encodeURIComponent).join("/"),
    }
  }

  async function get(url: string, dest: string): Promise<boolean> {
    if (await Filesystem.exists(dest)) return true
    return fetch(url)
      .then(async (response) => {
        if (!response.ok) {
          log.error("failed to download", { url, status: response.status })
          return false
        }
        if (response.body) await Filesystem.writeStream(dest, response.body)
        return true
      })
      .catch((err) => {
        log.error("failed to download", { url, err })
        return false
      })
  }

  export async function pull(url: string, onIssue?: (message: string) => void): Promise<string[]> {
    const result: string[] = []
    const base = url.endsWith("/") ? url : `${url}/`
    const index = new URL("index.json", base).href
    const cache = dir()
    const host = base.slice(0, -1)

    log.info("fetching index", { url: index })
    const data = await fetch(index)
      .then(async (response) => {
        if (!response.ok) {
          log.error("failed to fetch index", { url: index, status: response.status })
          return undefined
        }
        return response
          .json()
          .then((json) => json as Index)
          .catch((err) => {
            log.error("failed to parse index", { url: index, err })
            return undefined
          })
      })
      .catch((err) => {
        log.error("failed to fetch index", { url: index, err })
        return undefined
      })

    if (!data?.skills || !Array.isArray(data.skills)) {
      log.warn("invalid index format", { url: index })
      onIssue?.(`Remote Skill index ${index} is unavailable or invalid.`)
      return result
    }

    const list = data.skills.filter((skill) => {
      if (!skill?.name || !Array.isArray(skill.files)) {
        log.warn("invalid skill entry", { url: index, skill })
        onIssue?.(`Remote Skill index ${index} contains an invalid entry.`)
        return false
      }
      return true
    })

    const downloads: Array<{ root: string; files: Array<{ link: string; dest: string }> }> = []
    for (const skill of list) {
      try {
        const root = resolveDiscoveryChild(cache, skill.name, "skill name", { singleSegment: true })
        const files = skill.files.map((file) => ({
          ...resolveDiscoveryChild(root.localPath, file, "file"),
        }))
        downloads.push({
          root: root.localPath,
          files: files.map((file) => ({
            link: new URL(`${root.remotePath}/${file.remotePath}`, `${host}/`).href,
            dest: file.localPath,
          })),
        })
      } catch (error) {
        if (!onIssue) throw error
        onIssue?.(
          `Remote Skill ${JSON.stringify(skill.name)} was ignored: ${error instanceof Error ? error.message : String(error)}`,
        )
      }
    }

    await Promise.all(
      downloads.map(async ({ root, files }) => {
        const downloaded = await Promise.all(
          files.map(async ({ link, dest }) => {
            try {
              await mkdir(path.dirname(dest), { recursive: true })
              return await get(link, dest)
            } catch (error) {
              onIssue?.(
                `Remote Skill file ${link} was ignored: ${error instanceof Error ? error.message : String(error)}`,
              )
              return false
            }
          }),
        )
        if (downloaded.some((value) => !value)) {
          onIssue?.(`Remote Skill directory ${root} is incomplete because one or more files could not be downloaded.`)
          return
        }

        const md = path.join(root, "SKILL.md")
        if (await Filesystem.exists(md)) result.push(root)
      }),
    )

    return result
  }
}
