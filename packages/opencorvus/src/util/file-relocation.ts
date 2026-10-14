import fs from "node:fs/promises"
import path from "node:path"
import { readFileEntry, sameFileEntry, type FileEntry } from "./file-entry"
import {
  filePosition,
  filePositionKey,
  isShortFileName,
  lookupFileAccess,
  walkFileAccess,
  type FileAccessEntry,
} from "./file-access"

type Member = { suffix: string; entry: FileEntry; text?: string; names?: string[] }

export type FileRelocationError = {
  file: string
  phase: "source" | "future"
  reason: "outside" | "recursive" | "changed"
  possible?: boolean
}

/** One operation's actual entry facts and explicit final-position mapping. */
export async function observeRelocationTree(root: string, expected?: FileEntry["stat"]) {
  const members = new Map<string, Member>()
  const pending = [{ suffix: "", full: root }]
  for (let index = 0; index < pending.length; index++) {
    const current = pending[index]!,
      entry = await readFileEntry(current.full, index === 0 ? expected : undefined)
    const member: Member = { suffix: current.suffix, entry }
    if (entry.link) member.text = await fs.readlink(current.full)
    else if (entry.stat.isDirectory()) {
      member.names = (await fs.readdir(current.full)).toSorted()
      for (const name of member.names)
        pending.push({ suffix: path.join(current.suffix, name), full: path.join(current.full, name) })
    }
    members.set(filePositionKey(current.suffix || "."), member)
  }
  const first = members.get(filePositionKey("."))!
  const position =
    first.entry.stat.isDirectory() && !first.entry.link ? await fs.realpath(root) : filePosition(first.entry.address)
  async function verify() {
    for (const member of members.values()) {
      const full = member.suffix ? path.join(root, member.suffix) : root
      const actual = await readFileEntry(full)
      if (
        !sameFileEntry(member.entry, actual) ||
        member.entry.link !== actual.link ||
        member.entry.shortName !== actual.shortName
      )
        throw Object.assign(new Error(`Relocation source entry changed: ${full}`), {
          code: "ERR_FILE_ENTRY_CHANGED",
          path: full,
        })
      if (member.text !== undefined && (await fs.readlink(full)) !== member.text)
        throw Object.assign(new Error(`Relocation source link changed: ${full}`), {
          code: "ERR_FILE_ENTRY_CHANGED",
          path: full,
        })
      if (member.names) {
        const names = (await fs.readdir(full)).toSorted()
        if (names.length !== member.names.length || names.some((name, index) => name !== member.names![index]))
          throw Object.assign(new Error(`Relocation source members changed: ${full}`), {
            code: "ERR_FILE_ENTRY_CHANGED",
            path: full,
          })
      }
    }
  }
  return { root, position: filePosition(position), members, verify }
}

export type RelocationTree = Awaited<ReturnType<typeof observeRelocationTree>>

