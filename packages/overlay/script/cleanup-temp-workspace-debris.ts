#!/usr/bin/env bun
// Cleanup script: remove orphan tasks + disk dirs left behind by the deleted
// temp-workspace mechanism. Non-interactive, designed to run unattended as a
// one-shot migration after the temp-workspace removal.
//
// Usage:
//   bun run script/cleanup-temp-workspace-debris.ts --server http://127.0.0.1:7878
//   bun run script/cleanup-temp-workspace-debris.ts --server ... --execute
//
// Default is dry-run. Add `--execute` to actually delete.
//
// Exit codes:
//   0  success (dry-run or execute); list printed to stdout, summary to stderr
//   1  server unreachable or returned non-200 on /global/tasks
//   2  DELETE failed for one or more tasks (stderr carries details)

import { rm, readdir, stat } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

interface Args {
  server: string
  execute: boolean
  password?: string
}

function parseArgs(argv: string[]): Args {
  const out: Args = { server: "http://127.0.0.1:7878", execute: false }
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i]
    if (a === "--execute") out.execute = true
    else if (a === "--server") out.server = argv[++i] ?? out.server
    else if (a.startsWith("--server=")) out.server = a.slice("--server=".length)
    else if (a === "--password") out.password = argv[++i]
    else if (a.startsWith("--password=")) out.password = a.slice("--password=".length)
  }
  return out
}

function isOrphanTempDir(p: string): boolean {
  const normalized = p.replace(/\\/g, "/")
  const root = tmpdir().replace(/\\/g, "/")
  return normalized.startsWith(root) && /\/opencorvus-overlay-[0-9]+-[0-9]+(-[0-9]+)?$/i.test(normalized)
}

async function loadTasks(base: string, auth?: string): Promise<Array<{ id: string; directory: string }>> {
  const res = await fetch(new URL("/global/tasks", base), {
    headers: {
      Accept: "application/json",
      ...(auth ? { Authorization: `Basic ${auth}` } : {}),
    },
  })
  if (!res.ok) throw new Error(`/global/tasks returned HTTP ${res.status}`)
  const body = (await res.json()) as { tasks?: Array<{ task?: { id?: string; directory?: string } }> }
  return (body.tasks ?? [])
    .map((t) => ({ id: t.task?.id ?? "", directory: t.task?.directory ?? "" }))
    .filter((t) => t.id && t.directory)
}

async function deleteTask(base: string, id: string, auth?: string): Promise<void> {
  const res = await fetch(new URL(`/task/${encodeURIComponent(id)}`, base), {
    method: "DELETE",
    headers: auth ? { Authorization: `Basic ${auth}` } : {},
  })
  if (!res.ok) throw new Error(`DELETE /task/${id} returned HTTP ${res.status}`)
}

async function listOrphanDirs(): Promise<string[]> {
  const root = tmpdir()
  let entries: string[] = []
  try {
    entries = await readdir(root)
  } catch (e) {
    throw new Error(`read tmpdir ${root} failed: ${(e as Error).message}`)
  }
  const out: string[] = []
  for (const name of entries) {
    if (!/^opencorvus-overlay-[0-9]+-[0-9]+(-[0-9]+)?$/i.test(name)) continue
    const full = join(root, name)
    try {
      const s = await stat(full)
      if (s.isDirectory()) out.push(full)
    } catch {
      /* raced unlink is fine */
    }
  }
  return out
}

async function main(): Promise<number> {
  const args = parseArgs(process.argv.slice(2))
  const auth = args.password ? Buffer.from(`opencorvus:${args.password}`).toString("base64") : undefined

  console.error(`[cleanup] server=${args.server} mode=${args.execute ? "EXECUTE" : "dry-run"}`)

  let tasks: Array<{ id: string; directory: string }>
  try {
    tasks = await loadTasks(args.server, auth)
  } catch (e) {
    console.error(`[cleanup] server unreachable: ${(e as Error).message}`)
    return 1
  }

  const orphanTasks = tasks.filter((t) => isOrphanTempDir(t.directory))
  const orphanDirs = await listOrphanDirs()

  console.error(`[cleanup] candidates: ${orphanTasks.length} task records, ${orphanDirs.length} disk dirs`)
  for (const t of orphanTasks) console.log(`task ${t.id} → ${t.directory}`)
  for (const d of orphanDirs) console.log(`dir  ${d}`)

  if (!args.execute) {
    console.error(`[cleanup] dry-run complete. Re-run with --execute to delete.`)
    return 0
  }

  let taskFailures = 0
  for (const t of orphanTasks) {
    try {
      await deleteTask(args.server, t.id, auth)
      console.error(`[cleanup] deleted task ${t.id}`)
    } catch (e) {
      taskFailures += 1
      console.error(`[cleanup] FAIL task ${t.id}: ${(e as Error).message}`)
    }
  }

  let dirFailures = 0
  for (const d of orphanDirs) {
    try {
      await rm(d, { recursive: true, force: true })
      console.error(`[cleanup] removed dir ${d}`)
    } catch (e) {
      dirFailures += 1
      console.error(`[cleanup] FAIL dir ${d}: ${(e as Error).message}`)
    }
  }

  console.error(
    `[cleanup] done. tasks_deleted=${orphanTasks.length - taskFailures} task_failures=${taskFailures} dirs_removed=${orphanDirs.length - dirFailures} dir_failures=${dirFailures}`,
  )
  return taskFailures + dirFailures > 0 ? 2 : 0
}

process.exit(await main())
