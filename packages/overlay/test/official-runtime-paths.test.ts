import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import path from "node:path"

const main = readFileSync(path.resolve(import.meta.dir, "../src-tauri/src/main.rs"), "utf8")

function sourceBetween(start: string, end: string) {
  const startIndex = main.indexOf(start)
  const endIndex = main.indexOf(end, startIndex)
  expect(startIndex).toBeGreaterThanOrEqual(0)
  expect(endIndex).toBeGreaterThan(startIndex)
  return main.slice(startIndex, endIndex)
}

describe("official overlay runtime paths", () => {
  test("default paths and explicit override resolve one complete root", () => {
    const resolver = sourceBetween("impl OverlayRuntimePaths", "fn embedded_server_payload_dir_name")

    expect(resolver).toContain('std::env::var_os("LOCALAPPDATA")')
    expect(resolver).toContain('std::env::var_os("XDG_DATA_HOME")')
    expect(resolver).toContain('std::env::var_os("OPENCORVUS_HOME")')
    expect(resolver).toContain('root.join("config")')
    expect(resolver).toContain('root.join("data")')
    expect(resolver).toContain('root.join("log")')
    expect(resolver).toContain('root.join("overlay")')
    expect(resolver).toContain("root.is_absolute()")
    expect(main).toContain(".data_directory(runtime_paths.webview_dir)")
    expect(main).toContain("overlay_runtime_paths(app).map")
  })

  test("managed startup has one embedded server source", () => {
    const startup = sourceBetween("fn start_server", "fn restart_server")

    expect(startup).toContain("ensure_embedded_server_path(&runtime_paths)?")
    expect(startup).toContain('.arg("--managed-scope")')
    expect(startup).toContain('.arg("--parent-pid")')
    expect(startup).toContain("std::process::id().to_string()")
    expect(startup).toContain("runtime_paths.data_dir")
    expect(startup).toContain('.env("OPENCORVUS_HOME", &runtime_paths.root)')
    expect(startup).toContain("lock.payload_lease = Some(resolved_server.lease)")
    expect(main).not.toContain("candidate_server_paths")
    expect(main).not.toContain("fn server_path")
    expect(main).not.toContain("std::env::current_exe()")
  })

  test("embedded payload publication precedes lease-proven non-blocking collection", () => {
    const payload = sourceBetween("fn embedded_server_payload_dir_name", "fn server_info_with_pid_and_log")
    const ensure = sourceBetween("fn ensure_embedded_server_path", "fn server_info_with_pid_and_log")

    expect(payload).toContain("EMBEDDED_PAYLOAD_COMPLETE_FILE")
    expect(payload).toContain("fs::rename(&unpublished, &root)")
    expect(payload).toContain("immutable embedded payload directory is incomplete")
    expect(payload).toContain("acquire_embedded_payload_lifecycle_lock(parent)")
    expect(payload).toContain("acquire_embedded_payload_lease(parent, &payload_dir_name)")
    expect(payload).toContain("FileExt::try_lock(&lease_file)")
    expect(payload).toContain("Err(TryLockError::WouldBlock) => continue")
    expect(payload).toContain("Err(err) if err.kind() == std::io::ErrorKind::NotFound => continue")
    expect(payload).toContain("collect_stale_embedded_payloads(parent, &payload_dir_name)")
    expect(payload).not.toContain("cleanup_stale_embedded_sidecars")
    expect(payload).not.toContain("prepare_embedded_payload_parent_for_publication")
    expect(payload).not.toContain("has no ownership lease")
    expect(ensure.indexOf("fs::rename(&unpublished, &root)")).toBeLessThan(
      ensure.indexOf("collect_stale_embedded_payloads(parent, &payload_dir_name)?"),
    )
    expect(ensure.indexOf("acquire_embedded_payload_lease(parent, &payload_dir_name)?")).toBeLessThan(
      ensure.indexOf("collect_stale_embedded_payloads(parent, &payload_dir_name)?"),
    )
  })

  test("managed server settlement releases its exact payload lease", () => {
    const stop = sourceBetween("fn stop_server", "fn server_shutdown_authorization")
    const ensure = sourceBetween("fn ensure_server", "fn overlay_server_info")

    expect(stop).toContain("lock.payload_lease = None")
    expect(ensure).toContain("lock.payload_lease = None")
  })

  test("Windows Job Object assignment is checked and startup reaps on failure", () => {
    expect(main).toContain("AssignProcessToJobObject(job, child_handle)")
    expect(main).toContain("if assigned == 0")
    expect(main).toContain("Result<JobObject, String>")
    expect(main).toContain("failed to establish Windows sidecar process-tree ownership")
    expect(main).toContain("let wait_result = match child.wait()")
    expect(main).not.toContain("job object unavailable; grandchild processes may linger")
  })

  test("sidecar log initialization cannot continue with null stdio", () => {
    const stdio = sourceBetween("fn sidecar_stdio_targets", "fn start_server")

    expect(stdio).toContain("Result<(Stdio, Stdio, PathBuf), String>")
    expect(stdio).not.toContain("Stdio::null()")
    expect(stdio).not.toContain("return (")
    expect(stdio).not.toContain("unwrap_or")
  })
})
