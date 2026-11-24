import type { ReactNode } from 'react'

export type Column<T> = {
  key: string
  header: string
  render: (row: T) => ReactNode
  className?: string
}

export function Table<T>({
  columns,
  rows,
  rowKey,
  loading,
  empty,
}: {
  columns: Column<T>[]
  rows: T[]
  rowKey: (row: T) => string
  loading: boolean
  empty: ReactNode
}) {
  return (
    <div className="overflow-hidden rounded-3xl border border-line bg-card shadow-card">
      <table className="w-full border-collapse text-left text-sm">
        <thead className="bg-paper/80 text-xs uppercase tracking-wide text-mute">
          <tr>
            {columns.map((column) => (
              <th key={column.key} className={`px-4 py-3 font-semibold ${column.className ?? ''}`}>
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading
            ? Array.from({ length: 5 }, (_, index) => (
                <tr key={index} className="border-t border-line">
                  {columns.map((column) => (
                    <td key={column.key} className="px-4 py-4">
                      <div className="h-4 animate-pulse rounded bg-line" />
                    </td>
                  ))}
                </tr>
              ))
            : null}
          {!loading && rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length}>{empty}</td>
            </tr>
          ) : null}
          {!loading
            ? rows.map((row) => (
                <tr key={rowKey(row)} className="border-t border-line hover:bg-paper/60">
                  {columns.map((column) => (
                    <td key={column.key} className={`px-4 py-3 align-middle ${column.className ?? ''}`}>
                      {column.render(row)}
                    </td>
                  ))}
                </tr>
              ))
            : null}
        </tbody>
      </table>
    </div>
  )
}
