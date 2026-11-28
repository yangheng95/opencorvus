import { vega } from "vega-embed"
import { fillTemplate, localeTag, t, translationTemplate } from "../../utils/i18n"

/** One native View owns its Accessible Rich Internet Applications (ARIA) language. */
export class LocalizedVegaView extends vega.View {
  readonly ariaLocale = snapshotAriaLocale()

  override initialize(...args: Parameters<InstanceType<typeof vega.View>["initialize"]>) {
    super.initialize(...args)
    this.container()?.setAttribute("aria-roledescription", this.ariaLocale.visualization)
    return this
  }
}

function snapshotAriaLocale() {
  const numbers = new Intl.NumberFormat(localeTag())
  const list = new Intl.ListFormat(localeTag(), { type: "conjunction", style: "long" })
  const text = {
    visualization: t("artifact.chart.aria.visualization"),
    axis: translationTemplate("artifact.chart.aria.axis"),
    axisTitled: translationTemplate("artifact.chart.aria.axis_titled"),
    legend: translationTemplate("artifact.chart.aria.legend"),
    legendTitled: translationTemplate("artifact.chart.aria.legend_titled"),
    mark: translationTemplate("artifact.chart.aria.mark"),
    container: translationTemplate("artifact.chart.aria.container"),
    title: translationTemplate("artifact.chart.aria.title"),
    subtitle: translationTemplate("artifact.chart.aria.subtitle"),
    boundariesOne: translationTemplate("artifact.chart.aria.boundaries_one"),
    boundariesOther: translationTemplate("artifact.chart.aria.boundaries_other"),
    valuesOne: translationTemplate("artifact.chart.aria.values_one"),
    valuesOther: translationTemplate("artifact.chart.aria.values_other"),
    ending: translationTemplate("artifact.chart.aria.ending"),
    range: translationTemplate("artifact.chart.aria.range"),
  }
  const roles: Record<string, string> = {
    axis: t("artifact.chart.aria.role_axis"),
    legend: t("artifact.chart.aria.role_legend"),
    title: t("artifact.chart.aria.role_title"),
    subtitle: t("artifact.chart.aria.role_subtitle"),
  }
  const marks: Record<string, string> = {
    arc: t("artifact.chart.aria.mark_arc"),
    area: t("artifact.chart.aria.mark_area"),
    group: t("artifact.chart.aria.mark_group"),
    image: t("artifact.chart.aria.mark_image"),
    line: t("artifact.chart.aria.mark_line"),
    path: t("artifact.chart.aria.mark_path"),
    rect: t("artifact.chart.aria.mark_rect"),
    rule: t("artifact.chart.aria.mark_rule"),
    shape: t("artifact.chart.aria.mark_shape"),
    symbol: t("artifact.chart.aria.mark_symbol"),
    text: t("artifact.chart.aria.mark_text"),
    trail: t("artifact.chart.aria.mark_trail"),
  }
  const scales: Record<string, string> = {
    discrete: t("artifact.chart.aria.scale_discrete"),
    linear: t("artifact.chart.aria.scale_linear"),
    log: t("artifact.chart.aria.scale_log"),
    pow: t("artifact.chart.aria.scale_pow"),
    sqrt: t("artifact.chart.aria.scale_sqrt"),
    symlog: t("artifact.chart.aria.scale_symlog"),
    time: t("artifact.chart.aria.scale_time"),
    utc: t("artifact.chart.aria.scale_utc"),
    identity: t("artifact.chart.aria.scale_identity"),
    quantile: t("artifact.chart.aria.scale_quantile"),
    quantize: t("artifact.chart.aria.scale_quantize"),
    threshold: t("artifact.chart.aria.scale_threshold"),
    "bin-linear": t("artifact.chart.aria.scale_bin_linear"),
    "bin-ordinal": t("artifact.chart.aria.scale_bin_ordinal"),
    sequential: t("artifact.chart.aria.scale_sequential"),
    diverging: t("artifact.chart.aria.scale_diverging"),
  }
  const channels: Record<string, string> = {
    fill: t("artifact.chart.aria.channel_fill"),
    stroke: t("artifact.chart.aria.channel_stroke"),
    size: t("artifact.chart.aria.channel_size"),
    shape: t("artifact.chart.aria.channel_shape"),
    opacity: t("artifact.chart.aria.channel_opacity"),
    strokeWidth: t("artifact.chart.aria.channel_stroke_width"),
    strokeDash: t("artifact.chart.aria.channel_stroke_dash"),
  }
  const legends: Record<string, string> = {
    symbol: t("artifact.chart.aria.legend_symbol"),
    gradient: t("artifact.chart.aria.legend_gradient"),
  }
  const caption = (template: string, values: Record<string, string>) => fillTemplate(template, values)
  return {
    visualization: text.visualization,
    role: (role: string) => roles[role] ?? role,
    mark: (mark: string) => caption(text.mark, { mark: marks[mark] ?? mark }),
    container: (mark: string) => caption(text.container, { mark: marks[mark] ?? mark }),
    title: (title: string) => caption(text.title, { title }),
    subtitle: (title: string) => caption(text.subtitle, { title }),
    axis: (axis: string, title: string | null, type: string, domain: string) =>
      caption(title ? text.axisTitled : text.axis, { axis, title: title ?? "", type: scales[type] ?? type, domain }),
    legend: (type: string | undefined, title: string | null, props: string[], domain: string) =>
      caption(title ? text.legendTitled : text.legend, {
        type: type ? legends[type] ?? type : "",
        title: title ?? "",
        channels: list.format(props.map(prop => channels[prop] ?? prop)),
        domain,
      }),
    domain: {
      boundaries: (count: number, values: string[]) =>
        caption(count === 1 ? text.boundariesOne : text.boundariesOther, { count: numbers.format(count), values: values.join(", ") }),
      values: (count: number, values: string) =>
        caption(count === 1 ? text.valuesOne : text.valuesOther, { count: numbers.format(count), values }),
      ending: (head: string, tail: string) => caption(text.ending, { head, tail }),
      range: (first: string, last: string) => caption(text.range, { first, last }),
    },
  }
}
