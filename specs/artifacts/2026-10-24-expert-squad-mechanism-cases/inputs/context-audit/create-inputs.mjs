// Reproduce the exact controlled inputs used by context-real-2 and context-real-3.
// This creates data only; it does not start a service, invoke a model, or inspect credentials.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const root = process.argv[2]
assert(root, 'Supply a new isolated project directory')
assert.equal(fs.existsSync(root), false, 'Keep existing projects and evidence unchanged')
fs.mkdirSync(path.join(root, 'pages'), { recursive: true })
for (let page = 1; page <= 8; page++) {
  const rows = Array.from({ length: 180 }, (_, i) => {
    const row = i + 1
    return `page=${page} transaction=${String(row).padStart(4, '0')} amount_cents=${page * 1000 + row} customer=C${page}_${row} purpose=Controlled local ledger transaction for full-context preservation and arithmetic review.`
  })
  fs.writeFileSync(path.join(root, 'pages', `page-${page}.txt`),
    `Controlled ledger page ${page}. All amounts in integer cents; one line is one transaction.\n` + rows.join('\n') + '\n', { flag: 'wx' })
}
console.log(JSON.stringify({ project: path.resolve(root), pages: 8, recordsPerPage: 180, totalRecords: 1440, totalCents: 6610320 }))