export async function verifyRelocationTargets(input: {
  file: string
  tree: RelocationTree
  phase: "source" | "future"
  targetRoot?: string
  retire?: RelocationTree
  allowed: (position: string) => boolean
  fail: (error: FileRelocationError) => Error
}) {
  const tree = input.tree,
    future = input.phase === "future"
  const target = future
    ? path.join(await fs.realpath(path.dirname(input.targetRoot!)), path.basename(input.targetRoot!))
    : tree.position
  const parent = path.dirname(target),
    targetKey = filePositionKey(target),
    retired = input.retire && filePositionKey(input.retire.position)
  const contains = (base: string, value: string) => value === base || value.startsWith(base + path.sep)
  const witness = new Map<string, { entry: FileEntry; text?: string }>()
  const children = new Map<string, Map<string, Member>>()
  for (const member of tree.members.values()) {
    if (!member.suffix) continue
    const directoryKey = filePositionKey(path.dirname(member.suffix)),
      names = children.get(directoryKey) ?? new Map<string, Member>()
    for (const name of [path.basename(member.suffix), member.entry.shortName].filter((value): value is string =>
      Boolean(value),
    )) {
      const key = filePositionKey(name),
        prior = names.get(key)
      if (prior && prior !== member)
        throw Object.assign(new Error(`Ambiguous filesystem entry spelling: ${name}`), { code: "ENOTSUP" })
      names.set(key, member)
    }
    children.set(directoryKey, names)
  }
  const memberAt = (member: Member): FileAccessEntry => ({
    position: member.suffix ? path.join(target, member.suffix) : target,
    entry: member.entry,
    ...(member.text !== undefined ? { text: member.text } : {}),
  })
  async function lookup(directory: string, name: string): Promise<FileAccessEntry[]> {
    const candidate = path.join(directory, name),
      key = filePositionKey(candidate)
    if (future && key === targetKey) return [memberAt(tree.members.get(filePositionKey("."))!)]
    if (future && contains(targetKey, filePositionKey(directory))) {
      const suffix = path.relative(target, directory),
        child = children.get(filePositionKey(suffix || "."))?.get(filePositionKey(name))
      return child ? [memberAt(child)] : [{ position: candidate }]
    }
    const actual = await lookupFileAccess(directory, name)
    const result = actual.map((item) => {
      if (retired && item.entry && contains(retired, filePositionKey(item.entry.address)))
        return { position: candidate }
      if (item.entry) {
        const key = filePositionKey(item.entry.address),
          prior = witness.get(key)
        if (
          prior &&
          (!sameFileEntry(prior.entry, item.entry) ||
            prior.entry.link !== item.entry.link ||
            prior.entry.shortName !== item.entry.shortName ||
            prior.text !== item.text)
        )
          throw input.fail({ file: input.file, phase: input.phase, reason: "changed" })
        witness.set(key, { entry: item.entry, text: item.text })
      }
      return item
    })
    // A future root's extra short name is not yet allocated. Prove both
    // interpretations rather than guessing a name or preferring a missing path.
    if (
      future &&
      process.platform === "win32" &&
      filePositionKey(directory) === filePositionKey(parent) &&
      !isShortFileName(path.basename(target)) &&
      isShortFileName(name) &&
      result.every((item) => !item.entry)
    ) {
      result.push({ ...memberAt(tree.members.get(filePositionKey("."))!), possible: true })
    }
    return result
  }
  for (const member of tree.members.values()) {
    const file = member.suffix ? path.join(input.file, member.suffix) : input.file
    if (!future && !member.entry.link) {
      const actual = member.entry.stat.isDirectory()
        ? await fs.realpath(member.entry.address)
        : filePosition(member.entry.address)
      if (!input.allowed(actual)) throw input.fail({ file, phase: input.phase, reason: "outside" })
    }
    if (member.text === undefined) continue
    const position = future ? memberAt(member).position : filePosition(member.entry.address)
    // The declaration is evaluated from the entry's actual containing position,
    // not the caller's alias or an ultimate target substituted for its namespace.
    const operand =
      process.platform === "win32"
        ? path.resolve(path.dirname(position), member.text)
        : path.isAbsolute(member.text)
          ? member.text
          : `${path.dirname(position)}${path.sep}${member.text}`
    try {
      const results = await walkFileAccess(operand, { lookup })
      if (results.some((result) => !input.allowed(result.position)))
        throw input.fail({ file, phase: input.phase, reason: "outside" })
    } catch (error) {
      if (error && typeof error === "object" && "code" in error && error.code === "ELOOP")
        throw input.fail({
          file,
          phase: input.phase,
          reason: "recursive",
          possible: "possible" in error && Boolean(error.possible),
        })
      throw error
    }
  }
  await tree.verify()
  if (input.retire && input.retire !== tree) await input.retire.verify()
  for (const original of witness.values()) {
    const actual = await readFileEntry(original.entry.address)
    if (
      !sameFileEntry(original.entry, actual) ||
      original.entry.link !== actual.link ||
      original.entry.shortName !== actual.shortName ||
      (original.text !== undefined && (await fs.readlink(original.entry.address)) !== original.text)
    )
      throw input.fail({ file: input.file, phase: input.phase, reason: "changed" })
  }
  if (future && filePositionKey(await fs.realpath(path.dirname(input.targetRoot!))) !== filePositionKey(parent))
    throw input.fail({ file: input.file, phase: input.phase, reason: "changed" })
}
