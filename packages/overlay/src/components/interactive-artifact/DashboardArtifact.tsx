import { For, Show, createMemo, createSignal } from "solid-js"
import type { InteractiveArtifactPayload } from "../../services/interactive-artifact"
import { localeTag, t } from "../../utils/i18n"
import { ArtifactFrame } from "./ArtifactFrame"
import { createInlineVegaView } from "./inline-vega-view"
import { SelectControl } from "../ui/SelectControl"

type DashboardPayload = Extract<InteractiveArtifactPayload, { renderer: "dashboard@1" }>
type DashboardViewPayload = DashboardPayload["views"][number]
type DashboardRow = DashboardPayload["data"][number]
type DashboardFilter = DashboardPayload["filters"][number]
type DashboardFilterOption = { id: string; label: string; value: DashboardRow[string] | undefined }

const MAX_DASHBOARD_WIDTH = 1_600
const MIN_DASHBOARD_PLOT_WIDTH = 240
const VEGA_AXIS_AND_ACTIONS_WIDTH = 128

function DashboardView(props: { view: DashboardViewPayload; data: DashboardRow[] }) {
  let host: HTMLDivElement | undefined
  const [error, setError] = createSignal("")
  createInlineVegaView({
    host: () => host,
    observed: () => host?.parentElement ?? undefined,
    source: () => props.view.spec,
    data: () => props.data,
    measure: () => {
      const width = Math.min(Math.floor(host?.parentElement?.clientWidth ?? 0), MAX_DASHBOARD_WIDTH)
      return { width: width > 0 ? Math.max(MIN_DASHBOARD_PLOT_WIDTH, width - VEGA_AXIS_AND_ACTIONS_WIDTH) : 0, height: 260 }
    },
    error: setError,
    ready: (element, ready) => {
      if (ready) element.dataset.ready = "true"
      else delete element.dataset.ready
    },
  })
  return (
    <section class="msg-artifact-dashboard__view" data-span={props.view.span} aria-label={props.view.title}>
      <h4>{props.view.title}</h4>
      <div class="msg-artifact-dashboard__chart msg-artifact-vega" ref={host} hidden={!!error()} />
      <Show when={error()}>{message => <div class="msg-artifact-render-error">{message()}</div>}</Show>
    </section>
  )
}

function DashboardFilterControl(props: {
  filter: DashboardFilter
  selected: DashboardRow[string] | undefined
  onChange: (value: DashboardRow[string] | undefined) => void
}) {
  const options = createMemo<DashboardFilterOption[]>(() => [
    { id: "all", label: t("artifact.dashboard.all"), value: undefined },
    ...props.filter.values.map((value, index) => ({ id: String(index), label: String(value), value })),
  ])
  const selectedOption = createMemo(
    () => options().find((option) => Object.is(option.value, props.selected)) ?? options()[0]!,
  )

  return (
    <label>
      <span>{props.filter.label}</span>
      <SelectControl<DashboardFilterOption>
        class="msg-artifact-dashboard__filter-control"
        options={options()}
        value={selectedOption()}
        onChange={(option) => props.onChange(option?.value)}
        optionValue="id"
        optionTextValue="label"
        renderValue={(option) => option?.label ?? t("artifact.dashboard.all")}
        renderOptionLabel={(option) => option.label}
        ariaLabel={props.filter.label}
        disallowEmptySelection
      />
    </label>
  )
}

export function DashboardArtifact(props: { payload: DashboardPayload }) {
  const numbers = createMemo(() => new Intl.NumberFormat(localeTag(), { maximumFractionDigits: 20 }))
  const percentages = createMemo(() => new Intl.NumberFormat(localeTag(), { style: "percent", maximumFractionDigits: 1 }))
  const [filters, setFilters] = createSignal<Record<string, DashboardRow[string] | undefined>>({})
  const filtered = createMemo(() =>
    props.payload.data.filter((row) =>
      props.payload.filters.every((filter) => {
        const selected = filters()[filter.id]
        return selected === undefined || Object.is(row[filter.field], selected)
      }),
    ),
  )

  return (
    <ArtifactFrame payload={props.payload} title={props.payload.title} kind="Dashboard">
      <div class="msg-artifact-dashboard">
        <Show when={props.payload.metrics.length}>
          <div class="msg-artifact-dashboard__metrics">
            <For each={props.payload.metrics}>
              {(metric) => (
                <div class="msg-artifact-dashboard__metric" data-metric-id={metric.id}>
                  <span>{metric.label}</span>
                  <strong>
                    {typeof metric.value === "number" ? numbers().format(metric.value) : metric.value}
                    {metric.unit ? ` ${metric.unit}` : ""}
                  </strong>
                  <Show when={metric.delta !== undefined}>
                    <small data-direction={metric.delta! < 0 ? "down" : "up"}>
                      {metric.delta! > 0 ? "+" : ""}
                      {percentages().format(metric.delta!)}
                    </small>
                  </Show>
                </div>
              )}
            </For>
          </div>
        </Show>
        <Show when={props.payload.filters.length}>
          <div class="msg-artifact-dashboard__filters">
            <For each={props.payload.filters}>
              {(filter) => (
                <DashboardFilterControl
                  filter={filter}
                  selected={filters()[filter.id]}
                  onChange={(value) => setFilters((current) => ({ ...current, [filter.id]: value }))}
                />
              )}
            </For>
          </div>
        </Show>
        <div class="msg-artifact-dashboard__views">
          <For each={props.payload.views}>{(view) => <DashboardView view={view} data={filtered()} />}</For>
        </div>
      </div>
    </ArtifactFrame>
  )
}
