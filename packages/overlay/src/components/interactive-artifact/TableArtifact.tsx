import {
  createSolidTable,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  type ColumnDef,
  type PaginationState,
  type SortingState,
} from "@tanstack/solid-table"
import { For, Show, createEffect, createMemo, on } from "solid-js"
import type { InteractiveArtifactPayload } from "../../services/interactive-artifact"
import type { ArtifactExport } from "../../services/artifact-export"
import { compareArtifactTableDates, createArtifactTablePresentation } from "../../services/artifact-table"
import { conversationArtifactDisplayState, setConversationArtifactDisplayState } from "../../store/conversation-ui"
import { localeTag, t } from "../../utils/i18n"
import { Button } from "../ui/Button"
import { SearchField } from "../ui/SearchField"
import { ArtifactFrame } from "./ArtifactFrame"

type TablePayload = Extract<InteractiveArtifactPayload, { renderer: "table@1" }>
type TableRow = TablePayload["rows"][number]

export function TableArtifact(props: {
  payload: TablePayload
  stateKey: string
  exportFiles?: () => ArtifactExport[]
  compareCells?: (left: TableRow[string], right: TableRow[string]) => number
}) {
  const display = () => conversationArtifactDisplayState(props.stateKey)
  const filter = () => display()?.query ?? ""
  const setFilter = (query: string) => setConversationArtifactDisplayState(props.stateKey, { query })
  // Copy the retained store values into immutable library inputs. Reconcile can
  // update a proxy in place, while TanStack memoizes by array/object identity.
  const sorting = createMemo<SortingState>(() => (display()?.tableSorting ?? []).map(({ id, desc }) => ({ id, desc })))
  const pagination = createMemo<PaginationState>(() => ({ pageIndex: display()?.tablePageIndex ?? 0, pageSize: 50 }))
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
        : column.dataType === "date"
          ? ({
              sortingFn: (left, right, columnID) =>
                compareArtifactTableDates(left.getValue(columnID), right.getValue(columnID)),
              sortUndefined: false,
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
      get pagination() {
        return pagination()
      },
      get globalFilter() {
        const criteria = search()
        return criteria.query.trim() ? criteria : undefined
      },
    },
    onSortingChange: (updater) => setConversationArtifactDisplayState(props.stateKey, {
      tableSorting: typeof updater === "function" ? updater(sorting()) : updater,
    }),
    onPaginationChange: (updater) => setConversationArtifactDisplayState(props.stateKey, {
      tablePageIndex: (typeof updater === "function" ? updater(pagination()) : updater).pageIndex,
    }),
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
  })
  // Mount restores the retained page within the native model's page count. Changes
  // to data, filtering, sorting or locale start the resulting view on page one.
  createEffect(on(() => table.getPrePaginationRowModel(), (_model, previous) => {
    table.setPageIndex(previous ? 0 : Math.min(pagination().pageIndex, Math.max(0, table.getPageCount() - 1)))
  }))

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
