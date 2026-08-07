// ── ConnectionBanner ──
// Floating banner that separately surfaces sustained backend and Server-Sent
// Events (SSE) failures instead of describing every outage as stream setup.
//
// Hide rules: the banner only appears once the offline state has lasted
// more than `OFFLINE_GRACE_MS` so transient reconnects (the SSE retry loop
// in services/sse.ts:79 pings every 2s) don't flash a banner on every blip.

import { Show, createMemo, createEffect, onCleanup } from "solid-js"
import { messageStore } from "../store/messages"
import { appStore } from "../store/app"
import { openConfigDialog } from "../services/config-dialog-control"
import { t } from "../utils/i18n"
import { useDisclosure } from "../solid/disclosure"
import { Button } from "./ui/Button"

const OFFLINE_GRACE_MS = 2500

export function ConnectionBanner() {
  const problem = createMemo(() => {
    if (appStore.connectionStatus !== "online") {
      return {
        kind: "backend",
        text:
          appStore.connectionStatus === "connecting"
            ? t("connection.banner_backend_connecting")
            : t("connection.banner_backend_offline"),
      } as const
    }
    if (messageStore.sseExpected && !messageStore.sseConnected) {
      return { kind: "stream", text: t("connection.banner_stream_connecting") } as const
    }
    return undefined
  })

  const banner = useDisclosure()
  let timer: any = null

  createEffect(() => {
    const current = problem()
    if (timer) {
      clearTimeout(timer)
      timer = null
    }
    if (!current) {
      banner.close()
      return
    }
    timer = setTimeout(() => banner.openIt(), OFFLINE_GRACE_MS)
  })

  onCleanup(() => {
    if (timer) clearTimeout(timer)
  })

  const reload = () => {
    if (typeof location !== "undefined") location.reload()
  }

  return (
    <Show when={banner.open()}>
      <div class="conn-banner" role="status" aria-live="polite" data-status={problem()?.kind}>
        <span class="conn-banner__dot" aria-hidden="true" />
        <span class="conn-banner__text">{problem()?.text}</span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          tone="neutral"
          onClick={() => openConfigDialog("general")}
          title={t("titlebar.connection_diagnostics")}
          data-ui="connection-banner-setup"
          data-testid="connection-banner-setup"
        >
          {t("titlebar.setup")}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          tone="neutral"
          onClick={reload}
          title={t("connection.banner_reload_title")}
          data-ui="connection-banner-reload"
        >
          {t("connection.banner_reload")}
        </Button>
      </div>
    </Show>
  )
}
