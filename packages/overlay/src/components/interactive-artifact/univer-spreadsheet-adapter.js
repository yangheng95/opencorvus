import { BooleanNumber, CellValueType, HorizontalAlign, LocaleType, ThemeService, mergeLocales } from "@univerjs/core"
import { UniverSheetsCorePreset } from "@univerjs/preset-sheets-core"
import enUS from "@univerjs/preset-sheets-core/locales/en-US"
import zhCN from "@univerjs/preset-sheets-core/locales/zh-CN"
import "@univerjs/preset-sheets-core/lib/index.css"
import { createUniver } from "@univerjs/presets"

function cellCoordinates(address) {
  const letters = address.match(/^[A-Z]+/)?.[0] ?? "A"
  const row = Number(address.match(/[0-9]+$/)?.[0] ?? 1) - 1
  const column = [...letters].reduce((total, letter) => total * 26 + letter.charCodeAt(0) - 64, 0) - 1
  return { row, column }
}

function cellValueType(value) {
  if (typeof value === "number") return CellValueType.NUMBER
  if (typeof value === "boolean") return CellValueType.BOOLEAN
  if (typeof value === "string") return CellValueType.STRING
  return undefined
}

function cellStyle(cell) {
  if (!cell.style && !cell.numberFormat) return undefined
  return {
    bl: cell.style?.bold ? BooleanNumber.TRUE : undefined,
    it: cell.style?.italic ? BooleanNumber.TRUE : undefined,
    cl: cell.style?.color ? { rgb: cell.style.color } : undefined,
    bg: cell.style?.background ? { rgb: cell.style.background } : undefined,
    ht:
      cell.style?.align === "left"
        ? HorizontalAlign.LEFT
        : cell.style?.align === "center"
          ? HorizontalAlign.CENTER
          : cell.style?.align === "right"
            ? HorizontalAlign.RIGHT
            : undefined,
    n: cell.numberFormat ? { pattern: cell.numberFormat } : undefined,
  }
}

function workbookSnapshot(payload, locale) {
  return {
    id: `interactive-artifact-${payload.title}`,
    name: payload.title,
    appVersion: "1.0.0",
    locale,
    styles: {},
    sheetOrder: payload.sheets.map((sheet) => sheet.id),
    sheets: Object.fromEntries(
      payload.sheets.map((sheet) => {
        const cellData = {}
        for (const cell of sheet.cells) {
          const { row, column } = cellCoordinates(cell.address)
          const value = cell.formula ? cell.computed : cell.value
          cellData[row] ??= {}
          cellData[row][column] = {
            v: value ?? null,
            t: cellValueType(value),
            f: cell.formula,
            s: cellStyle(cell),
          }
        }
        return [
          sheet.id,
          {
            id: sheet.id,
            name: sheet.name,
            rowCount: sheet.rowCount,
            columnCount: sheet.columnCount,
            cellData,
            freeze: {
              xSplit: sheet.frozenColumns,
              ySplit: sheet.frozenRows,
              startRow: sheet.frozenRows,
              startColumn: sheet.frozenColumns,
            },
          },
        ]
      }),
    ),
  }
}

export function mountUniverSpreadsheet(host, payload, language, darkMode) {
  const locale = language === "zh-CN" ? LocaleType.ZH_CN : LocaleType.EN_US
  const { univer, univerAPI } = createUniver({
    locale,
    darkMode,
    locales: {
      [LocaleType.EN_US]: mergeLocales(enUS),
      [LocaleType.ZH_CN]: mergeLocales(zhCN),
    },
    presets: [
      UniverSheetsCorePreset({
        container: host,
        header: true,
        toolbar: false,
        formulaBar: true,
        footer: {
          sheetBar: true,
          statisticBar: true,
          zoomSlider: true,
          addSheetButtonConfig: { show: payload.editable },
        },
        disableAutoFocus: true,
      }),
    ],
  })
  const workbook = univerAPI.createWorkbook(workbookSnapshot(payload, locale))
  if (!payload.editable) void workbook.getWorkbookPermission().setReadOnly()
  const themeService = univer.__getInjector().get(ThemeService)
  host.dataset.ready = "true"
  return {
    dispose: () => univer.dispose(),
    setDarkMode: (enabled) => themeService.setDarkMode(enabled),
  }
}
