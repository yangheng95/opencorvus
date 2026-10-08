import { expect, test } from "bun:test"
import { ProcessDeadlineExceededError } from "@opencorvus-ai/util/process"
import { supervisedHostProcessFacade } from "../src/util/process-facade"

test("foreground facade returns the root's real exit after settling its owned child tree", async () => {
  const result = await supervisedHostProcessFacade("foreground-facade-root-exit", true).run({
    command: {
      executable: process.execPath,
      args: ["-e", "const {spawn}=require('node:child_process');const child=spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{stdio:'ignore'});process.stdout.write('owned-child:'+child.pid+'\\n');setTimeout(()=>process.exit(7),100)"],
    },
    cwd: process.cwd(),
    occurrenceID: "foreground-root-exit-seven",
    deadlineAt: Date.now() + 10_000,
    nothrow: true,
  })
  expect(result.receipt).toMatchObject({ occurrenceID: "foreground-root-exit-seven", reason: "exited", exitCode: 7 })
  expect(new TextDecoder().decode(result.stdout)).toMatch(/owned-child:[1-9][0-9]*\n/)
}, 20_000)

test("foreground facade settles an output-active child tree at its request deadline and its peer naturally", async () => {
  const deadline = supervisedHostProcessFacade("foreground-facade-deadline", true).run({
    command: {
      executable: process.execPath,
      args: ["-e", "const {spawn}=require('node:child_process');const child=spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{stdio:'ignore'});process.stdout.write('owned-child:'+child.pid+'\\n');setInterval(()=>process.stdout.write('active-byte\\n'),30)"],
    },
    cwd: process.cwd(),
    occurrenceID: "foreground-active-deadline",
    deadlineAt: Date.now() + 2500,
  }).catch((error: unknown) => {
    if (!(error instanceof ProcessDeadlineExceededError)) throw error
    return error.result!
  })
  const peer = supervisedHostProcessFacade("foreground-facade-peer", true).run({
    command: { executable: process.execPath, args: ["-e", "process.stdout.write('actual-peer-output')"] },
    cwd: process.cwd(),
    occurrenceID: "foreground-natural-peer",
    deadlineAt: Date.now() + 10_000,
  })
  const [deadlineResult, peerResult] = await Promise.all([deadline, peer])
  expect(deadlineResult.receipt).toMatchObject({ occurrenceID: "foreground-active-deadline", reason: "deadline_exceeded" })
  expect(new TextDecoder().decode(deadlineResult.stdout)).toMatch(/owned-child:[1-9][0-9]*\n(?:active-byte\n)+/)
  expect(peerResult.receipt).toMatchObject({ occurrenceID: "foreground-natural-peer", reason: "exited", exitCode: 0 })
  expect(new TextDecoder().decode(peerResult.stdout)).toBe("actual-peer-output")
}, 20_000)
