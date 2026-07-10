import React from 'react';
import { getOwnerTruth } from '../../../reports';

export const revalidate = 0; // Dynamic server component

export default async function OwnerRealityPage() {
  let truth = {
    cashOnHand: 0,
    moneyLockedInProduct: 0,
    lockedInYarn: 0,
    lockedInShirts: 0,
    rawYarnStock: 0,
    avgYarnCostPerLb: 0,
    finishedShirtStock: 0,
    avgFinishedShirtCost: 0,
    totalDebt: 0,
    supplierDebt: 0,
    makerDebt: 0,
    supplierDebts: [] as { name: string; balance: number }[],
    makerDebts: [] as { name: string; balance: number }[],
    totalOwedToYou: 0,
    customerOwed: [] as { name: string; balance: number }[],
    netBusinessValue: 0,
  };
  let errorMsg: string | null = null;

  try {
    const fetched = await getOwnerTruth();
    truth = fetched;
  } catch (error: any) {
    console.error('Failed to load owner truth dashboard:', error);
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
    <div className="p-8 space-y-8">
      {/* Header Banner */}
      <div className="flex justify-between items-center border-b border-slate-200 pb-5">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">Net Worth (Asal Maaliat)</h2>
          <p className="text-sm text-slate-500 mt-1">
            Cash (Naqdi) + Inventory Value (Maal Pasa Hua) + To Receive (Paisa Lena Hai) − To Pay (Paisa Dena Hai)
          </p>
        </div>
      </div>

      {/* Database connection alert message */}
      {errorMsg && (
        <div className="rounded-lg bg-amber-50 p-4 border border-amber-200">
          <div className="flex">
            <div className="shrink-0">
              <svg className="h-5 w-5 text-amber-600" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.537-1.517 2.537H3.72c-1.347 0-2.19-1.37-1.517-2.537l6.28-10.875zM10 8a.75.75 0 01.75.75v3.75a.75.75 0 01-1.5 0v-3.75A.75.75 0 0110 8zm0 7a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-semibold text-amber-800">Database Offline / Unseeded</h3>
              <div className="text-xs text-amber-700 mt-1">{errorMsg}</div>
            </div>
          </div>
        </div>
      )}

      {/* Main Grid */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
        {/* Metric 1: Total Cash on Hand */}
        <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 shadow-sm hover:shadow-md transition-shadow">
          <dt className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Cash on Hand (Naqdi)</dt>
          <dd className={`mt-2 text-2xl font-extrabold tracking-tight ${truth.cashOnHand >= 0 ? 'text-slate-900' : 'text-rose-600'}`}>
            {formatPKR(truth.cashOnHand)}
          </dd>
          <div className="text-[10px] text-slate-400 mt-1">Cash reserves in A/C 1000</div>
        </div>

        {/* Metric 2: Money Locked in Product */}
        <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 shadow-sm hover:shadow-md transition-shadow">
          <dt className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Inventory Value (Maal Pasa Hua)</dt>
          <dd className="mt-2 text-2xl font-extrabold tracking-tight text-slate-900">
            {formatPKR(truth.moneyLockedInProduct)}
          </dd>
          <div className="text-[10px] text-slate-400 mt-1">Yarn weight + shirt cost in warehouse</div>
        </div>

        {/* Metric 3: Total Debt */}
        <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 shadow-sm hover:shadow-md transition-shadow">
          <dt className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total To Pay (Paisa Dena Hai)</dt>
          <dd className="mt-2 text-2xl font-extrabold tracking-tight text-rose-600">
            {formatPKR(truth.totalDebt)}
          </dd>
          <div className="text-[10px] text-slate-400 mt-1">Total AP due to Suppliers & Makers</div>
        </div>

        {/* Metric 4: Total Owed to You */}
        <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 shadow-sm hover:shadow-md transition-shadow">
          <dt className="text-xs font-semibold text-slate-500 uppercase tracking-wider">To Receive (Paisa Lena Hai)</dt>
          <dd className="mt-2 text-2xl font-extrabold tracking-tight text-indigo-600">
            {formatPKR(truth.totalOwedToYou)}
          </dd>
          <div className="text-[10px] text-slate-400 mt-1">Total AR outstanding from customers</div>
        </div>
      </div>

      {/* Metric 5: Net Business Value (Big Banner Card) */}
      <div className="rounded-2xl bg-gradient-to-r from-slate-950 via-slate-900 to-indigo-950 p-8 text-white shadow-xl border border-slate-800 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="max-w-xl">
          <h3 className="text-sm font-semibold tracking-wider text-indigo-400 uppercase">Net Worth (Asal Maaliat)</h3>
          <p className="text-xs text-slate-400 mt-2 leading-relaxed">
            Consolidated enterprise valuation based on tangible capital assets: Cash + Inventory Assets value + Outstanding Receivables (AR) minus Consolidated Outstanding Payables (AP).
          </p>
        </div>
        <div className="text-right shrink-0">
          <span className="block text-[10px] text-slate-400 font-semibold uppercase">Net Equity Balance</span>
          <span className={`text-3xl lg:text-4xl font-black ${truth.netBusinessValue >= 0 ? 'text-indigo-400' : 'text-rose-400'}`}>
            {formatPKR(truth.netBusinessValue)}
          </span>
        </div>
      </div>

      {/* Detailed Capital Breakdowns */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Column 1: Inventory Assets Breakdown */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
          <div>
            <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wider border-b border-slate-100 pb-2">Warehouse / Godown (Inventory)</h4>
            <p className="text-xs text-slate-500 mt-1">Valuation of current physical assets in Main Warehouse.</p>
          </div>
          <div className="space-y-3">
            <div className="flex justify-between items-center text-xs">
              <div>
                <span className="font-semibold text-slate-700 block">Raw Yarn Stock</span>
                <span className="text-[10px] text-slate-400 font-medium">{truth.rawYarnStock.toLocaleString()} lbs @ {formatPKR(truth.avgYarnCostPerLb)}/lb</span>
              </div>
              <span className="font-mono font-bold text-slate-800">{formatPKR(truth.lockedInYarn)}</span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <div>
                <span className="font-semibold text-slate-700 block">Finished Shirts</span>
                <span className="text-[10px] text-slate-400 font-medium">{truth.finishedShirtStock.toLocaleString()} pcs @ {formatPKR(truth.avgFinishedShirtCost)}/pc</span>
              </div>
              <span className="font-mono font-bold text-slate-800">{formatPKR(truth.lockedInShirts)}</span>
            </div>
          </div>
        </div>

        {/* Column 2: Total Debt Breakdown */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
          <div>
            <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wider border-b border-slate-100 pb-2">To Pay (Paisa Dena Hai)</h4>
            <p className="text-xs text-slate-500 mt-1">Outstanding payables to Sootar Walay &amp; Karkhana.</p>
          </div>
          <div className="space-y-4 text-xs">
            {/* Yarn Suppliers */}
            <div>
              <div className="flex justify-between items-center font-bold text-slate-800 border-b border-slate-50 pb-1 mb-1">
                <span>Suppliers (Sootar Walay)</span>
                <span className="font-mono">{formatPKR(truth.supplierDebt)}</span>
              </div>
              {truth.supplierDebts && truth.supplierDebts.length > 0 ? (
                <ul className="space-y-1 pl-2 text-[11px] text-slate-500 font-medium">
                  {truth.supplierDebts.map((d, index) => (
                    <li key={index} className="flex justify-between">
                      <span>• {d.name}</span>
                      <span className="font-mono">
                        {d.balance < 0 ? `${formatPKR(Math.abs(d.balance))} (Adv)` : formatPKR(d.balance)}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <span className="text-[10px] text-slate-400 italic pl-2">No outstanding supplier balances.</span>
              )}
            </div>

            {/* Stitching Makers */}
            <div>
              <div className="flex justify-between items-center font-bold text-slate-800 border-b border-slate-50 pb-1 mb-1">
                <span>Makers (Karkhana / Thekedar)</span>
                <span className="font-mono">{formatPKR(truth.makerDebt)}</span>
              </div>
              {truth.makerDebts && truth.makerDebts.length > 0 ? (
                <ul className="space-y-1 pl-2 text-[11px] text-slate-500 font-medium">
                  {truth.makerDebts.map((d, index) => (
                    <li key={index} className="flex justify-between">
                      <span>• {d.name}</span>
                      <span className="font-mono">
                        {d.balance < 0 ? `${formatPKR(Math.abs(d.balance))} (Adv)` : formatPKR(d.balance)}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <span className="text-[10px] text-slate-400 italic pl-2">No outstanding maker charges.</span>
              )}
            </div>
          </div>
        </div>

        {/* Column 3: Receivables Breakdown */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
          <div>
            <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wider border-b border-slate-100 pb-2">To Receive (Paisa Lena Hai)</h4>
            <p className="text-xs text-slate-500 mt-1">Outstanding bills from Companies (Party).</p>
          </div>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between items-center font-bold text-slate-800 border-b border-slate-50 pb-1 mb-1">
              <span>Companies (Party) — Bills Due</span>
              <span className="font-mono">{formatPKR(truth.totalOwedToYou)}</span>
            </div>
            {truth.customerOwed && truth.customerOwed.length > 0 ? (
              <ul className="space-y-1 pl-2 text-[11px] text-slate-500 font-medium">
                {truth.customerOwed.map((d, index) => (
                  <li key={index} className="flex justify-between">
                    <span>• {d.name}</span>
                    <span className="font-mono">
                      {d.balance < 0 ? `${formatPKR(Math.abs(d.balance))} (Credit)` : formatPKR(d.balance)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <span className="text-[10px] text-slate-400 italic pl-2">No outstanding customer invoices.</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
