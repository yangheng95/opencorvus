import { For, Show, createEffect, createMemo, createSignal, onCleanup } from "solid-js"

import type { OfficialUsageSource, UsagePeriod, UsageStatistics } from "@opencorvus-ai/sdk"

import { UsageServerVersionError, loadUsageStatistics, userTimeZone } from "../../services/usage"
import { formatDetailedCostUSD, formatTokenCount } from "../../utils/format-usage"
import { localeTag, t } from "../../utils/i18n"
import { Button } from "../ui/Button"
import { Icon } from "../ui/Icon"
import { SegmentedControl } from "../ui/SegmentedControl"
import { SettingsPanel, SettingsState } from "./layout"

const PERIODS: UsagePeriod[] = ["day", "week", "month", "year"]

function exactNumber(value: number): string {
  return new Intl.NumberFormat(localeTag(), { maximumFractionDigits: 0 }).format(value)
}

function percent(value: number): string {
  return new Intl.NumberFormat(localeTag(), { maximumFractionDigits: 1 }).format(value) + "%"
}

function dateRange(data: UsageStatistics): string {
  const formatter = new Intl.DateTimeFormat(localeTag(), {
    timeZone: data.timeZone,
    year: "numeric",
    month: "short",
    day: "numeric",
  })
  return `${formatter.format(data.current.start)} – ${formatter.format(data.current.end - 1)}`
}

function comparisonLabel(value: number | null): string {
  if (value === null) return t("usage.comparison_new")
  if (value === 0) return t("usage.comparison_even")
  const sign = value > 0 ? "+" : ""
  return t("usage.comparison_value", { value: `${sign}${percent(value)}` })
}

function bucketLabel(data: UsageStatistics, value: number): string {
  const options: Intl.DateTimeFormatOptions =
    data.grain === "hour"
      ? { hour: "2-digit", minute: "2-digit" }
      : data.grain === "month"
        ? { month: "short" }
        : { month: "short", day: "numeric" }
  return new Intl.DateTimeFormat(localeTag(), { ...options, timeZone: data.timeZone }).format(value)
}

function UsageActivityGrid(props: { data: UsageStatistics }) {
  const peak = createMemo(() => Math.max(0, ...props.data.buckets.map((bucket) => bucket.tokens.total)))
  const labels = createMemo(() => {
    const buckets = props.data.buckets
    if (buckets.length === 0) return []
    const last = buckets.length - 1
    return [...new Set([0, Math.round(last / 3), Math.round((last * 2) / 3), last])].map((index) => ({
      index,
      label: bucketLabel(props.data, buckets[index].start),
    }))
  })
  const level = (tokens: number) => {
    if (tokens === 0 || peak() === 0) return 0
    return Math.max(1, Math.ceil((tokens / peak()) * 4))
  }
  const yearOffset = createMemo(() => {
    if (props.data.period !== "year" || props.data.buckets.length === 0) return 0
    const day = new Intl.DateTimeFormat("en-US", {
      timeZone: props.data.timeZone,
      weekday: "short",
    }).format(props.data.buckets[0].start)
    return ({ Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 } as Record<string, number>)[day] ?? 0
  })

  return (
    <div class="usage-activity" data-ui="usage-token-activity">
      <div
        class={`usage-activity__grid usage-activity__grid--${props.data.period}`}
        role="img"
        aria-label={t("usage.chart_aria")}
      >
        <For each={Array.from({ length: yearOffset() })}>
          {() => <span class="usage-activity__cell usage-activity__cell--spacer" aria-hidden="true" />}
        </For>
        <For each={props.data.buckets}>
          {(bucket) => (
            <span class={`usage-activity__cell usage-activity__cell--${level(bucket.tokens.total)}`}>
              <span class="sr-only">
                {bucketLabel(props.data, bucket.start)} · {exactNumber(bucket.tokens.total)} Token
              </span>
              <span class="usage-activity__tooltip" aria-hidden="true">
                <strong>{exactNumber(bucket.tokens.total)}</strong>
                <small>{bucketLabel(props.data, bucket.start)}</small>
              </span>
            </span>
          )}
        </For>
      </div>
      <div class="usage-activity__labels" aria-hidden="true">
        <For each={labels()}>
          {(item) => (
            <span style={{ left: `${(item.index / Math.max(1, props.data.buckets.length - 1)) * 100}%` }}>
              {item.label}
            </span>
          )}
        </For>
      </div>
      <div class="usage-activity__legend" aria-hidden="true">
        <span>{t("usage.activity_less")}</span>
        <For each={[0, 1, 2, 3, 4]}>
          {(value) => <i class={`usage-activity__cell usage-activity__cell--${value}`} />}
        </For>
        <span>{t("usage.activity_more")}</span>
      </div>
    </div>
  )
}

