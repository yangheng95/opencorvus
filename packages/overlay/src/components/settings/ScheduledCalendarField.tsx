import { createMemo, createSignal, createUniqueId, Index, Show, type JSX } from "solid-js"
import { Portal } from "solid-js/web"
import { CalendarDateTime, DateFormatter, parseDate } from "@internationalized/date"
import { Key } from "@solid-primitives/keyed"
import * as dateInput from "@zag-js/date-input"
import * as datePicker from "@zag-js/date-picker"
import { normalizeProps, useMachine } from "@zag-js/solid"
import { localeTag, t } from "../../utils/i18n"
import { Button } from "../ui/Button"
import { Icon } from "../ui/Icon"
import { Popover } from "../ui/Popover"

interface ScheduledCalendarFieldProps {
  kind: "date" | "time"
  value: string
  timeZone: string
  disabled: boolean
  onChange: (value: string) => void
  registerValidation: (isComplete: () => boolean) => void
}

interface ClockChoice {
  hour?: number
  minute?: number
}

interface TemporalSegmentControls {
  focus: () => void
  isComplete: () => boolean
  readClockChoice: () => ClockChoice
}

// The formatter renders only clock segments. This adapter date is never submitted.
const clockAnchor = new CalendarDateTime(2000, 1, 1, 0, 0)

