import {
  createSolidTable,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  type ColumnDef,
  type SortingState,
} from "@tanstack/solid-table"
import { For, createMemo, createSignal } from "solid-js"
import type { InteractiveArtifactPayload } from "../../services/interactive-artifact"
import { t } from "../../utils/i18n"
import { Button } from "../ui/Button"
import { SearchField } from "../ui/SearchField"
import { ArtifactFrame } from "./ArtifactFrame"

type TablePayload = Extract<InteractiveArtifactPayload, { renderer: "table@1" }>
type TableRow = TablePayload["rows"][number]

function displayCell(value: TableRow[string], dataType: TablePayload["columns"][number]["dataType"]): string {
  if (value === null || value === undefined) return "—"
  if (dataType === "boolean") return value ? "Yes" : "No"
  if (dataType === "number" && typeof value === "number") return new Intl.NumberFormat().format(value)
  if (dataType === "date") {
    const date = new Date(String(value))
    if (!Number.isNaN(date.getTime())) return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(date)
  }
  return String(value)
}

export function TableArtifact(props: { payload: TablePayload }) {
  const [sorting, setSorting] = createSignal<SortingState>([])
  const [filter, setFilter] = createSignal("")
  const columns = createMemo<ColumnDef<TableRow>[]>(() =>
    props.payload.columns.map((column) => ({
      id: column.id,
      accessorFn: (row) => row[column.id],
      header: column.label,
      cell: (context) => displayCell(context.getValue() as TableRow[string], column.dataType),
      sortDescFirst: false,
    })),
  )
  const table = createSolidTable({
    get data() {
      return props.payload.rows
    },
    get columns() {
      return columns()
    },
    state: {
      get sorting() {
        return sorting()
      },
      get globalFilter() {
        return filter()
      },
    },
    onSortingChange: (updater) => setSorting((current) => (typeof updater === "function" ? updater(current) : updater)),
    onGlobalFilterChange: (value) => setFilter(String(value ?? "")),
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 50 } },
  })

  return (
    <ArtifactFrame title={props.payload.title} kind="Table">
      <div class="msg-artifact-table__toolbar">
        <SearchField
          value={filter()}
          placeholder={t("artifact.table.search")}
          size="sm"
          onValueChange={setFilter}
          onClear={() => setFilter("")}
        />
        <span>
          {t("artifact.table.rows", {
            visible: table.getFilteredRowModel().rows.length,
            total: props.payload.rows.length,
          })}
        </span>
      </div>
      <div class="msg-artifact-table__scroll">
        <table class="msg-artifact-table">
          <thead>
            <For each={table.getHeaderGroups()}>
              {(group) => (
                <tr>
                  <For each={group.headers}>
                    {(header) => (
                      <th
                        scope="col"
                        aria-sort={
                          header.column.getIsSorted() === "asc"
                            ? "ascending"
                            : header.column.getIsSorted() === "desc"
                              ? "descending"
                              : "none"
                        }
                      >
                        <Button
                          variant="ghost"
                          size="sm"
                          tone="neutral"
                          class="msg-artifact-table__sort"
                          onClick={header.column.getToggleSortingHandler()}
                          data-column-id={header.column.id}
                        >
                          <span>{flexRender(header.column.columnDef.header, header.getContext())}</span>
                          <span aria-hidden="true">
                            {header.column.getIsSorted() === "asc"
                              ? "↑"
                              : header.column.getIsSorted() === "desc"
                                ? "↓"
                                : "↕"}
                          </span>
                        </Button>
                      </th>
                    )}
                  </For>
                </tr>
              )}
            </For>
          </thead>
          <tbody>
            <For each={table.getRowModel().rows} fallback={<tr><td colspan={props.payload.columns.length}>{t("artifact.table.empty")}</td></tr>}>
              {(row) => (
                <tr>
                  <For each={row.getVisibleCells()}>
                    {(cell) => <td>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>}
                  </For>
                </tr>
              )}
            </For>
          </tbody>
        </table>
      </div>
      <div class="msg-artifact-table__pagination">
        <Button
          variant="ghost"
          size="sm"
          tone="neutral"
          disabled={!table.getCanPreviousPage()}
          onClick={() => table.previousPage()}
        >
          {t("artifact.table.previous")}
        </Button>
        <span>
          {table.getState().pagination.pageIndex + 1} / {Math.max(table.getPageCount(), 1)}
        </span>
        <Button
          variant="ghost"
          size="sm"
          tone="neutral"
          disabled={!table.getCanNextPage()}
          onClick={() => table.nextPage()}
        >
          {t("artifact.table.next")}
        </Button>
      </div>
    </ArtifactFrame>
  )
}
