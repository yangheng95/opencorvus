import { describe, expect, test } from "bun:test"
import {
  applyProviderForm,
  providerFormValues,
  providerModelIDs,
  validateProviderFormApi,
} from "../src/services/provider-form"

const original = {
  name: "Local catalog",
  api: "http://127.0.0.1:17879/v1",
  npm: "@ai-sdk/openai-compatible",
  env: ["LOCAL_MODEL_KEY", "ALTERNATE_MODEL_KEY"],
  whitelist: ["qwen3-next:80b"],
  options: { timeout: 42000, headers: { "x-local-route": "audit" } },
  models: {
    "qwen3-next:80b": {
      name: "Qwen 80B",
      tool_call: false,
      limit: { context: 123456, output: 4096 },
      variants: { careful: { reasoningEffort: "high" } },
      cost: { input: 0, output: 0 },
    },
  },
}

describe("provider declaration edits", () => {
  test("validates explicit HTTP endpoints with standard host and port parsing", () => {
    for (const [raw, value] of [
      [" HTTPS://example.com/v1/// ", "HTTPS://example.com/v1"],
      ["http://localhost:17879/v1", "http://localhost:17879/v1"],
      ["http://[::1]:17879/v1/", "http://[::1]:17879/v1"],
      ["https://例子.测试/接口?region=cn", "https://例子.测试/接口?region=cn"],
    ]) {
      expect(validateProviderFormApi(raw)).toEqual({ ok: true, changed: true, value })
    }
  })

  test("maps malformed explicit endpoints to the form error contract", () => {
    for (const [api, code] of [
      [" ", "PROVIDER_API_REQUIRED"],
      ["not-a-url", "PROVIDER_API_INVALID"],
      ["ftp://example.com/v1", "PROVIDER_API_INVALID"],
      ["https://", "PROVIDER_API_INVALID"],
      ["https://[::1", "PROVIDER_API_INVALID"],
      ["http://localhost:70000/v1", "PROVIDER_API_INVALID"],
      ["https:example.com/v1", "PROVIDER_API_INVALID"],
      ["https://sample-user@example.com/v1", "PROVIDER_API_INVALID"],
    ]) {
      expect(validateProviderFormApi(api)).toEqual({ ok: false, changed: true, code })
      let outcome: unknown
      try {
        outcome = applyProviderForm({
          id: "local",
          current: undefined,
          initial: null,
          values: { name: "Local", api, env: "", models: "local:latest" },
        })
      } catch (error) {
        outcome = error
      }
      expect(outcome).toMatchObject({ name: "ProviderFormApiError", code })
      try {
        outcome = applyProviderForm({
          id: "local",
          current: original,
          initial: providerFormValues(original),
          values: { ...providerFormValues(original), api },
        })
      } catch (error) {
        outcome = error
      }
      expect(outcome).toMatchObject({ name: "ProviderFormApiError", code })
    }
  })

  test("preserves current endpoint ownership when only another field was edited", () => {
    for (const definition of [
      { name: "Inherited", models: original.models },
      { ...original, api: "https://${PROVIDER_HOST}/v1" },
    ]) {
      const initial = providerFormValues(definition)
      const current = { ...definition, api: "https://current.example/v1" }
      expect(validateProviderFormApi(initial.api, initial.api)).toEqual({
        ok: true,
        changed: false,
        value: initial.api,
      })
      expect(applyProviderForm({ id: "local", current, initial, values: { ...initial, name: "Renamed" } })).toEqual({
        ...current,
        name: "Renamed",
      })
      expect(
        applyProviderForm({ id: "local", current: definition, initial, values: { ...initial, name: "Renamed" } }),
      ).toEqual({
        ...definition,
        name: "Renamed",
      })
    }
  })

  test("applies a valid explicit endpoint correction to the latest definition", () => {
    const current = { ...original, api: "not-a-url" }
    const initial = providerFormValues(current)
    expect(
      applyProviderForm({ id: "local", current, initial, values: { ...initial, api: "http://localhost:17879/v1/" } }),
    ).toEqual({
      ...current,
      api: "http://localhost:17879/v1",
    })
  })

  test("projects all environment names and exact model identities", () => {
    expect(providerFormValues(original)).toEqual({
      name: "Local catalog",
      api: "http://127.0.0.1:17879/v1",
      env: "LOCAL_MODEL_KEY, ALTERNATE_MODEL_KEY",
      models: "qwen3-next:80b",
    })
    expect(providerModelIDs(" qwen3-next:80b\r\nqwen3-next:80b\norg/model:tag\n")).toEqual([
      "qwen3-next:80b",
      "org/model:tag",
    ])
  })

  test("changes the submitted name while preserving current runtime metadata", () => {
    const initial = providerFormValues(original)
    const current = { ...original, options: { ...original.options, timeout: 73000 } }
    expect(applyProviderForm({ id: "local", current, initial, values: { ...initial, name: "Renamed" } })).toEqual({
      ...current,
      name: "Renamed",
    })
    expect(current).toEqual({ ...original, options: { ...original.options, timeout: 73000 } })
  })

  test("retains concurrent edits to untouched fields and model metadata", () => {
    const initial = providerFormValues(original)
    const current = {
      ...original,
      api: "http://127.0.0.1:17879/new/v1",
      env: ["NEW_MODEL_KEY"],
      models: { ...original.models, "new:latest": { name: "Concurrent model", tool_call: false } },
    }
    expect(applyProviderForm({ id: "local", current, initial, values: { ...initial, name: "Changed" } })).toEqual({
      ...current,
      name: "Changed",
    })
  })

  test("merges explicit model additions and removals with concurrent catalog changes", () => {
    const initial = providerFormValues(original)
    const current = { ...original, models: { ...original.models, "peer:latest": { name: "Peer", tool_call: false } } }
    expect(applyProviderForm({ id: "local", current, initial, values: { ...initial, models: "new:80b" } })).toEqual({
      ...current,
      models: {
        "peer:latest": { name: "Peer", tool_call: false },
        "new:80b": { name: "new:80b", tool_call: true },
      },
    })
    expect(current.models).toEqual({ ...original.models, "peer:latest": { name: "Peer", tool_call: false } })
  })

  test("creates new models with exact identifiers and all submitted environment names", () => {
    expect(
      applyProviderForm({
        id: "local",
        current: undefined,
        initial: null,
        values: { name: "", api: " http://127.0.0.1:17879/v1/// ", env: "FIRST, SECOND, FIRST", models: "qwen:80b" },
      }),
    ).toEqual({
      name: "local",
      api: "http://127.0.0.1:17879/v1",
      env: ["FIRST", "SECOND"],
      models: { "qwen:80b": { name: "qwen:80b", tool_call: true } },
    })
  })

  test("applies explicit endpoint and environment edits while retaining a peer model removal", () => {
    const initial = providerFormValues(original)
    const current = { ...original, models: { "peer:latest": { name: "Peer", tool_call: false } } }
    expect(
      applyProviderForm({
        id: "local",
        current,
        initial,
        values: { ...initial, api: "http://127.0.0.1:17879/revised/", env: "", models: `${initial.models}\nnew:80b` },
      }),
    ).toEqual({
      ...current,
      api: "http://127.0.0.1:17879/revised",
      env: [],
      models: {
        "peer:latest": { name: "Peer", tool_call: false },
        "new:80b": { name: "new:80b", tool_call: true },
      },
    })
  })

  test("maps stale provider identity to an explicit conflict contract", () => {
    const initial = providerFormValues(original)
    for (const [current, baseline, code] of [
      [original, null, "PROVIDER_ALREADY_EXISTS"],
      [undefined, initial, "PROVIDER_REMOVED"],
    ] as const) {
      let outcome: unknown
      try {
        outcome = applyProviderForm({ id: "local", current, initial: baseline, values: initial })
      } catch (error) {
        outcome = error
      }
      expect(outcome).toMatchObject({ name: "ProviderFormConflictError", code })
    }
  })
})
