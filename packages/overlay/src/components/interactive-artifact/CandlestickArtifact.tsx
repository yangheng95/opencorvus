import {
  CandlestickSeries,
  ColorType,
  HistogramSeries,
  createChart,
  type CandlestickData,
  type HistogramData,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp,
} from "lightweight-charts"
import { createEffect, createMemo, onCleanup, onMount } from "solid-js"
import { createArtifactCandlestickPresentation } from "../../services/artifact-candlestick"
import type { InteractiveArtifactPayload } from "../../services/interactive-artifact"
import { observeAppliedTheme, themeColor } from "../../services/theme"
import { localeTag, t } from "../../utils/i18n"
import { ArtifactFrame } from "./ArtifactFrame"

type CandlestickPayload = Extract<InteractiveArtifactPayload, { renderer: "candlestick@1" }>

const MAX_CANDLE_BAR_SPACING = 32

export function CandlestickArtifact(props: { payload: CandlestickPayload }) {
  let container!: HTMLDivElement
  let currentChart: IChartApi | undefined
  let currentCandles: ISeriesApi<"Candlestick"> | undefined
  let currentVolume: ISeriesApi<"Histogram"> | undefined
  const presentation = createMemo(() => createArtifactCandlestickPresentation(props.payload.series, localeTag()))
  createEffect(() => {
    const next = presentation()
    const volumeTitle = t("artifact.candlestick.volume")
    currentChart?.applyOptions({
      localization: { locale: next.locale, timeFormatter: (time) => next.formatTime(time as UTCTimestamp) },
    })
    currentCandles?.applyOptions({ priceFormat: next.priceFormat })
    currentVolume?.applyOptions({ title: volumeTitle })
  })

  onMount(() => {
    const theme = () => {
      // CSS means Cascading Style Sheets. The active theme is the only chart palette owner.
      const color = (token: `--${string}`) => themeColor(container, token)
      return {
        backgroundColor: color("--surface-inset"),
        textColor: color("--text-soft"),
        gridColor: color("--border"),
        scaleBorderColor: color("--border-strong"),
        upColor: color("--good"),
        downColor: color("--bad"),
        upVolumeColor: color("--good-dim"),
        downVolumeColor: color("--bad-dim"),
      }
    }
    const initial = theme()
    const initialPresentation = presentation()
    const chart = createChart(container, {
      width: Math.max(1, container.clientWidth),
      height: Math.max(1, container.clientHeight),
      localization: {
        locale: initialPresentation.locale,
        timeFormatter: (time) => initialPresentation.formatTime(time as UTCTimestamp),
      },
      layout: {
        background: { type: ColorType.Solid, color: initial.backgroundColor },
        textColor: initial.textColor,
        panes: { separatorColor: initial.gridColor, separatorHoverColor: initial.scaleBorderColor },
      },
      grid: {
        vertLines: { color: initial.gridColor },
        horzLines: { color: initial.gridColor },
      },
      rightPriceScale: {
        borderColor: initial.scaleBorderColor,
        scaleMargins: { top: 0.08, bottom: 0.08 },
        entireTextOnly: true,
      },
      timeScale: {
        borderColor: initial.scaleBorderColor,
        timeVisible: true,
        maxBarSpacing: MAX_CANDLE_BAR_SPACING,
      },
    })
    const candles = chart.addSeries(CandlestickSeries, {
      priceFormat: initialPresentation.priceFormat,
      upColor: initial.upColor,
      downColor: initial.downColor,
      borderVisible: false,
      wickUpColor: initial.upColor,
      wickDownColor: initial.downColor,
    })
    currentChart = chart
    currentCandles = candles
    candles.setData(
      props.payload.series.map((point) => ({
        time: point.time as UTCTimestamp,
        open: point.open,
        high: point.high,
        low: point.low,
        close: point.close,
      })) as CandlestickData<UTCTimestamp>[],
    )
    const volume = props.payload.series.some((point) => point.volume !== undefined)
      ? chart.addSeries(HistogramSeries, { priceFormat: { type: "volume" }, title: t("artifact.candlestick.volume") }, 1)
      : undefined
    if (volume) {
      currentVolume = volume
      candles.getPane().setStretchFactor(4)
      volume.getPane().setStretchFactor(1)
      volume.setData(
        props.payload.series.map((point) => ({
          time: point.time as UTCTimestamp,
          value: point.volume ?? 0,
          color: point.close >= point.open ? initial.upVolumeColor : initial.downVolumeColor,
        })) as HistogramData<UTCTimestamp>[],
      )
    }
    const stopThemeObserver = observeAppliedTheme(() => {
      const next = theme()
      chart.applyOptions({
        layout: {
          background: { type: ColorType.Solid, color: next.backgroundColor },
          textColor: next.textColor,
          panes: { separatorColor: next.gridColor, separatorHoverColor: next.scaleBorderColor },
        },
        grid: {
          vertLines: { color: next.gridColor },
          horzLines: { color: next.gridColor },
        },
        rightPriceScale: { borderColor: next.scaleBorderColor },
        timeScale: { borderColor: next.scaleBorderColor },
      })
      candles.applyOptions({
        upColor: next.upColor,
        downColor: next.downColor,
        wickUpColor: next.upColor,
        wickDownColor: next.downColor,
      })
      volume?.setData(
        props.payload.series.map((point) => ({
          time: point.time as UTCTimestamp,
          value: point.volume ?? 0,
          color: point.close >= point.open ? next.upVolumeColor : next.downVolumeColor,
        })) as HistogramData<UTCTimestamp>[],
      )
    })
    let fitPending = true
    const resizeObserver = new ResizeObserver(([entry]) => {
      const width = Math.floor(entry.contentRect.width)
      const height = Math.floor(entry.contentRect.height)
      if (width <= 0 || height <= 0) return
      chart.applyOptions({
        width,
        height,
      })
      if (fitPending) {
        chart.timeScale().fitContent()
        fitPending = false
        container.dataset.ready = "true"
      }
    })
    resizeObserver.observe(container)
    onCleanup(() => {
      currentChart = undefined
      currentCandles = undefined
      currentVolume = undefined
      stopThemeObserver()
      resizeObserver.disconnect()
      chart.remove()
    })
  })

  return (
    <ArtifactFrame payload={props.payload} title={props.payload.title} kind="Candlestick">
      <div
        class="msg-artifact-chart"
        ref={container}
        data-chart="candlestick"
        style={{ height: `calc(${props.payload.presentation?.height ?? 320}px * var(--ui-scale))` }}
      />
    </ArtifactFrame>
  )
}
