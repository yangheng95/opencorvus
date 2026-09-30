#!/usr/bin/env bun
import { readFileSync } from "node:fs"
import { parseChangelog, requireReleaseNotes } from "../packages/util/src/changelog"

const root = new URL("../", import.meta.url)
const version = process.argv[2] ?? JSON.parse(readFileSync(new URL("packages/opencorvus/package.json", root), "utf8")).version
const entries = parseChangelog(readFileSync(new URL("CHANGELOG.md", root), "utf8"))
const entry = requireReleaseNotes(entries, version)
console.log(`Written release notes verified: ${entry.version} (${entry.date}); ${entries.length} historical versions`)
