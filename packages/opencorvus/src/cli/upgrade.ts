import { Bus } from "@/bus"
import { Config } from "@/config/config"
import { Flag } from "@/flag/flag"
import { Installation } from "@/installation"
import { Log } from "@/util/log"

const log = Log.create({ service: "upgrade" })

export async function upgrade() {
  const config = await Config.global()
  const method = await Installation.method()
  const latest = await Installation.latest().catch((err) => {
    log.warn("latest version lookup failed", { method, error: String(err) })
    return undefined
  })
  if (!latest) return
  if (Installation.VERSION === latest) return

  if (config.autoupdate === false || Flag.OPENCORVUS_DISABLE_AUTOUPDATE) {
    return
  }
  if (config.autoupdate === "notify") {
    await Bus.publish(Installation.Event.UpdateAvailable, { version: latest })
    return
  }

  if (method === "unknown") return
  await Installation.upgrade(method, latest)
    .then(() => Bus.publish(Installation.Event.Updated, { version: latest }))
    .catch((err) => {
      log.error("upgrade failed", { method, target: latest, error: String(err) })
    })
}
