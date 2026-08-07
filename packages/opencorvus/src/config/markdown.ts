import { NamedError } from "@opencorvus-ai/util/error"
import matter from "gray-matter"
import { z } from "zod"
import { Filesystem } from "../util/filesystem"

export namespace ConfigMarkdown {
  export const FILE_REGEX = /(?<![\w`])@(\.?[^\s`,.]*(?:\.[^\s`,.]+)*)/g
  export const SHELL_REGEX = /!`([^`]+)`/g

  type Range = readonly [start: number, end: number]

  function isInsideRange(ranges: Range[], index: number) {
    return ranges.some(([start, end]) => index >= start && index < end)
  }

  function fencedCodeRanges(template: string): Range[] {
    const ranges: Range[] = []
    let offset = 0
    let fence: { start: number; marker: "`" | "~"; length: number } | undefined
    while (offset < template.length) {
      const newline = template.indexOf("\n", offset)
      const end = newline === -1 ? template.length : newline + 1
      const line = template.slice(offset, end)
      if (!fence) {
        const open = /^[ \t]{0,3}(`{3,}|~{3,})/.exec(line)
        if (open) {
          fence = {
            start: offset,
            marker: open[1][0] as "`" | "~",
            length: open[1].length,
          }
        }
      } else {
        const escaped = fence.marker === "`" ? "`" : "~"
        const close = new RegExp(`^[ \\t]{0,3}${escaped}{${fence.length},}(?:[ \\t]*\\r?\\n?|$)`)
        if (close.test(line)) {
          ranges.push([fence.start, end])
          fence = undefined
        }
      }
      offset = end
    }
    if (fence) ranges.push([fence.start, template.length])
    return ranges
  }

  function inlineCodeRanges(template: string, fenced: Range[]): Range[] {
    const ranges: Range[] = []
    const marker = /`+/g
    let open: RegExpExecArray | null
    while ((open = marker.exec(template))) {
      if (isInsideRange(fenced, open.index)) continue
      let close: RegExpExecArray | null
      while ((close = marker.exec(template))) {
        if (isInsideRange(fenced, close.index)) continue
        if (close[0].length !== open[0].length) continue
        ranges.push([open.index, close.index + close[0].length])
        break
      }
    }
    return ranges
  }

  function markdownCodeRanges(template: string): Range[] {
    const fenced = fencedCodeRanges(template)
    return [...fenced, ...inlineCodeRanges(template, fenced)]
  }

  export function files(template: string) {
    const codeRanges = markdownCodeRanges(template)
    return Array.from(template.matchAll(FILE_REGEX)).filter((match) => {
      return match.index === undefined || !isInsideRange(codeRanges, match.index)
    })
  }

  export function shell(template: string) {
    return Array.from(template.matchAll(SHELL_REGEX))
  }

  export async function parse(filePath: string) {
    const template = await Filesystem.readText(filePath)
    try {
      return matter(template)
    } catch (err) {
      throw new FrontmatterError(
        {
          path: filePath,
          message: `${filePath}: Failed to parse YAML frontmatter: ${err instanceof Error ? err.message : String(err)}`,
        },
        { cause: err },
      )
    }
  }

  export const FrontmatterError = NamedError.create(
    "ConfigFrontmatterError",
    z.object({
      path: z.string(),
      message: z.string(),
    }),
  )
}
