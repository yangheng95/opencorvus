import { describe, expect, test } from "bun:test"
import { Installation } from "@/installation"

type Runner = Parameters<typeof Installation.upgradeWithRunnerForTest>[2]

const success = (stdout = "1.2.3\n"): Awaited<ReturnType<Runner>> => ({
  exitCode: 0,
  stdout,
  stderr: "",
})

function runner(observations: Array<Awaited<ReturnType<Runner>> | Error>): Runner {
  return async () => {
    const next = observations.shift()
    if (!next) throw new Error("unexpected upgrade command")
    if (next instanceof Error) throw next
    return next
  }
}

async function failure(
  target: string,
  observations: Array<Awaited<ReturnType<Runner>> | Error>,
): Promise<InstanceType<typeof Installation.UpgradeFailedError>> {
  try {
    await Installation.upgradeWithRunnerForTest("native", target, runner(observations))
    throw new Error("upgrade unexpectedly succeeded")
  } catch (error) {
    expect(error).toBeInstanceOf(Installation.UpgradeFailedError)
    return error as InstanceType<typeof Installation.UpgradeFailedError>
  }
}

describe("native installation upgrade verification", () => {
  test("returns an observed exact-version receipt after installer and executable probe succeed", async () => {
    const calls: Array<{ stage: string; target: string; executable: string }> = []
    const command: Runner = async (input) => {
      calls.push(input)
      if (input.stage === "installer_download") return success("#!/usr/bin/env bash\n")
      return input.stage === "installer" ? success("installer output") : success("v1.2.3\n")
    }

    const receipt = await Installation.upgradeWithRunnerForTest("native", "v1.2.3", command)

    expect(receipt).toEqual({
      method: "native",
      requestedVersion: "1.2.3",
      observedVersion: "1.2.3",
      executable: process.execPath,
    })
    expect(calls).toEqual([
      { stage: "installer_download", target: "1.2.3", executable: process.execPath },
      {
        stage: "installer",
        target: "1.2.3",
        executable: process.execPath,
        stdin: "#!/usr/bin/env bash\n",
      },
      { stage: "executable_probe", target: "1.2.3", executable: process.execPath },
    ])
  })

  test("returns the downloader observation without executing a successful installer or matching old probe", async () => {
    const error = await failure("1.2.3", [{ exitCode: 23, stdout: "partial", stderr: "install failed" }])

    expect(error.data).toMatchObject({
      stage: "installer",
      target: "1.2.3",
      exitCode: 23,
      stdout: "partial",
      stderr: "install failed",
    })
  })

  test("returns the installer observation when downloaded installation exits unsuccessfully", async () => {
    const error = await failure("1.2.3", [success("script"), { exitCode: 19, stdout: "", stderr: "bash failed" }])
    expect(error.data).toMatchObject({
      stage: "installer",
      target: "1.2.3",
      exitCode: 19,
      stderr: "bash failed",
    })
  })

  test("returns executable-probe failure for spawn, exit, and malformed-output observations", async () => {
    const spawn = await failure("1.2.3", [success("script"), success("installer"), new Error("executable missing")])
    expect(spawn.data).toMatchObject({
      stage: "executable_probe",
      target: "1.2.3",
      executable: process.execPath,
      exitCode: null,
    })

    const exit = await failure("1.2.3", [
      success("script"),
      success("installer"),
      { exitCode: 126, stdout: "", stderr: "denied" },
    ])
    expect(exit.data).toMatchObject({
      stage: "executable_probe",
      exitCode: 126,
      stderr: "denied",
    })

    for (const output of ["", "opencorvus 1.2.3", "1.2.3\nextra", "not-a-version"]) {
      const malformed = await failure("1.2.3", [success("script"), success("installer"), success(output)])
      expect(malformed.data).toMatchObject({
        stage: "executable_probe",
        target: "1.2.3",
        stdout: output,
      })
    }
  })

  test("returns a typed mismatch with both requested and observed exact versions", async () => {
    const error = await failure("1.2.3", [success("script"), success("installer"), success("1.2.2\n")])

    expect(error.data).toMatchObject({
      stage: "version_mismatch",
      target: "1.2.3",
      observedVersion: "1.2.2",
      executable: process.execPath,
      exitCode: 0,
    })
  })

  test("accepts repository release prereleases only by complete normalized equality", async () => {
    const receipt = await Installation.upgradeWithRunnerForTest(
      "native",
      "v1.2.3-beta.1",
      runner([success("script"), success("installer"), success("1.2.3-beta.1\n")]),
    )
    expect(receipt.observedVersion).toBe("1.2.3-beta.1")

    const invalid = await failure("release-1.2.3", [])
    expect(invalid.data).toMatchObject({
      stage: "version_mismatch",
      target: "release-1.2.3",
      exitCode: null,
    })

    for (const malformed of ["1.2.3..", "1.2.3-alpha..beta", "01.2.3", "1.2.3-."]) {
      const error = await failure(malformed, [])
      expect(error.data).toMatchObject({ stage: "version_mismatch", target: malformed })
    }
  })
})