function TokenComposition(props: { data: UsageStatistics }) {
  const values = createMemo(() => {
    const tokens = props.data.current.summary.tokens
    return [
      { key: "input", label: t("usage.token_input"), value: tokens.input },
      { key: "output", label: t("usage.token_output"), value: tokens.output },
      { key: "reasoning", label: t("usage.token_reasoning"), value: tokens.reasoning },
      { key: "cache", label: t("usage.token_cache"), value: tokens.cacheRead + tokens.cacheWrite },
    ]
  })
  const measured = createMemo(() =>
    Math.max(
      1,
      values().reduce((sum, value) => sum + value.value, 0),
    ),
  )
  return (
    <div class="usage-composition">
      <div class="usage-composition__rail" aria-hidden="true">
        <For each={values()}>
          {(value) => (
            <span
              class={`usage-composition__segment usage-composition__segment--${value.key}`}
              style={{ width: `${(value.value / measured()) * 100}%` }}
            />
          )}
        </For>
      </div>
      <div class="usage-composition__legend">
        <For each={values()}>
          {(value) => (
            <div class="usage-composition__item">
              <span class={`usage-composition__swatch usage-composition__swatch--${value.key}`} />
              <span>{value.label}</span>
              <strong>{exactNumber(value.value)}</strong>
            </div>
          )}
        </For>
      </div>
    </div>
  )
}

