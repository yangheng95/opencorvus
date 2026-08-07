export const WINDOWS_WSL_DISTRIBUTION = "Ubuntu-24.04"

function succeeds(command: string[]): boolean {
  try {
    return Bun.spawnSync(command, { stdout: "ignore", stderr: "ignore" }).exitCode === 0
  } catch {
    return false
  }
}

function executableProbe(executables: string[]): string {
  return executables.map((executable) => `test -x ${JSON.stringify(executable)}`).join(" && ")
}

export function windowsWslExecutablesAvailable(executables: string[]): boolean {
  if (process.platform !== "win32") return true
  return succeeds([
    "wsl.exe",
    "-d",
    WINDOWS_WSL_DISTRIBUTION,
    "--exec",
    "/bin/bash",
    "-lc",
    executableProbe(executables),
  ])
}

export function userSystemdRuntimeAvailable(executables: string[] = []): boolean {
  const probe = [
    executableProbe(executables),
    "command -v systemd-run >/dev/null",
    "systemctl --user show-environment >/dev/null",
  ]
    .filter(Boolean)
    .join(" && ")
  return process.platform === "win32"
    ? succeeds(["wsl.exe", "-d", WINDOWS_WSL_DISTRIBUTION, "--exec", "/bin/bash", "-lc", probe])
    : succeeds(["/bin/bash", "-lc", probe])
}
