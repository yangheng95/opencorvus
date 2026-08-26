import { ADAPTER_HINT, bootstrapChannelRuntime } from "./bootstrap"
import { applyBundledEnv } from "./bundled-env"
import { resolveRuntimeConfig } from "./runtime-config"

const bundled = await applyBundledEnv()
if (bundled.expired) {
  console.warn(
    `[ChannelRuntime] Bundled env expired at ${bundled.expireAt}. Configure your own packages/channel-runtime/.env to continue.`,
  )
} else if (bundled.enabled) {
  console.log(
    `[ChannelRuntime] Bundled env active until ${bundled.expireAt} (applied ${bundled.applied}, user overrides ${bundled.skipped}).`,
  )
} else if (bundled.reason === "invalid_bundle") {
  console.warn(`[ChannelRuntime] Ignore invalid bundled env file: ${bundled.file}`)
}

const runtimeConfig = resolveRuntimeConfig(
  process.env.OPENCORVUS_CONFIG_CONTENT,
  process.env.OPENCORVUS_CHANNEL_PERMISSION_PROFILE,
)
process.env.OPENCORVUS_CONFIG_CONTENT = JSON.stringify(runtimeConfig.config)
console.log(`[ChannelRuntime] Permission profile: ${runtimeConfig.profile}`)

console.log(
  "[ChannelRuntime] Model/provider config source: opencorvus auth + opencorvus.jsonc + OPENCORVUS_CONFIG_CONTENT",
)

// One composition root, shared with the in-process runtime OpenCorvus starts.
const { runtime, adapterNames } = await bootstrapChannelRuntime({
  env: process.env,
  onDiagnostic: (message) => console.log(`[ChannelRuntime] ${message}`),
})

if (adapterNames.length === 0) {
  console.error(`No chat channel configured. ${ADAPTER_HINT}`)
  process.exit(1)
}
console.log(`[ChannelRuntime] Registered chat channels: ${adapterNames.join(", ")}`)

const receipt = await runtime.start()
console.log(`Channel runtime is running: ${receipt.channels.join(", ")}`)

// Auto-inject test prompt if TEST_PROMPT env var is set
if (process.env.TEST_PROMPT) {
  const channel = process.env.SLACK_CHANNEL_ID!
  console.log(`[Test] Injecting prompt into channel ${channel}`)
  runtime
    .injectPrompt("slack", channel, process.env.TEST_PROMPT)
    .catch((err) => console.error("[Test] injectPrompt failed:", err))
}