function OfficialSourceCard(props: { source: OfficialUsageSource }) {
  const source = () => props.source
  const copy = (field: "label" | "scope" | "freshness") => t(`usage.official_source.${source().id}.${field}`)
  const officialPeriod = () => {
    const period = source().period
    if (!period) return ""
    const formatter = new Intl.DateTimeFormat(localeTag(), {
      timeZone: "UTC",
      year: "numeric",
      month: "short",
      day: "numeric",
    })
    return `${formatter.format(period.start)} – ${formatter.format(period.end - 1)}`
  }
  return (
    <article class="usage-official-card" data-status={source().status}>
      <header>
        <div>
          <strong>{copy("label")}</strong>
          <span>{source().providerID}</span>
        </div>
        <span class="usage-official-card__status">{t(`usage.official_status.${source().status}`)}</span>
      </header>
      <p>{copy("scope")}</p>
      <Show when={source().periodAlignment}>
        <div class="usage-official-card__period">
          <span>{officialPeriod()}</span>
          <strong>{t(`usage.official_alignment.${source().periodAlignment}`)}</strong>
        </div>
      </Show>
      <Show when={source().tokens}>
        {(tokens) => (
          <dl class="usage-official-card__facts">
            <div>
              <dt>{t("usage.official_tokens")}</dt>
              <dd>{exactNumber(tokens().total)}</dd>
            </div>
            <div>
              <dt>{t("usage.official_calls")}</dt>
              <dd>{tokens().calls === null ? t("usage.not_reported") : exactNumber(tokens().calls!)}</dd>
            </div>
            <div>
              <dt>{t("usage.official_cost")}</dt>
              <dd>{source().costUSD === null ? t("usage.not_reported") : formatDetailedCostUSD(source().costUSD!)}</dd>
            </div>
          </dl>
        )}
      </Show>
      <Show when={source().credits}>
        {(credits) => (
          <dl class="usage-official-card__facts">
            <div>
              <dt>{t("usage.credits_purchased")}</dt>
              <dd>{formatDetailedCostUSD(credits().purchasedUSD)}</dd>
            </div>
            <div>
              <dt>{t("usage.credits_used")}</dt>
              <dd>{formatDetailedCostUSD(credits().usedUSD)}</dd>
            </div>
            <div>
              <dt>{t("usage.credits_remaining")}</dt>
              <dd>{formatDetailedCostUSD(credits().remainingUSD)}</dd>
            </div>
          </dl>
        )}
      </Show>
      <Show when={source().keyUsage}>
        {(keys) => (
          <dl class="usage-official-card__facts">
            <div>
              <dt>{t("usage.keys_total")}</dt>
              <dd>{exactNumber(keys().count)}</dd>
            </div>
            <div>
              <dt>{t("usage.keys_active")}</dt>
              <dd>{exactNumber(keys().activeCount)}</dd>
            </div>
            <div>
              <dt>{t("usage.keys_limited")}</dt>
              <dd>{exactNumber(keys().limitedCount)}</dd>
            </div>
            <div>
              <dt>{t("usage.keys_usage_lifetime")}</dt>
              <dd>{formatDetailedCostUSD(keys().usageUSD)}</dd>
            </div>
            <div>
              <dt>{t("usage.keys_usage_month")}</dt>
              <dd>{formatDetailedCostUSD(keys().usageMonthlyUSD)}</dd>
            </div>
            <div>
              <dt>{t("usage.keys_byok_month")}</dt>
              <dd>{formatDetailedCostUSD(keys().byokUsageMonthlyUSD)}</dd>
            </div>
          </dl>
        )}
      </Show>
      <Show when={source().reconciliation}>
        {(comparison) => (
          <div class="usage-official-card__reconciliation">
            <span>{t("usage.reconciliation_delta")}</span>
            <strong>
              {comparison().tokenDelta > 0 ? "+" : ""}
              {exactNumber(comparison().tokenDelta)} Token
            </strong>
            <small>{t("usage.never_summed")}</small>
          </div>
        )}
      </Show>
      <Show when={source().message}>
        <span class="usage-official-card__message">{source().message}</span>
      </Show>
      <footer>
        <span>{copy("freshness")}</span>
        <a href={source().documentationURL} target="_blank" rel="noreferrer">
          {t("usage.official_docs")}
          <Icon name="channel-link" size="compact" />
        </a>
      </footer>
    </article>
  )
}

