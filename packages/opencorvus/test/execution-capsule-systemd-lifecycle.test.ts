import { expect, test } from "bun:test"
import { userSystemdRuntimeAvailable } from "./fixture/linux-runtime"

const probe = String.raw`
set -eu
controller=opencorvus-controller-lifecycle-contract.scope
task=opencorvus-task-lifecycle-contract.service
systemctl --user stop "$task" "$controller" >/dev/null 2>&1 || true
systemd-run --user --scope --unit="$controller" --quiet /bin/sleep 2 &
controller_process=$!
for _ in $(seq 1 50); do
  state=$(systemctl --user show "$controller" -p ActiveState --value 2>/dev/null || true)
  [ "$state" = active ] && break
  sleep .1
done
systemd-run --user --unit="$task" --quiet \
  --property="BindsTo=$controller" \
  --property="After=$controller" \
  --property=KillMode=control-group \
  --property=CollectMode=inactive-or-failed \
  /bin/sleep 30
wait "$controller_process"
for _ in $(seq 1 50); do
  state=$(systemctl --user show "$task" -p ActiveState --value 2>/dev/null || true)
  [ "$state" = inactive ] && break
  sleep .1
done
systemctl --user show "$task" -p ActiveState -p SubState -p Result -p MainPID -p ControlGroup --no-pager | sort
systemctl --user show "$controller" -p ActiveState -p SubState --no-pager | sort
`

const systemdTest = userSystemdRuntimeAvailable() ? test : test.skip

systemdTest("controller scope termination settles its bound Task service", async () => {
  const command =
    process.platform === "win32"
      ? ["wsl.exe", "-d", "Ubuntu-24.04", "--exec", "/bin/bash", "-lc", probe]
      : ["/bin/bash", "-lc", probe]
  const processHandle = Bun.spawn(command, { stdout: "pipe", stderr: "pipe" })
  const [exitCode, stdout, stderr] = await Promise.all([
    processHandle.exited,
    new Response(processHandle.stdout).text(),
    new Response(processHandle.stderr).text(),
  ])
  expect({ exitCode, stderr, stdout }).toEqual({
    exitCode: 0,
    stderr: "",
    stdout: [
      "ActiveState=inactive",
      "ControlGroup=",
      "MainPID=0",
      "Result=success",
      "SubState=dead",
      "ActiveState=inactive",
      "SubState=dead",
      "",
    ].join("\n"),
  })
}, 15_000)
