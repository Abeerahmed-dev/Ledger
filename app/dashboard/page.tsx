import React from 'react';
import Link from 'next/link';
import { getMacroOverview } from '../../reports';

export const revalidate = 0; // Dynamic server component

export default async function MacroDashboard() {
  let data = { sales: 0, cogs: 0, cash: 0, profit: 0 };
  let errorMsg: string | null = null;

  try {
    data = await getMacroOverview();
  } catch (error: any) {
    console.error('Failed to load macro dashboard:', error);
    errorMsg = error.message || 'Unknown database error';
  }

  const formatPKR = (amount: number) => {
    return new Intl.NumberFormat('en-PK', {
      style: 'currency',
      currency: 'PKR',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <div className="p-4 sm:p-8 space-y-6 pb-24 md:pb-8">
      {/* Header Banner */}
      <div className="flex justify-between items-center border-b border-slate-200 pb-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900">Home (Ghar)</h2>
          <p className="text-xs sm:text-sm text-slate-500">
            Karachi Textile Operations Dashboard
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-bold text-indigo-700 ring-1 ring-indigo-700/10">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 mr-1.5 animate-pulse"></span>
            Real-time
          </span>
        </div>
      </div>

      {/* Database Offline Error */}
      {errorMsg && (
        <div className="rounded-xl bg-amber-50 p-4 border border-amber-200 text-xs text-amber-800 font-medium">
          {errorMsg}
        </div>
      )}

      {/* 2. The Home Screen: Action-Driven Visual Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {/* Green Tile: Buy Yarn */}
        <Link
          href="/procurement"
          className="flex items-center gap-5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-3xl p-6 shadow-md transition-transform active:scale-95 cursor-pointer min-h-[110px]"
        >
          <div className="bg-emerald-700/40 p-4 rounded-2xl shrink-0">
            {/* Sack Icon */}
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
          </div>
          <div>
            <h3 className="text-lg font-black tracking-wide">Buy Yarn (Dhaaga Khareedein)</h3>
            <p className="text-xs text-emerald-100 font-medium mt-1">Tap here to buy yarn sacks from suppliers</p>
          </div>
        </Link>

        {/* Blue Tile: Send to Maker */}
        <Link
          href="/maker"
          className="flex items-center gap-5 bg-blue-600 hover:bg-blue-500 text-white rounded-3xl p-6 shadow-md transition-transform active:scale-95 cursor-pointer min-h-[110px]"
        >
          <div className="bg-blue-700/40 p-4 rounded-2xl shrink-0">
            {/* Delivery Truck Icon */}
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0" />
            </svg>
          </div>
          <div>
            <h3 className="text-lg font-black tracking-wide">Send to Maker (Maal Bhejein)</h3>
            <p className="text-xs text-blue-100 font-medium mt-1">Send yarn/fabric to stitching units</p>
          </div>
        </Link>

        {/* Orange Tile: Receive Shirts */}
        <Link
          href="/maker"
          className="flex items-center gap-5 bg-amber-600 hover:bg-amber-500 text-white rounded-3xl p-6 shadow-md transition-transform active:scale-95 cursor-pointer min-h-[110px]"
        >
          <div className="bg-amber-700/40 p-4 rounded-2xl shrink-0">
            {/* Shirt Icon */}
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 21h6l-.813-5.096m-4.374 0A6.002 6.002 0 016 10h12a6.002 6.002 0 01-3.813 5.904m-4.374 0L12 12m0 0L8.71 8.293A1 1 0 019 6.586V4a2 2 0 114 0v2.586a1 1 0 01.29 1.707L12 12z" />
            </svg>
          </div>
          <div>
            <h3 className="text-lg font-black tracking-wide">Receive Shirts (Tayar Maal Layein)</h3>
            <p className="text-xs text-amber-100 font-medium mt-1">Receive finished garments from stitching makers</p>
          </div>
        </Link>

        {/* Purple Tile: Make Bill */}
        <Link
          href="/sales"
          className="flex items-center gap-5 bg-purple-600 hover:bg-purple-500 text-white rounded-3xl p-6 shadow-md transition-transform active:scale-95 cursor-pointer min-h-[110px]"
        >
          <div className="bg-purple-700/40 p-4 rounded-2xl shrink-0">
            {/* Document/Bill Icon */}
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <div>
            <h3 className="text-lg font-black tracking-wide">Make Bill (Bill Banayein)</h3>
            <p className="text-xs text-purple-100 font-medium mt-1">Make invoice for customer party</p>
          </div>
        </Link>
      </div>

      {/* Financials & Overview Metrics */}
      <div className="space-y-4 pt-4">
        <h4 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Business Summary (Hisaab Kitaab)</h4>
        
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {/* Sales */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
            <span className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide">Total Sales (Farokht)</span>
            <span className="block text-2xl font-black text-slate-900 mt-1">{formatPKR(data.sales)}</span>
          </div>

          {/* Stitching Cost */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
            <span className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide">Stitching Billed (Silai Cost)</span>
            <span className="block text-2xl font-black text-slate-900 mt-1">{formatPKR(data.cogs)}</span>
          </div>

          {/* Cash on Hand */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
            <span className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide">Cash Balance (Tijori)</span>
            <span className={`block text-2xl font-black mt-1 ${data.cash >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
              {formatPKR(data.cash)}
            </span>
          </div>

          {/* Profit & Loss */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
            <span className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide">Profit/Loss (Nafa / Nuqsan)</span>
            <span className={`block text-2xl font-black mt-1 ${data.profit >= 0 ? 'text-indigo-600' : 'text-rose-600'}`}>
              {formatPKR(data.profit)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

