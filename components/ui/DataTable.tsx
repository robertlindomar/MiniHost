import type { ReactNode } from "react";

export interface TableColumn<T> {
  header: string;
  cell: (item: T) => ReactNode;
  className?: string;
}

interface DataTableProps<T> {
  columns: TableColumn<T>[];
  data: T[];
  emptyMessage: string;
  getRowKey: (item: T) => string;
}

export function DataTable<T>({ columns, data, emptyMessage, getRowKey }: DataTableProps<T>) {
  return (
    <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-zinc-200">
          <thead className="bg-zinc-50">
            <tr>
              {columns.map((column) => (
                <th
                  key={column.header}
                  scope="col"
                  className={`whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-normal text-zinc-500 ${column.className ?? ""}`}
                >
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {data.length > 0 ? (
              data.map((item) => (
                <tr key={getRowKey(item)} className="transition hover:bg-zinc-50">
                  {columns.map((column) => (
                    <td key={column.header} className={`px-4 py-4 text-sm text-zinc-700 ${column.className ?? ""}`}>
                      {column.cell(item)}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={columns.length} className="px-4 py-10 text-center text-sm text-zinc-500">
                  {emptyMessage}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
