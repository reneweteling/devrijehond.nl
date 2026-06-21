'use client';

/**
 * Reusable admin data table (TanStack Table): sortable column headers, a global
 * search box, and client-side pagination. Admin data volumes are small, so each
 * page hands the full (policy-bound) row set to this component and the browser
 * handles sort/search/paging. Styled with the .admin-table CSS in globals.css.
 */

import { useState, type ReactNode } from 'react';
import {
  type ColumnDef,
  type SortingState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table';

export type { ColumnDef } from '@tanstack/react-table';

export function DataTable<T>({
  columns,
  data,
  searchPlaceholder = 'Zoeken…',
  pageSize = 25,
  toolbarExtra,
  emptyText = 'Niets gevonden.',
}: {
  columns: ColumnDef<T, unknown>[];
  data: T[];
  searchPlaceholder?: string;
  pageSize?: number;
  toolbarExtra?: ReactNode;
  emptyText?: string;
}) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState('');

  const table = useReactTable({
    data,
    columns,
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize } },
  });

  const rows = table.getRowModel().rows;
  const total = table.getFilteredRowModel().rows.length;
  const pageIndex = table.getState().pagination.pageIndex;
  const pageCount = table.getPageCount();

  return (
    <div>
      <div className="admin-toolbar">
        <div className="admin-search">
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            aria-hidden="true"
            style={{ color: 'var(--ink-3)', flex: 'none' }}
          >
            <circle cx="11" cy="11" r="7" />
            <path d="m21 21-4.3-4.3" strokeLinecap="round" />
          </svg>
          <input
            type="search"
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            placeholder={searchPlaceholder}
            aria-label={searchPlaceholder}
          />
        </div>
        {toolbarExtra}
        <span className="admin-count">{total} resultaten</span>
      </div>

      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((header) => {
                  const canSort = header.column.getCanSort();
                  const sorted = header.column.getIsSorted();
                  return (
                    <th
                      key={header.id}
                      className={
                        (header.column.columnDef.meta as { className?: string })?.className
                      }
                      onClick={canSort ? header.column.getToggleSortingHandler() : undefined}
                      style={canSort ? { cursor: 'pointer', userSelect: 'none' } : undefined}
                      aria-sort={
                        sorted === 'asc' ? 'ascending' : sorted === 'desc' ? 'descending' : 'none'
                      }
                    >
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {canSort ? (
                          <span className="sort-ind" aria-hidden="true">
                            {sorted === 'asc' ? '▲' : sorted === 'desc' ? '▼' : '↕'}
                          </span>
                        ) : null}
                      </span>
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} style={{ textAlign: 'center', color: 'var(--ink-3)' }}>
                  {emptyText}
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <td
                      key={cell.id}
                      className={(cell.column.columnDef.meta as { className?: string })?.className}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {pageCount > 1 ? (
        <nav className="admin-pager" aria-label="Paginering">
          <button
            type="button"
            className={!table.getCanPreviousPage() ? 'disabled' : undefined}
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            Vorige
          </button>
          <span className="current">
            {pageIndex + 1} / {pageCount}
          </span>
          <button
            type="button"
            className={!table.getCanNextPage() ? 'disabled' : undefined}
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            Volgende
          </button>
        </nav>
      ) : null}
    </div>
  );
}
