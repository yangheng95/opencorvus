import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import { gzipSync, gunzipSync } from 'node:zlib'
const root = import.meta.dirname
const out = path.resolve(root, '../../specs/artifacts/2026-10-22-config-admitted-discovery')
const names = ['before-cold', 'before-repeat', 'after-cold', 'after-repeat'].flatMap(round => [
  `${round}/config-write.ts`, `${round}/prepare-readers.ts`,
  ...(round.startsWith('after-') ? [`${round}/config-write-before-prefix-repair.ts`] : []),
])
const packed = []
for (const name of names) {
  const file = path.resolve(out, name)
  assert(path.relative(out, file).split(path.sep)[0] !== '..')
  assert(fs.lstatSync(file).isFile())
  const raw = fs.readFileSync(file)
  const encoded = gzipSync(raw)
  assert(gunzipSync(encoded).equals(raw))
  fs.writeFileSync(file + '.gz', encoded, { flag: 'wx' })
  fs.unlinkSync(file)
  packed.push({ original: name, archive: name + '.gz', rawBytes: raw.length, gzipBytes: encoded.length })
}
fs.copyFileSync(root + '/pack-sources.mjs', out + '/pack-sources.mjs', fs.constants.COPYFILE_EXCL)
fs.writeFileSync(out + '/source-packaging.json', JSON.stringify({ reason: 'Preserve exact original checker and failure snapshot bytes including terminal blank lines, without normalizing runtime evidence', packed }, null, 2) + '\n', { flag: 'wx' })
console.log(JSON.stringify({ packed: packed.length }))