function formatClockValue(hour: number, minute: number): string {
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`
}

export function ScheduledCalendarField(props: ScheduledCalendarFieldProps): JSX.Element {
  const id = createUniqueId()
  const isDate = () => props.kind === "date"
  const date = createMemo(() => isDate() && props.value ? parseDate(props.value) : undefined)
  const clock = createMemo(() => {
    if (isDate() || !props.value) return undefined
    const [hour, minute] = props.value.split(":").map(Number)
    return clockAnchor.set({ hour, minute })
  })
  const [segmentInstance, replaceSegments] = createSignal(1)
  const [segments, setSegments] = createSignal<TemporalSegmentControls>()
  const isComplete = () => segments()?.isComplete() ?? false
  props.registerValidation(isComplete)

  function applyPickerValue(value: string) {
    props.onChange(value)
    // An explicit choice replaces the keyboard draft, even when the committed value is unchanged.
    replaceSegments((instance) => instance + 1)
  }

  return (
    <div class="oc-text-field" data-disabled={props.disabled || undefined}>
      <span id={`${id}-label`} class="oc-text-field__label" onClick={() => segments()?.focus()}>
        {t(isDate() ? "automations.start_date" : "automations.time")}
      </span>
      <div class="oc-text-field__input automation-temporal-control">
        <Show when={segmentInstance()} keyed>
          <ScheduledTemporalSegments
            kind={props.kind}
            value={isDate() ? date() : clock()}
            labelId={`${id}-label`}
            descriptionId={isDate() ? `${id}-description` : undefined}
            disabled={props.disabled}
            onChange={props.onChange}
            onConnect={setSegments}
          />
        </Show>
        <Show when={isDate()} fallback={
          <ScheduledClockPicker
            readChoice={() => segments()?.readClockChoice() ?? {}}
            disabled={props.disabled}
            onChange={applyPickerValue}
          />
        }>
          <ScheduledCalendarPicker
            value={isComplete() ? date() : undefined}
            focusDate={date()}
            timeZone={props.timeZone}
            disabled={props.disabled}
            onChange={applyPickerValue}
          />
        </Show>
      </div>
      <Show when={isDate()}>
        <span id={`${id}-description`} class="oc-text-field__description">{t("automations.start_date_help")}</span>
      </Show>
    </div>
  )
}

function ScheduledTemporalSegments(props: {
  kind: "date" | "time"
  value: datePicker.DateValue | undefined
  labelId: string
  descriptionId?: string
  disabled: boolean
  onChange: (value: string) => void
  onConnect: (controls: TemporalSegmentControls) => void
}): JSX.Element {
  const id = createUniqueId()
  const isDate = () => props.kind === "date"
  const formatter = createMemo(() => new DateFormatter(localeTag(), { hour: "numeric", minute: "2-digit", timeZone: "UTC" }))
  const machine = useMachine(dateInput.machine, (): dateInput.Props => ({
    id,
    ids: { label: () => props.labelId },
    locale: localeTag(),
    timeZone: "UTC",
    granularity: isDate() ? "day" : "minute",
    formatter: isDate() ? undefined : formatter(),
    defaultPlaceholderValue: isDate() ? undefined : clockAnchor,
    shouldForceLeadingZeros: true,
    required: true,
    disabled: props.disabled,
    value: props.value ? [props.value] : [],
    onValueChange({ value: [next] }) {
      if (isDate()) props.onChange(next?.toString() ?? "")
      else props.onChange(next && "hour" in next ? formatClockValue(next.hour, next.minute) : "")
    },
  }))
  const input = createMemo(() => dateInput.connect(machine, normalizeProps))
  props.onConnect({
    focus: () => input().focus(),
    isComplete: () => input().getSegments().every((segment) => !segment.isEditable || !segment.isPlaceholder),
    readClockChoice: () => {
      const [draft] = input().displayValues
      if (!draft) return {}
      const usesDayPeriod = draft.hourCycle === "h11" || draft.hourCycle === "h12"
      const hourIsComplete = draft.hour != null && (!usesDayPeriod || draft.dayPeriod != null)
      const value = hourIsComplete ? draft.toValue(clockAnchor) : undefined
      return { hour: value && "hour" in value ? value.hour : undefined, minute: draft.minute ?? undefined }
    },
  })

  return (
    <div {...input().getRootProps()}>
      <div {...input().getControlProps()}>
        <div {...input().getSegmentGroupProps()} aria-describedby={props.descriptionId}
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
      </div>
    </div>
  )
}

const clockHours = Array.from({ length: 24 }, (_, hour) => clockAnchor.set({ hour }).toDate("UTC"))
const clockMinutes = Array.from({ length: 60 }, (_, minute) => minute)

function ScheduledClockPicker(props: {
  readChoice: () => ClockChoice
  disabled: boolean
  onChange: (value: string) => void
}): JSX.Element {
  const id = createUniqueId()
  const [open, setOpen] = createSignal(false)
  const [hour, setHour] = createSignal<number>()
  const [minute, setMinute] = createSignal<number>()
  const hourFormatter = createMemo(() => new Intl.DateTimeFormat(localeTag(), { hour: "numeric", timeZone: "UTC" }))
  const minuteFormatter = createMemo(() => new Intl.NumberFormat(localeTag(), { minimumIntegerDigits: 2 }))

  return (
    <Popover.Root placement="bottom-end" gutter={8} fitViewport open={open()} onOpenChange={(nextOpen) => {
      if (nextOpen) {
        const choice = props.readChoice()
        setHour(choice.hour)
        setMinute(choice.minute)
      }
      setOpen(nextOpen)
    }}>
      <Popover.Trigger as={Button} type="button" variant="ghost" size="icon" tone="neutral"
        disabled={props.disabled} aria-label={t("automations.clock.open")} title={t("automations.clock.open")}>
        <Icon name="scheduled" size="compact" />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content class="automation-clock-popover" aria-labelledby={`${id}-title`}>
          <strong id={`${id}-title`}>{t("automations.clock.label")}</strong>
          <div class="automation-clock-choices">
            <label>
              <span>{t("automations.calendar.segment.hour")}</span>
              <select size={5} onChange={(event) => setHour(Number(event.currentTarget.value))}>
                <Index each={clockHours}>
                  {(date, value) => <option value={value} selected={hour() === value}>{hourFormatter().format(date())}</option>}
                </Index>
              </select>
            </label>
            <label>
              <span>{t("automations.calendar.segment.minute")}</span>
              <select size={5} onChange={(event) => setMinute(Number(event.currentTarget.value))}>
                <Index each={clockMinutes}>
                  {(value) => <option value={value()} selected={minute() === value()}>{minuteFormatter().format(value())}</option>}
                </Index>
              </select>
            </label>
          </div>
          <Button type="button" variant="solid" size="sm" tone="accent" disabled={hour() === undefined || minute() === undefined}
            onClick={() => {
              const chosenHour = hour()
              const chosenMinute = minute()
              if (chosenHour === undefined || chosenMinute === undefined) return
              props.onChange(formatClockValue(chosenHour, chosenMinute))
              setOpen(false)
            }}>
            {t("automations.clock.apply")}
          </Button>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}

function ScheduledCalendarPicker(props: {
  value: datePicker.DateValue | undefined
  focusDate: datePicker.DateValue | undefined
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
    onValueChange: ({ value: [next] }) => {
      if (next) props.onChange(next.toString())
    },
    onOpenChange: ({ open, value }) => {
      // A date may guide navigation while an unfinished draft has no selected day.
      if (open && value.length === 0 && props.focusDate) picker().setFocusedValue(props.focusDate)
    },
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
