'use client';

import React from 'react';
import { useRouter, usePathname } from 'next/navigation';
import type { PaginationMeta } from '../../../lib/pagination';

interface LogEntry {
  id: string;
  timestamp: string;
  actionType: string;
  description: string;
}

interface Props {
  logs: LogEntry[];
  initialMonth: number;
  initialYear: number;
  selectedType: string;
  pagination: PaginationMeta;
  totalYarnBought: number;
  totalShirtsReceived: number;
  totalSales: number;
  totalExpenses: number;
}

const MONTH_NAMES = [
  '', 'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export function HistoryLogs({
  logs,
  initialMonth,
  initialYear,
  selectedType,
  pagination,
  totalYarnBought,
  totalShirtsReceived,
  totalSales,
  totalExpenses,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();

  const buildUrl = (overrides: { month?: number; year?: number; page?: number; type?: string }) => {
    const params = new URLSearchParams();
    params.set('month', String(overrides.month ?? initialMonth));
    params.set('year', String(overrides.year ?? initialYear));
    params.set('page', String(overrides.page ?? pagination.page));
    const type = overrides.type ?? selectedType;
    if (type && type !== 'ALL') {
      params.set('type', type);
    }
    return `${pathname}?${params.toString()}`;
  };

  const handleMonthChange = (direction: 'prev' | 'next') => {
    let m = initialMonth;
    let y = initialYear;
    if (direction === 'prev') {
      m -= 1;
      if (m < 1) {
        m = 12;
        y -= 1;
      }
    } else {
      m += 1;
      if (m > 12) {
        m = 1;
        y += 1;
      }
    }
    router.push(buildUrl({ month: m, year: y, page: 1 }));
  };

  const handleTypeChange = (type: string) => {
    router.push(buildUrl({ type, page: 1 }));
  };

  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage > pagination.totalPages) return;
    router.push(buildUrl({ page: newPage }));
  };

  const typesList = [
    { value: 'ALL', label: 'All Action Types' },
    { value: 'PROCUREMENT', label: 'Procurements' },
    { value: 'MAKER_TRANSFER', label: 'Maker Transfers' },
    { value: 'GOODS_RECEIVED', label: 'Goods Receipts' },
    { value: 'INVOICE_GENERATED', label: 'Invoices Issued' },
    { value: 'PAYMENT_RECORDED', label: 'Payments Recorded' },
    { value: 'EXPENSE_RECORDED', label: 'Expenses Recorded' },
  ];

  const getBadgeClass = (type: string) => {
    switch (type) {
      case 'PROCUREMENT':
        return 'bg-blue-50 text-blue-700 border-blue-150';
      case 'MAKER_TRANSFER':
        return 'bg-amber-50 text-amber-700 border-amber-150';
      case 'GOODS_RECEIVED':
        return 'bg-emerald-50 text-emerald-700 border-emerald-150';
      case 'INVOICE_GENERATED':
        return 'bg-purple-50 text-purple-700 border-purple-150';
      case 'PAYMENT_RECORDED':
        return 'bg-indigo-50 text-indigo-700 border-indigo-150';
      case 'EXPENSE_RECORDED':
        return 'bg-rose-50 text-rose-700 border-rose-150';
      default:
        return 'bg-slate-50 text-slate-700 border-slate-150';
    }
  };

  const formatActionName = (type: string) => {
    return type.replace('_', ' ');
  };

  const formatDescription = (log: LogEntry) => {
    if (log.actionType === 'GOODS_RECEIVED') {
      if (log.description.includes('(Expected:')) {
        const qtyMatch = log.description.match(/Received (\d+(?:,\d+)*) (?:pcs|shirts)/i);
        const makerMatch = log.description.match(/from Maker ([^(\n]+?) for/i);
        const qty = qtyMatch ? qtyMatch[1] : 'some';
        const makerName = makerMatch ? makerMatch[1].trim() : 'Maker';
        return `Received ${qty} shirts from ${makerName} on JWO Order`;
      }
    }
    return log.description;
  };

  const formatPKR = (amount: number) => {
    return new Intl.NumberFormat('en-PK', {
      style: 'currency',
      currency: 'PKR',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-white border-2 border-slate-200 rounded-[28px] p-3.5 shadow-sm max-w-xs mx-auto">
        <button
          onClick={() => handleMonthChange('prev')}
          className="p-2.5 text-slate-650 hover:text-indigo-600 cursor-pointer hover:bg-slate-100 rounded-full font-black text-lg active:scale-90 transition-transform select-none"
        >
          &larr;
        </button>
        <span className="font-extrabold text-slate-900 text-sm tracking-wide select-none">
          {MONTH_NAMES[initialMonth]} {initialYear}
        </span>
        <button
          onClick={() => handleMonthChange('next')}
          className="p-2.5 text-slate-650 hover:text-indigo-600 cursor-pointer hover:bg-slate-100 rounded-full font-black text-lg active:scale-90 transition-transform select-none"
        >
          &rarr;
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-indigo-600 rounded-[28px] p-5 shadow-sm text-white flex flex-col justify-between min-h-[110px]">
          <span className="text-[10px] uppercase font-black tracking-wider text-indigo-200 leading-tight">
            Total Yarn Bought (Dhaaga Aaya)
          </span>
          <span className="text-xl sm:text-2xl font-black mt-2">
            {totalYarnBought.toLocaleString()} KG
          </span>
        </div>

        <div className="bg-amber-600 rounded-[28px] p-5 shadow-sm text-white flex flex-col justify-between min-h-[110px]">
          <span className="text-[10px] uppercase font-black tracking-wider text-amber-100 leading-tight">
            Total Shirts (Maal Ban Gaya)
          </span>
          <span className="text-xl sm:text-2xl font-black mt-2">
            {totalShirtsReceived.toLocaleString()} Pcs
          </span>
        </div>

        <div className="bg-emerald-50 rounded-[28px] p-5 shadow-sm border-2 border-emerald-150 flex flex-col justify-between min-h-[110px]">
          <span className="text-[10px] uppercase font-black tracking-wider text-emerald-800 leading-tight">
            Total Sales (Kul Bikri)
          </span>
          <span className="text-xl sm:text-2xl font-black text-emerald-600 font-sans mt-2">
            {formatPKR(totalSales)}
          </span>
        </div>

        <div className="bg-rose-50 rounded-[28px] p-5 shadow-sm border-2 border-rose-150 flex flex-col justify-between min-h-[110px]">
          <span className="text-[10px] uppercase font-black tracking-wider text-rose-800 leading-tight">
            Total Expenses (Kul Kharcha)
          </span>
          <span className="text-xl sm:text-2xl font-black text-rose-650 font-sans mt-2">
            {formatPKR(totalExpenses)}
          </span>
        </div>
      </div>

      <div className="bg-white border-2 border-slate-200 rounded-[28px] shadow-sm p-5">
        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
          Filter Category (Kaam Ki Qisam)
        </label>
        <select
          value={selectedType}
          onChange={(e) => handleTypeChange(e.target.value)}
          className="block w-full rounded-2xl border-2 border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-900 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
        >
          {typesList.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </div>

      <div className="bg-white border-2 border-slate-200 rounded-[32px] shadow-sm overflow-hidden divide-y divide-slate-100">
        <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
          <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
            Log Entries (Record) ({pagination.total.toLocaleString()})
          </h3>
          <span className="text-[10px] font-semibold text-slate-400">
            Page {pagination.page} of {pagination.totalPages}
          </span>
        </div>

        <div className="divide-y divide-slate-100 bg-white">
          {logs.length > 0 ? (
            logs.map((log) => {
              const dateStr = new Date(log.timestamp).toLocaleString('en-US', {
                dateStyle: 'medium',
                timeStyle: 'short',
              });

              return (
                <div key={log.id} className="p-5 hover:bg-slate-50 transition-colors space-y-2.5">
                  <div className="flex justify-between items-center text-[10px]">
                    <span className="font-semibold text-slate-400">{dateStr}</span>
                    <span className={`inline-block px-2.5 py-0.5 rounded-full border text-[9px] font-black uppercase tracking-wider ${getBadgeClass(log.actionType)}`}>
                      {formatActionName(log.actionType)}
                    </span>
                  </div>
                  <div className="text-sm font-black text-slate-950 leading-relaxed font-sans">
                    {formatDescription(log)}
                  </div>
                </div>
              );
            })
          ) : (
            <div className="p-12 text-center text-slate-450 space-y-2">
              <svg className="mx-auto h-10 w-10 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              <p className="text-sm font-extrabold text-slate-800">No activity log entries found</p>
              <p className="text-xs text-slate-400">Try adjusting your category filter or selecting another month.</p>
            </div>
          )}
        </div>

        {pagination.totalPages > 1 && (
          <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => handlePageChange(pagination.page - 1)}
              disabled={pagination.page <= 1}
              className="px-4 py-2 rounded-xl text-xs font-bold border-2 border-slate-200 text-slate-600 hover:border-indigo-300 hover:text-indigo-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              ← Previous
            </button>
            <span className="text-xs font-semibold text-slate-500">
              Showing {((pagination.page - 1) * pagination.pageSize) + 1}–{Math.min(pagination.page * pagination.pageSize, pagination.total)} of {pagination.total.toLocaleString()}
            </span>
            <button
              type="button"
              onClick={() => handlePageChange(pagination.page + 1)}
              disabled={!pagination.hasMore}
              className="px-4 py-2 rounded-xl text-xs font-bold border-2 border-slate-200 text-slate-600 hover:border-indigo-300 hover:text-indigo-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Next →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
