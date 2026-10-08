import fs from "node:fs"
import { Message } from "../packages/opencorvus/src/session/message"
import z from "zod"

const output = process.argv[2]!
const input = { type: "source-url", sourceId: "validation-175", url: "not-http-url" }
const facts: Record<string, unknown> = { boundary: "fresh isolated local schema probe, not original173 failure or Provider/UI", input }
try { facts.current = Message.SourcePayload.safeParse(input) }
catch (error) { facts.current = { thrownType: error instanceof Error ? error.name : typeof error, message: error instanceof Error ? error.message : String(error), stack: error instanceof Error ? error.stack : undefined } }
facts.builtin = ["https://example.test/resource?q=1#section", "http://localhost:18105/resource", "not-http-url", "ftp://example.test/resource"].map(url => ({ url, result: z.url({ protocol: /^https?$/ }).safeParse(url) }))
fs.writeFileSync(output, JSON.stringify(facts, null, 2), { flag: "wx" })
console.log(JSON.stringify({ boundary: facts.boundary, current: facts.current, builtin: (facts.builtin as any[]).map(row => ({url: row.url, result: row.result.success ? row.result.data : row.result.error.issues})) }))
