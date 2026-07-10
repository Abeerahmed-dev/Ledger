'use client';

import React from 'react';
import type { PaginationMeta } from '../../lib/pagination';

interface Props {
  pagination: PaginationMeta;
  onPageChange: (page: number) => void;
}

export function PaginationBar({ pagination, onPageChange }: Props) {
  if (pagination.totalPages <= 1) return null;

  const start = (pagination.page - 1) * pagination.pageSize + 1;
  const end = Math.min(pagination.page * pagination.pageSize, pagination.total);

  return (
    <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between gap-3">
      <button
        type="button"
        onClick={() => onPageChange(pagination.page - 1)}
        disabled={pagination.page <= 1}
        className="px-4 py-2 rounded-xl text-xs font-bold border-2 border-slate-200 text-slate-600 hover:border-indigo-300 hover:text-indigo-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        ← Previous
      </button>
      <span className="text-xs font-semibold text-slate-500 text-center">
        Showing {start}–{end} of {pagination.total.toLocaleString()}
        <span className="hidden sm:inline"> · Page {pagination.page} of {pagination.totalPages}</span>
      </span>
      <button
        type="button"
        onClick={() => onPageChange(pagination.page + 1)}
        disabled={!pagination.hasMore}
        className="px-4 py-2 rounded-xl text-xs font-bold border-2 border-slate-200 text-slate-600 hover:border-indigo-300 hover:text-indigo-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        Next →
      </button>
    </div>
  );
}
