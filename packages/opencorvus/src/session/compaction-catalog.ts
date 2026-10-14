/** An immutable, attempt-owned index over original transcript fragments.
 * Directory facts describe source types, never semantic relevance or authority. */
export namespace CompactionCatalog {
  export type Source = {
    messageIndex: number
    role: "user" | "assistant"
    text: string
    toolState?: "pending" | "running" | "completed" | "error"
    diagnostics?: boolean
  }
  export type Counts = { users: number; assistants: number; tools: number; toolErrors: number; diagnostics: number }
  export type Reference = {
    offset: number
    limit: number
    end: number
    records: [number, number]
    counts: Counts
  }
  export type Node = ({ kind: "source" } & Source) | { kind: "directory"; children: Reference[] }

  export function build(sources: Source[], maxReadChars: number) {
    if (!Number.isSafeInteger(maxReadChars) || maxReadChars < 1)
      throw new RangeError("Catalog read size must be a positive safe integer")
    const chunks: string[] = []
    let offset = 1 // The enclosing array's opening bracket.
    const empty = (): Counts => ({ users: 0, assistants: 0, tools: 0, toolErrors: 0, diagnostics: 0 })
    const append = (node: Node, records: [number, number], counts: Counts): Reference => {
      const encoded = JSON.stringify(node)
      const reference = {
        offset,
        limit: Math.min(maxReadChars, encoded.length),
        end: offset + encoded.length,
        records,
        counts,
      }
      chunks.push(encoded)
      offset += encoded.length + 1 // A comma, or the final closing bracket.
      return reference
    }
    const build = (start: number, end: number): Reference => {
      if (end - start === 1) {
        const source = sources[start]!
        return append({ kind: "source", ...source }, [start, end], {
          users: Number(source.role === "user"),
          assistants: Number(source.role === "assistant"),
          tools: Number(source.toolState !== undefined),
          toolErrors: Number(source.toolState === "error"),
          diagnostics: Number(source.diagnostics === true),
        })
      }
      const middle = Math.floor((start + end) / 2)
      const children = [build(start, middle), build(middle, end)]
      const counts = empty()
      for (const child of children)
        for (const key of Object.keys(counts) as Array<keyof Counts>) counts[key] += child.counts[key]
      return append({ kind: "directory", children }, [start, end], counts)
    }
    const root = sources.length
      ? build(0, sources.length)
      : append({ kind: "directory", children: [] }, [0, 0], empty())
    return { content: `[${chunks.join(",")}]`, root }
  }
}
