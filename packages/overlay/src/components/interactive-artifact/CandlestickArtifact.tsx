import {
  CandlestickSeries,
  ColorType,
  HistogramSeries,
  createChart,
  type CandlestickData,
  type HistogramData,
  type UTCTimestamp,
} from "lightweight-charts"
import { onCleanup, onMount } from "solid-js"
import type { InteractiveArtifactPayload } from "../../services/interactive-artifact"
import { observeAppliedTheme } from "../../services/theme"
import { ArtifactFrame } from "./ArtifactFrame"
import { requiredThemeChartColor } from "./theme-color"

type CandlestickPayload = Extract<InteractiveArtifactPayload, { renderer: "candlestick@1" }>

const MAX_CANDLE_BAR_SPACING = 32

export function CandlestickArtifact(props: { payload: CandlestickPayload }) {
  let container!: HTMLDivElement

  onMount(() => {
    const theme = () => {
      // CSS means Cascading Style Sheets. The active theme is the only chart palette owner.
      const color = (token: `--${string}`) => requiredThemeChartColor(container, token)
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
    const chart = createChart(container, {
      width: Math.max(1, container.clientWidth),
      height: Math.max(1, container.clientHeight),
      layout: {
        background: { type: ColorType.Solid, color: initial.backgroundColor },
        textColor: initial.textColor,
      },
      grid: {
        vertLines: { color: initial.gridColor },
        horzLines: { color: initial.gridColor },
      },
      rightPriceScale: {
        borderColor: initial.scaleBorderColor,
        scaleMargins: { top: 0.08, bottom: 0.18 },
      },
      timeScale: {
        borderColor: initial.scaleBorderColor,
        timeVisible: true,
        maxBarSpacing: MAX_CANDLE_BAR_SPACING,
      },
    })
    const candles = chart.addSeries(CandlestickSeries, {
      upColor: initial.upColor,
      downColor: initial.downColor,
      borderVisible: false,
      wickUpColor: initial.upColor,
      wickDownColor: initial.downColor,
    })
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
      ? chart.addSeries(HistogramSeries, { priceFormat: { type: "volume" }, priceScaleId: "" })
      : undefined
    if (volume) {
      volume.priceScale().applyOptions({ scaleMargins: { top: 0.8, bottom: 0 } })
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
      stopThemeObserver()
      resizeObserver.disconnect()
      chart.remove()
    })
  })

  return (
    <ArtifactFrame title={props.payload.title} kind="Candlestick">
      <div
        class="msg-artifact-chart"
        ref={container}
        data-chart="candlestick"
        style={{ height: `calc(${props.payload.presentation?.height ?? 320}px * var(--ui-scale))` }}
      />
    </ArtifactFrame>
  )
}
