import { expect, test } from "bun:test"
import { spawnSync } from "node:child_process"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"

const script = fileURLToPath(new URL("./install-ubuntu-packages.sh", import.meta.url))
const shellPath = (value: string) => (process.platform === "win32" ? value.replaceAll("\\", "/") : value)

function rewrite(source: string, architecture: string) {
  const parent = path.resolve(os.tmpdir())
  const root = fs.mkdtempSync(path.join(parent, "opencorvus-ubuntu-sources-"))
  try {
    const input = path.join(root, "input.sources")
    const output = path.join(root, "output.sources")
    fs.writeFileSync(input, source)
    const result = spawnSync(
      "bash",
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
      { encoding: "utf8", windowsHide: true },
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

test("maps an empty package request to the existing usage contract", () => {
  const result = spawnSync("bash", ["--noprofile", "--norc", shellPath(script)], {
    encoding: "utf8",
    windowsHide: true,
  })
  if (result.error) throw result.error
  expect({ status: result.status, error: result.stderr.trim() }).toEqual({
    status: 2,
    error: "Usage: sudo bash script/install-ubuntu-packages.sh PACKAGE...",
  })
})
