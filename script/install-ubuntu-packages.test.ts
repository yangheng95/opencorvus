import { expect, test } from "bun:test"
import { execFileSync, spawnSync } from "node:child_process"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"

const script = fileURLToPath(new URL("./install-ubuntu-packages.sh", import.meta.url))
const shellPath = (value: string) => (process.platform === "win32" ? value.replaceAll("\\", "/") : value)
const bash =
  process.platform === "win32"
    ? path.resolve(
        execFileSync("git", ["--exec-path"], { encoding: "utf8", windowsHide: true }).trim(),
        "../../../usr/bin/bash.exe",
      )
    : "bash"
const shellEnvironment = { ...process.env }
if (process.platform === "win32") {
  for (const key of Object.keys(shellEnvironment)) if (key.toLowerCase() === "path") delete shellEnvironment[key]
  shellEnvironment.PATH = `${path.dirname(bash)}${path.delimiter}${process.env.PATH ?? ""}`
}
const shellOptions = { encoding: "utf8" as const, windowsHide: true, env: shellEnvironment }

function rewrite(source: string, architecture: string) {
  const parent = path.resolve(os.tmpdir())
  const root = fs.mkdtempSync(path.join(parent, "opencorvus-ubuntu-sources-"))
  try {
    const input = path.join(root, "input.sources")
    const output = path.join(root, "output.sources")
    fs.writeFileSync(input, source)
    const result = spawnSync(
      bash,
      [
        "--noprofile",
        "--norc",
        "-c",
        'source "$1"; write_ubuntu_sources "$2" "$3" "$4"',
        "source-contract",
        shellPath(script),
        shellPath(input),
        shellPath(output),
        architecture,
      ],
      shellOptions,
    )
    if (result.error) throw result.error
    return { status: result.status, error: result.stderr.trim(), output: fs.readFileSync(output, "utf8") }
  } finally {
    if (path.dirname(path.resolve(root)) !== parent || !path.basename(root).startsWith("opencorvus-ubuntu-sources-"))
      throw new Error("Ubuntu source fixture escaped its owned temporary parent")
    if (fs.lstatSync(root).isSymbolicLink()) throw new Error("Ubuntu source fixture is a symbolic link")
    fs.rmSync(root, { recursive: true })
  }
}

const input = `# Ubuntu input
Types: deb
URIs: http://azure.archive.ubuntu.com/ubuntu/
 https://regional.example.invalid/ubuntu/
Suites: noble noble-updates
Components: main restricted universe multiverse
Signed-By: /usr/share/keyrings/ubuntu-archive-keyring.gpg

Types: deb
URIs: http://security.ubuntu.com/ubuntu/
Suites: noble-security
Components: main
Signed-By:
 -----BEGIN PGP PUBLIC KEY BLOCK-----
 .
 fixture-key-body
 -----END PGP PUBLIC KEY BLOCK-----
`

test.each(["amd64", "i386", "arm64"])(
  "projects the %s official archive while retaining the signed source declarations",
  (architecture) => {
    const mirror =
      architecture === "arm64" ? "https://ports.ubuntu.com/ubuntu-ports/" : "https://archive.ubuntu.com/ubuntu/"
    expect(rewrite(input, architecture)).toEqual({
      status: 0,
      error: "",
      output: `# Ubuntu input
Types: deb
URIs: ${mirror}
Suites: noble noble-updates
Components: main restricted universe multiverse
Signed-By: /usr/share/keyrings/ubuntu-archive-keyring.gpg

Types: deb
URIs: ${mirror}
Suites: noble-security
Components: main
Signed-By:
 -----BEGIN PGP PUBLIC KEY BLOCK-----
 .
 fixture-key-body
 -----END PGP PUBLIC KEY BLOCK-----
`,
    })
  },
)

test("maps a source without a repository URI to the declared configuration error", () => {
  expect(rewrite("Types: deb\nSuites: noble\n", "amd64")).toEqual({
    status: 2,
    error: "Ubuntu source configuration has no URIs field",
    output: "Types: deb\nSuites: noble\n",
  })
})

test.each([{ args: [] }, { args: ["--command"] }])(
  "maps an empty installer request %j to the usage contract",
  ({ args }) => {
    const result = spawnSync(bash, ["--noprofile", "--norc", shellPath(script), ...args], shellOptions)
    if (result.error) throw result.error
    expect({ status: result.status, error: result.stderr.trim() }).toEqual({
      status: 2,
      error: "Usage: sudo bash script/install-ubuntu-packages.sh PACKAGE... | --command COMMAND...",
    })
  },
)

test("writes the inherited apt-get policy with binary-specific precedence", () => {
  const result = spawnSync(
    bash,
    [
      "--noprofile",
      "--norc",
      "-c",
      'source "$1"; write_ubuntu_apt_configuration "/tmp/signed sources/ubuntu.sources" "/" "etc/apt"',
      "config-contract",
      shellPath(script),
    ],
    shellOptions,
  )
  if (result.error) throw result.error
  expect({ status: result.status, error: result.stderr.trim(), configuration: result.stdout }).toEqual({
    status: 0,
    error: "",
    configuration: `Binary::apt-get {
  Dir "/";
  Dir::Etc "etc/apt";
  Dir::Etc::sourcelist "/tmp/signed sources/ubuntu.sources";
  Dir::Etc::sourceparts "-";
  DPkg::Lock::Timeout "300";
  Acquire::Retries "5";
  Acquire::http::Timeout "20";
  APT::Update::Error-Mode "any";
};
`,
  })
})

test.each(['"', "\\", "\n", "\r"])("maps an unrepresentable source path %j to the configuration error", (value) => {
  const result = spawnSync(
    bash,
    [
      "--noprofile",
      "--norc",
      "-c",
      'source "$1"; value=$(cat); write_ubuntu_apt_configuration "$value" "/" "etc/apt"',
      "config-contract",
      shellPath(script),
    ],
    { ...shellOptions, input: `/tmp/${value}/ubuntu.sources` },
  )
  if (result.error) throw result.error
  expect({ status: result.status, error: result.stderr.trim() }).toEqual({
    status: 2,
    error: "Ubuntu source path cannot be represented in APT configuration",
  })
})
