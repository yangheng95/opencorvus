import { readdir } from "node:fs/promises"
import path from "node:path"

export type TestFileRunInput = {
  concurrency: number
  root: string
}

export function parseTestFileRunInput(argv: string[]): TestFileRunInput {
  if (argv.length !== 3 || argv[0] !== "--concurrency" || !/^\d+$/.test(argv[1])) {
    throw new Error("Usage: run-test-files.ts --concurrency <positive integer> <test-root>")
  }
  const concurrency = Number(argv[1])
  if (!Number.isSafeInteger(concurrency) || concurrency <= 0) {
    throw new Error("--concurrency requires a positive safe integer")
  }
  return { concurrency, root: argv[2] }
}

function byteOrder(left: string, right: string): number {
  return Buffer.compare(Buffer.from(left, "utf8"), Buffer.from(right, "utf8"))
}

export async function discoverTestFiles(root: string): Promise<string[]> {
  const absoluteRoot = path.resolve(root)
  const files: string[] = []
  async function visit(directory: string) {
    const entries = await readdir(directory, { withFileTypes: true })
    entries.sort((left, right) => byteOrder(left.name, right.name))
    for (const entry of entries) {
      const absolute = path.join(directory, entry.name)
      if (entry.isDirectory()) await visit(absolute)
      else if (entry.isFile() && entry.name.endsWith(".test.ts")) {
        files.push(path.relative(process.cwd(), absolute))
      }
    }
  }
  await visit(absoluteRoot)
  return files.sort(byteOrder)
}

export async function runTestFiles(input: TestFileRunInput): Promise<{ passed: number; failed: string[] }> {
  const files = await discoverTestFiles(input.root)
  if (files.length === 0) throw new Error(`No .test.ts files found under ${path.resolve(input.root)}`)

  let next = 0
  let passed = 0
  const failed: string[] = []
  async function worker() {
    while (true) {
      const index = next++
      const file = files[index]
      if (!file) return
      process.stdout.write(`\n=== ${file} ===\n`)
      const child = Bun.spawn([process.execPath, "test", "--timeout=0", file], {
        cwd: process.cwd(),
        env: process.env,
        stdin: "ignore",
        stdout: "inherit",
        stderr: "inherit",
      })
      const code = await child.exited
      if (code === 0) passed += 1
      else failed.push(file)
    }
  }

  await Promise.all(Array.from({ length: Math.min(input.concurrency, files.length) }, () => worker()))
  failed.sort(byteOrder)
  return { passed, failed }
}

if (import.meta.main) {
  const result = await runTestFiles(parseTestFileRunInput(process.argv.slice(2)))
  if (result.failed.length === 0) {
    console.log(`All ${result.passed} test files passed in isolated Bun processes.`)
  } else {
    console.error(`${result.failed.length} test file(s) failed:`)
    for (const file of result.failed) console.error(file)
    process.exit(1)
  }
}
