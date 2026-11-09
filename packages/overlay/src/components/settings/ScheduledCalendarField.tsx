import { createMemo, createUniqueId, Index, Show, type JSX } from "solid-js"
import { Portal } from "solid-js/web"
import { CalendarDateTime, DateFormatter, parseDate } from "@internationalized/date"
import { Key } from "@solid-primitives/keyed"
import * as dateInput from "@zag-js/date-input"
import * as datePicker from "@zag-js/date-picker"
import { normalizeProps, useMachine } from "@zag-js/solid"
import { localeTag, t } from "../../utils/i18n"
import { Button } from "../ui/Button"
import { Icon } from "../ui/Icon"

interface ScheduledCalendarFieldProps {
  kind: "date" | "time"
  value: string
  timeZone: string
  disabled: boolean
  onChange: (value: string) => void
  registerValidation: (isComplete: () => boolean) => void
}

// The formatter renders only clock segments. This adapter date is never submitted.
const clockAnchor = new CalendarDateTime(2000, 1, 1, 0, 0)

export function ScheduledCalendarField(props: ScheduledCalendarFieldProps): JSX.Element {
  const id = createUniqueId()
  const isDate = () => props.kind === "date"
  const label = () => t(isDate() ? "automations.start_date" : "automations.time")
  const date = createMemo(() => isDate() && props.value ? parseDate(props.value) : undefined)
  const clock = createMemo(() => {
    if (isDate() || !props.value) return undefined
    const [hour, minute] = props.value.split(":").map(Number)
    return clockAnchor.set({ hour, minute })
  })
  const formatter = createMemo(() => new DateFormatter(localeTag(), { hour: "numeric", minute: "2-digit", timeZone: "UTC" }))
  const machine = useMachine(dateInput.machine, (): dateInput.Props => {
    const value = isDate() ? date() : clock()
    return {
      id,
      locale: localeTag(),
      timeZone: "UTC",
      granularity: isDate() ? "day" : "minute",
      formatter: isDate() ? undefined : formatter(),
      defaultPlaceholderValue: isDate() ? undefined : clockAnchor,
      shouldForceLeadingZeros: true,
      required: true,
      disabled: props.disabled,
      value: value ? [value] : [],
      onValueChange({ value: [next] }) {
        if (isDate()) props.onChange(next?.toString() ?? "")
        else if (next && "hour" in next) {
          props.onChange(`${String(next.hour).padStart(2, "0")}:${String(next.minute).padStart(2, "0")}`)
        } else props.onChange("")
      },
    }
  })
  const input = createMemo(() => dateInput.connect(machine, normalizeProps))
  props.registerValidation(() => input().getSegments().every((segment) => !segment.isEditable || !segment.isPlaceholder))

  return (
    <div {...input().getRootProps()} class="oc-text-field">
      <span {...input().getLabelProps()} class="oc-text-field__label">{label()}</span>
      <div {...input().getControlProps()} class="oc-text-field__input automation-temporal-control">
        <div {...input().getSegmentGroupProps()} aria-describedby={isDate() ? `${id}-description` : undefined}
          class="automation-temporal-segments" data-ui={isDate() ? "automation-start-date" : "automation-time"}>
          <Index each={input().getSegments()}>
            {(segment) => (
              <span
                {...input().getSegmentProps({ segment: segment() })}
                aria-label={segment().isEditable ? t(`automations.calendar.segment.${segment().type}`) : undefined}
              >
                {segment().text}
              </span>
            )}
          </Index>
        </div>
        <Show when={isDate()}>
          <ScheduledCalendarPicker value={date()} timeZone={props.timeZone} disabled={props.disabled} onChange={props.onChange} />
        </Show>
      </div>
      <Show when={isDate()}>
        <span id={`${id}-description`} class="oc-text-field__description">{t("automations.start_date_help")}</span>
      </Show>
    </div>
  )
}

function ScheduledCalendarPicker(props: {
  value: datePicker.DateValue | undefined
  timeZone: string
  disabled: boolean
  onChange: (value: string) => void
}): JSX.Element {
  const id = createUniqueId()
  const dateLabel = createMemo(() => new Intl.DateTimeFormat(localeTag(), { dateStyle: "full", timeZone: props.timeZone }))
  const dayNumber = createMemo(() => new Intl.NumberFormat(localeTag()))
  const machine = useMachine(datePicker.machine, () => ({
    id,
    locale: localeTag(),
    timeZone: props.timeZone,
    disabled: props.disabled,
    value: props.value ? [props.value] : [],
    onValueChange: ({ value: [next] }) => props.onChange(next?.toString() ?? ""),
    translations: {
      content: t("automations.calendar.label"),
      trigger: (open) => t(open ? "automations.calendar.close" : "automations.calendar.open"),
      prevTrigger: () => t("automations.calendar.previous_month"),
      nextTrigger: () => t("automations.calendar.next_month"),
      monthSelect: t("automations.calendar.segment.month"),
      yearSelect: t("automations.calendar.segment.year"),
      dayCell: ({ value }) => dateLabel().format(value.toDate(props.timeZone)),
    },
  }))
  const picker = createMemo(() => datePicker.connect(machine, normalizeProps))

  return (
    <div {...picker().getRootProps()}>
      <div {...picker().getControlProps()}>
        <Button {...picker().getTriggerProps()} variant="ghost" size="icon" tone="neutral">
          <Icon name="calendar" size="compact" />
        </Button>
      </div>
      <Portal>
        <div {...picker().getPositionerProps()} class="automation-calendar-positioner">
          <div {...picker().getContentProps()} class="oc-popover automation-calendar-popover">
            <div class="automation-calendar-navigation">
              <Button {...picker().getPrevTriggerProps()} variant="ghost" size="icon" tone="neutral">
                <Icon name="nav-back" size="compact" />
              </Button>
              <select {...picker().getMonthSelectProps()}>
                <Index each={picker().getMonths({ format: "long" })}>
                  {(month) => (
                    <option value={month().value} disabled={month().disabled}
                      selected={month().value === picker().visibleRange.start.month}>{month().label}</option>
                  )}
                </Index>
              </select>
              <select {...picker().getYearSelectProps()}>
                <Index each={picker().getYears()}>
                  {(year) => (
                    <option value={year().value} disabled={year().disabled}
                      selected={year().value === picker().visibleRange.start.year}>{year().label}</option>
                  )}
                </Index>
              </select>
              <Button {...picker().getNextTriggerProps()} variant="ghost" size="icon" tone="neutral">
                <Icon name="nav-forward" size="compact" />
              </Button>
            </div>
            <table {...picker().getTableProps({ view: "day" })}>
              <thead {...picker().getTableHeaderProps({ view: "day" })}>
                <tr {...picker().getTableRowProps()}>
                  <Index each={picker().weekDays}>
                    {(day) => <th scope="col" aria-label={day().long}>{day().short}</th>}
                  </Index>
                </tr>
              </thead>
              <tbody {...picker().getTableBodyProps({ view: "day" })}>
                <Key each={picker().weeks} by={(week) => week[0].toString()}>
                  {(week) => (
                    <tr {...picker().getTableRowProps()}>
                      <Key each={week()} by={(day) => day.toString()}>
                        {(day) => (
                          <td {...picker().getDayTableCellProps({ value: day() })}>
                            <div {...picker().getDayTableCellTriggerProps({ value: day() })}>
                              {dayNumber().format(day().day)}
                            </div>
                          </td>
                        )}
                      </Key>
                    </tr>
                  )}
                </Key>
              </tbody>
            </table>
          </div>
        </div>
      </Portal>
    </div>
  )
}
