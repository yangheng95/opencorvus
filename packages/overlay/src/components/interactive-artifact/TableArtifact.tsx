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
import { For, Show, createEffect, createMemo, createSignal, on } from "solid-js"
import type { InteractiveArtifactPayload } from "../../services/interactive-artifact"
import type { ArtifactExport } from "../../services/artifact-export"
import { createArtifactTablePresentation } from "../../services/artifact-table"
import { localeTag, t } from "../../utils/i18n"
import { Button } from "../ui/Button"
import { SearchField } from "../ui/SearchField"
import { ArtifactFrame } from "./ArtifactFrame"

type TablePayload = Extract<InteractiveArtifactPayload, { renderer: "table@1" }>
type TableRow = TablePayload["rows"][number]

export function TableArtifact(props: {
  payload: TablePayload
  exportFiles?: () => ArtifactExport[]
  compareCells?: (left: TableRow[string], right: TableRow[string]) => number
}) {
  const [sorting, setSorting] = createSignal<SortingState>([])
  const [filter, setFilter] = createSignal("")
  const presentation = createMemo(() =>
    createArtifactTablePresentation(localeTag(), {
      yes: t("artifact.table.yes"),
      no: t("artifact.table.no"),
    }),
  )
  const search = createMemo(() => ({ query: filter(), presentation: presentation(), columns: props.payload.columns }))
  const columns = createMemo<ColumnDef<TableRow>[]>(() => {
    const current = presentation()
    return props.payload.columns.map((column) => ({
      id: column.id,
      accessorFn: (row) => row[column.id],
      header: column.label,
      cell: (context) => current.formatCell(context.getValue() as TableRow[string], column.dataType),
      sortDescFirst: false,
      ...(props.compareCells
        ? ({
            sortingFn: (left, right, columnID) =>
              props.compareCells!(left.getValue(columnID), right.getValue(columnID)),
          } satisfies Partial<ColumnDef<TableRow>>)
        : {}),
    }))
  })
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
        const criteria = search()
        return criteria.query.trim() ? criteria : undefined
      },
    },
    onSortingChange: (updater) => setSorting((current) => (typeof updater === "function" ? updater(current) : updater)),
    // Register the whole-row predicate once; every declared column contributes
    // through matchesRow, including an empty or boolean first column.
    getColumnCanGlobalFilter: (column) => column.id === props.payload.columns[0]?.id,
    globalFilterFn: (row, _columnID, criteria: ReturnType<typeof search>) =>
      criteria.presentation.matchesRow(criteria.query, row.original, criteria.columns),
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    autoResetPageIndex: false,
    initialState: { pagination: { pageSize: 50 } },
  })
  // The Solid adapter's store shares initialState; reset to the native default
  // index rather than replaying that mutable snapshot after view changes.
  createEffect(on(() => table.getPrePaginationRowModel(), () => table.resetPageIndex(true)))

  return (
    <ArtifactFrame payload={props.payload} title={props.payload.title} kind="Table" exportFiles={props.exportFiles}>
      <div class="msg-artifact-table__toolbar">
        <SearchField
          clearable
          value={filter()}
          placeholder={t("artifact.table.search")}
          size="sm"
          onValueChange={setFilter}
        />
        <span>
          {t("artifact.table.rows", {
            visible: table.getFilteredRowModel().rows.length,
            total: props.payload.rows.length,
          })}
        </span>
        <Show when={filter().trim() || sorting().length > 0}>
          <p class="msg-artifact-table__download-note">{t("artifact.table.download_scope")}</p>
        </Show>
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
            <For
              each={table.getRowModel().rows}
              fallback={
                <tr>
                  <td colspan={props.payload.columns.length}>{t("artifact.table.empty")}</td>
                </tr>
              }
            >
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
