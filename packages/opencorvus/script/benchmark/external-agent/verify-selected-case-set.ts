import path from "node:path"

export async function verifySelectedCaseSet(input: { python: string; manifest: string; sha256: string }) {
  const child = Bun.spawn([
    input.python,
    path.join(import.meta.dir, "freeze_automationbench_case_set.py"),
    "--verify-manifest",
    input.manifest,
  ], { cwd: import.meta.dir, stdout: "pipe", stderr: "pipe" })
  const [exitCode, stdout, stderr] = await Promise.all([
    child.exited,
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
  ])
  const report = stdout.trim() ? JSON.parse(stdout) : undefined
  if (exitCode !== 0 || report?.passed !== true || report.manifest_sha256 !== input.sha256) {
    throw new Error(`Selected manifest does not match the official dataset: ${
      JSON.stringify(report?.violations ?? stderr.trim().slice(0, 2000))
    }`)
  }
  return report as { passed: true; case_count: number; dataset_index_sha256: string; manifest_sha256: string }
}
