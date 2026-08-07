import { BusEvent } from "@/bus/bus-event"
import z from "zod"

export const Event = {
  Connected: BusEvent.define("server.connected", z.object({})),
  Heartbeat: BusEvent.define("server.heartbeat", z.object({})),
  Disposed: BusEvent.define("global.disposed", z.object({})),
}

export function payload<Definition extends BusEvent.Definition>(
  def: Definition,
  properties: z.output<Definition["properties"]>,
) {
  return {
    type: def.type,
    properties: BusEvent.parseProperties(def, properties),
  }
}

export function globalEnvelope<Definition extends BusEvent.Definition>(
  directory: string,
  def: Definition,
  properties: z.output<Definition["properties"]>,
) {
  return {
    directory,
    payload: payload(def, properties),
  }
}
