import path from "node:path"
import { describe, expect, test } from "bun:test"
import { ExecutionCapsuleRuntimeDescriptorSchema } from "@/execution-capsule/runtime"

const SHA256 = "a".repeat(64)
const absolute = (name: string) => path.resolve("execution-capsule-runtime", name)

describe("Task Execution Capsule runtime descriptor", () => {
  test("accepts the complete current runtime authority", () => {
    const descriptor = {
      schema_version: 1 as const,
      protocol: "opencorvus.task-execution-capsule.runtime.v1" as const,
      runtime_identity_sha256: SHA256,
      server_runtime_tree_sha256: SHA256,
      package_tool_inactivity_ms: 30_000,
      controller_unit: "opencorvus-controller-runtime.service",
      outer_source_root: absolute("source"),
      outer_visible_root: absolute("visible"),
      systemd_run: { path: absolute("systemd-run"), sha256: SHA256 },
      systemctl: { path: absolute("systemctl"), sha256: SHA256 },
      runc: { path: absolute("runc"), sha256: SHA256 },
      node: { path: absolute("node"), sha256: SHA256 },
      ripgrep: { path: absolute("ripgrep"), sha256: SHA256 },
      toolchain: { broker_root: absolute("toolchain"), tree_sha256: SHA256 },
      secret_environment_names: ["PROVIDER_TOKEN"],
      child_environment_names: [],
      network: { default: "none" as const },
      resources: {
        memory_max_bytes: 1_073_741_824,
        tasks_max: 256,
        nofile_max: 4_096,
        tmpfs_max_bytes: 268_435_456,
        cpu_quota_percent: 100,
      },
    }

    expect(ExecutionCapsuleRuntimeDescriptorSchema.parse(descriptor)).toEqual(descriptor)
  })
})