export default function UsagePanel() {
  const [period, setPeriod] = createSignal<UsagePeriod>("month")
  const [revision, setRevision] = createSignal(0)
  const [data, setData] = createSignal<UsageStatistics>()
  const [loading, setLoading] = createSignal(true)
  const [error, setError] = createSignal("")
  const timeZone = userTimeZone()

  createEffect(() => {
    const requestedPeriod = period()
    revision()
    const controller = new AbortController()
    setLoading(true)
    setError("")
    setData(undefined)
    loadUsageStatistics({ period: requestedPeriod, timeZone, signal: controller.signal })
      .then((result) => setData(result))
      .catch((reason) => {
        if (controller.signal.aborted) return
        setError(
          reason instanceof UsageServerVersionError
            ? t("usage.server_restart_required")
            : reason instanceof Error
              ? reason.message
              : String(reason),
        )
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    onCleanup(() => controller.abort())
  })

  const summary = createMemo(() => data()?.current.summary)
  const pricingCoverage = createMemo(() => summary()?.billing.percent)
  const peakBucket = createMemo(() => Math.max(0, ...(data()?.buckets ?? []).map((bucket) => bucket.tokens.total)))
  const visibleOfficialSources = createMemo(
    () => data()?.official.sources.filter((source) => source.status !== "unconfigured") ?? [],
  )

  return (
    <SettingsPanel class="usage-panel" data-ui="usage-panel">
      <section class="usage-hero">
        <div class="usage-hero__copy">
          <div class="usage-eyebrow">{t("usage.eyebrow")}</div>
          <p>{t("usage.description")}</p>
        </div>
        <div class="usage-hero__controls">
          <SegmentedControl
            value={period()}
            options={PERIODS.map((value) => ({ value, label: t(`usage.period.${value}`) }))}
            ariaLabel={t("usage.period_aria")}
            size="sm"
            onChange={setPeriod}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            tone="neutral"
            class="usage-refresh"
            aria-label={t("usage.refresh")}
            title={t("usage.refresh")}
            disabled={loading()}
            onClick={() => setRevision((value) => value + 1)}
          >
            <Icon name={loading() ? "loading" : "refresh"} class={loading() ? "is-spinning" : undefined} />
          </Button>
        </div>
      </section>

      <Show when={error()}>
        <SettingsState
          tone="error"
          class="usage-error"
          title={t("usage.load_failed")}
          actions={
            <Button
              type="button"
              variant="outline"
              size="sm"
              tone="neutral"
              onClick={() => setRevision((value) => value + 1)}
            >
              {t("usage.retry")}
            </Button>
          }
        >
          {error()}
        </SettingsState>
      </Show>

      <Show when={data()}>
        {(resolved) => (
          <>
            <section class="usage-total" aria-live="polite">
              <span class="usage-total__label">{t("usage.total_tokens")}</span>
              <strong>{formatTokenCount(resolved().current.summary.tokens.total)}</strong>
              <span class="usage-total__comparison">{comparisonLabel(resolved().comparison.tokensPercent)}</span>
              <div class="usage-period-meta">
                <span>{dateRange(resolved())}</span>
                <span>{resolved().timeZone}</span>
                <span>{t("usage.event_time_note")}</span>
              </div>
            </section>

            <section class="usage-metrics" aria-label={t("usage.summary_aria")}>
              <article class="usage-metric">
                <strong>{exactNumber(resolved().current.summary.tokens.total)}</strong>
                <span class="usage-metric__label">{t("usage.measured_tokens")}</span>
              </article>
              <article class="usage-metric">
                <strong>{formatTokenCount(peakBucket())}</strong>
                <span class="usage-metric__label">{t("usage.peak_tokens")}</span>
              </article>
              <article class="usage-metric">
                <strong>{formatDetailedCostUSD(resolved().current.summary.costUSD)}</strong>
                <span class="usage-metric__label">{t("usage.cost")}</span>
              </article>
              <article class="usage-metric">
                <strong>{exactNumber(resolved().current.summary.calls)}</strong>
                <span class="usage-metric__label">{t("usage.calls")}</span>
              </article>
              <article class="usage-metric">
                <strong>{pricingCoverage() === null ? "—" : percent(pricingCoverage()!)}</strong>
                <span class="usage-metric__label">{t("usage.pricing_coverage")}</span>
              </article>
            </section>

            <section class="usage-section usage-section--official">
              <header class="usage-section__head">
                <div>
                  <h2>{t("usage.official_title")}</h2>
                  <p>{t("usage.official_description")}</p>
                </div>
                <span class="usage-section__meta">{t("usage.compare_only")}</span>
              </header>
              <div class="usage-official-grid">
                <For each={visibleOfficialSources()}>{(source) => <OfficialSourceCard source={source} />}</For>
              </div>
              <p class="usage-official-rule">{t("usage.official_rule")}</p>
            </section>

            <section class="usage-section usage-section--activity">
              <header class="usage-section__head">
                <div>
                  <h2>{t("usage.activity_title")}</h2>
                  <p>{t("usage.trend_description")}</p>
                </div>
                <span class="usage-section__meta">{t(`usage.grain.${resolved().grain}`)}</span>
              </header>
              <Show
                when={resolved().current.summary.calls > 0}
                fallback={
                  <div class="usage-empty">
                    <Icon name="usage-metrics" size="display" />
                    <strong>{t("usage.empty_title")}</strong>
                    <span>{t("usage.empty_body")}</span>
                  </div>
                }
              >
                <UsageActivityGrid data={resolved()} />
              </Show>
            </section>

            <div class="usage-insights">
              <section class="usage-insight">
                <header class="usage-section__head">
                  <div>
                    <h2>{t("usage.composition_title")}</h2>
                    <p>
                      {t("usage.average_per_call", {
                        value: formatTokenCount(resolved().current.summary.averageTokensPerCall),
                      })}
                    </p>
                  </div>
                </header>
                <TokenComposition data={resolved()} />
                <dl class="usage-coverage-list">
                  <div>
                    <dt>
                      <span class="usage-dot usage-dot--priced" />
                      {t("usage.coverage_priced")}
                    </dt>
                    <dd>{exactNumber(resolved().current.summary.billing.pricedTokens)}</dd>
                  </div>
                  <div>
                    <dt>
                      <span class="usage-dot usage-dot--unpriced" />
                      {t("usage.coverage_unpriced")}
                    </dt>
                    <dd>{exactNumber(resolved().current.summary.billing.unpricedTokens)}</dd>
                  </div>
                  <div>
                    <dt>
                      <span class="usage-dot usage-dot--unknown" />
                      {t("usage.coverage_unknown")}
                    </dt>
                    <dd>{exactNumber(resolved().current.summary.billing.unknownTokens)}</dd>
                  </div>
                </dl>
              </section>

              <section class="usage-insight">
                <header class="usage-section__head">
                  <div>
                    <h2>{t("usage.providers_title")}</h2>
                    <p>{t("usage.providers_description")}</p>
                  </div>
                  <span class="usage-section__meta">{resolved().providers.length}</span>
                </header>
                <div class="usage-provider-list">
                  <For each={resolved().providers}>
                    {(provider) => (
                      <div class="usage-provider-row">
                        <div class="usage-provider-row__identity">
                          <strong>{provider.providerID}</strong>
                          <span>{t("usage.models_count", { value: String(provider.modelCount) })}</span>
                        </div>
                        <div class="usage-provider-row__measure">
                          <span>{exactNumber(provider.summary.tokens.total)} Token</span>
                          <span>{formatDetailedCostUSD(provider.summary.costUSD)}</span>
                        </div>
                        <div class="usage-provider-row__bar" aria-hidden="true">
                          <span style={{ width: `${provider.share * 100}%` }} />
                        </div>
                      </div>
                    )}
                  </For>
                  <Show when={resolved().providers.length === 0}>
                    <div class="usage-list-empty">{t("usage.no_provider_data")}</div>
                  </Show>
                </div>
              </section>
            </div>

            <p class="usage-coverage-note">{t("usage.coverage_note")}</p>

            <section class="usage-section usage-section--models">
              <header class="usage-section__head">
                <div>
                  <h2>{t("usage.models_title")}</h2>
                  <p>{t("usage.models_description")}</p>
                </div>
                <span class="usage-section__meta">{resolved().models.length}</span>
              </header>
              <div class="usage-model-table-wrap">
                <table class="usage-model-table">
                  <thead>
                    <tr>
                      <th>{t("usage.table_model")}</th>
                      <th>{t("usage.table_calls")}</th>
                      <th>{t("usage.table_tokens")}</th>
                      <th>{t("usage.table_cost")}</th>
                      <th>{t("usage.table_share")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    <For each={resolved().models}>
                      {(model) => (
                        <tr>
                          <td>
                            <strong>{model.modelID}</strong>
                            <span>{model.providerID}</span>
                          </td>
                          <td>{exactNumber(model.summary.calls)}</td>
                          <td>{exactNumber(model.summary.tokens.total)}</td>
                          <td>{formatDetailedCostUSD(model.summary.costUSD)}</td>
                          <td>{percent(model.share * 100)}</td>
                        </tr>
                      )}
                    </For>
                  </tbody>
                </table>
                <Show when={resolved().models.length === 0}>
                  <div class="usage-list-empty">{t("usage.no_model_data")}</div>
                </Show>
              </div>
            </section>
          </>
        )}
      </Show>

      <Show when={loading() && !data() && !error()}>
        <div class="usage-loading" role="status">
          <Icon name="loading" class="is-spinning" />
          <span>{t("usage.loading")}</span>
        </div>
      </Show>
    </SettingsPanel>
  )
}
