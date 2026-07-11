'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useRouter, usePathname } from 'next/navigation';
import { PaginationBar } from '../../components/PaginationBar';
import type { PaginationMeta } from '../../../lib/pagination';

const paymentSchema = z.object({
  entityId: z.string().uuid('Please select a valid maker.'),
  amount: z.number().positive('Payment amount must be greater than zero.'),
  paymentType: z.enum(['INBOUND', 'OUTBOUND']),
});

type PaymentInputs = z.infer<typeof paymentSchema>;

interface MakerRecord {
  id: string;
  name: string;
}

interface JwoOptionRecord {
  id: string;
  orderNumber: string;
  makerId: string;
}

interface JobWorkOrderCard {
  id: string;
  orderNumber: string;
  makerId: string;
  makerName: string;
  date: string;
  status: string;
  materialStatus: string;
  yarnIssuedLbs: number;
  shirtsReceivedPcs: number;
  laborCost: number;
  receivedItems?: { itemName: string; quantity: number }[];
}

interface Props {
  makers: MakerRecord[];
  jwoOptions: JwoOptionRecord[];
  jobWorkOrders: JobWorkOrderCard[];
  pagination: PaginationMeta;
  metrics: {
    totalBilled: number;
    totalPaid: number;
    advancePaid: number;
    remaining: number;
  };
  filters: {
    makerId: string;
    jwoId: string;
    status: string;
  };
}

export function MakerTable({ makers, jwoOptions, jobWorkOrders, pagination, metrics, filters }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [showFilters, setShowFilters] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedMakerId, setSelectedMakerId] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    reset,
    watch,
    formState: { errors },
  } = useForm<PaymentInputs>({
    resolver: zodResolver(paymentSchema),
    defaultValues: {
      paymentType: 'OUTBOUND',
      entityId: filters.makerId || '',
    },
  });

  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);

  const handleFilterChange = (key: string, value: string) => {
    const params = new URLSearchParams(window.location.search);
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    if (key === 'makerId') {
      params.delete('jwoId');
    }
    params.delete('page');
    router.push(`${pathname}?${params.toString()}`);
  };

  const handlePageChange = (page: number) => {
    const params = new URLSearchParams(window.location.search);
    params.set('page', String(page));
    router.push(`${pathname}?${params.toString()}`);
  };

  const handleResetFilters = () => {
    router.push(pathname);
  };

  const openPaymentModal = (makerId?: string) => {
    const defaultId = makerId || filters.makerId || (makers[0]?.id || '');
    setValue('entityId', defaultId);
    setValue('amount', 0);
    setSelectedMakerId(defaultId);
    setErrorMessage(null);
    setIsPaymentModalOpen(true);
  };

  const closePaymentModal = () => {
    setIsPaymentModalOpen(false);
    reset();
  };

  const onSubmitPayment = async (data: PaymentInputs) => {
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const res = await fetch('/api/payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      const body = await res.json();

      if (!res.ok) {
        throw new Error(body.error || 'Server error occurred during payment registration.');
      }

      closePaymentModal();
      router.refresh();
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || 'Payment registration failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatPKR = (amount: number) => {
    const absVal = Math.abs(amount);
    return new Intl.NumberFormat('en-PK', {
      style: 'currency',
      currency: 'PKR',
      minimumFractionDigits: 0,
    }).format(absVal);
  };

  // Calculate aggregated totals
  const totalYarnIssued = jobWorkOrders.reduce((sum, o) => sum + o.yarnIssuedLbs, 0);
  const totalShirtsReceived = jobWorkOrders.reduce((sum, o) => sum + o.shirtsReceivedPcs, 0);
  const totalLaborCost = jobWorkOrders.reduce((sum, o) => sum + o.laborCost, 0);

  return (
    <div className="space-y-6 pb-24 md:pb-8">
      {/* Controls Bar */}
      <div className="flex flex-col sm:flex-row gap-3 justify-between items-stretch sm:items-center bg-white p-4 rounded-3xl border-2 border-slate-200 shadow-sm">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 rounded-2xl border-2 border-slate-350 bg-white px-5 py-3 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
          >
            <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
            </svg>
            <span>{showFilters ? 'Hide Filters' : 'Filter / Search'}</span>
          </button>

          {(filters.makerId || filters.jwoId || filters.status) && (
            <button
              onClick={handleResetFilters}
              className="text-xs text-rose-600 hover:text-rose-500 font-bold px-2 py-1 transition-colors cursor-pointer"
            >
              Reset
            </button>
          )}
        </div>

        <button
          onClick={() => openPaymentModal()}
          className="flex items-center justify-center gap-2 rounded-2xl bg-indigo-650 hover:bg-indigo-600 px-5 py-3.5 text-xs font-bold text-white shadow transition-colors cursor-pointer"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          <span>Add Payment (Paisa Diya)</span>
        </button>
      </div>

      {/* Expandable Filter Grid */}
      {showFilters && (
        <div className="bg-white border-2 border-slate-200 rounded-[28px] shadow-sm p-5 animate-in fade-in duration-200">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {/* Maker Name */}
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Maker Name</label>
              <select
                value={filters.makerId}
                onChange={(e) => handleFilterChange('makerId', e.target.value)}
                className="block w-full rounded-xl border-2 border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-900"
              >
                <option value="">All Makers</option>
                {makers.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>

            {/* JWO Options */}
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Job Work Order (JWO)</label>
              <select
                value={filters.jwoId}
                onChange={(e) => handleFilterChange('jwoId', e.target.value)}
                className="block w-full rounded-xl border-2 border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-900"
              >
                <option value="">All orders</option>
                {jwoOptions.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.orderNumber}
                  </option>
                ))}
              </select>
            </div>

            {/* Material Status */}
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Material Status</label>
              <select
                value={filters.status}
                onChange={(e) => handleFilterChange('status', e.target.value)}
                className="block w-full rounded-xl border-2 border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-900"
              >
                <option value="">All Statuses</option>
                <option value="Pending Shirts">Pending Shirts (Silai Baqi)</option>
                <option value="Returned">Returned (Shirts Mil Gayi)</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* 4-Pillar Ledger UI */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Billed */}
        <div className="bg-white border-2 border-slate-200 rounded-[28px] p-5 shadow-sm space-y-1">
          <span className="block text-[10px] text-slate-500 font-bold uppercase tracking-wider">Total Billed (Kul Bill)</span>
          <span className="block text-xl font-black text-slate-900">{formatPKR(metrics.totalBilled)}</span>
          <span className="text-[9px] text-slate-400 font-medium">Billed labor services</span>
        </div>

        {/* Card 2: Total Paid */}
        <div className="bg-white border-2 border-slate-200 rounded-[28px] p-5 shadow-sm space-y-1">
          <span className="block text-[10px] text-slate-500 font-bold uppercase tracking-wider">Total Paid (Adaigi)</span>
          <span className="block text-xl font-black text-slate-900">{formatPKR(metrics.totalPaid)}</span>
          <span className="text-[9px] text-slate-400 font-medium">Excluding advances</span>
        </div>

        {/* Card 3: Advance Paid */}
        <div className="bg-white border-2 border-slate-200 rounded-[28px] p-5 shadow-sm space-y-1 flex flex-col justify-between">
          <div>
            <span className="block text-[10px] text-slate-500 font-bold uppercase tracking-wider">Advance Paid (Peshgi)</span>
            <div className={`flex items-center gap-1 mt-1 text-xl font-black ${
              metrics.advancePaid > 0 ? 'text-emerald-600' : 'text-slate-900'
            }`}>
              {metrics.advancePaid > 0 && (
                <svg className="w-5 h-5 text-emerald-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 11l7-7 7 7M5 19l7-7 7 7" />
                </svg>
              )}
              <span>{formatPKR(metrics.advancePaid)}</span>
            </div>
          </div>
          <span className="text-[9px] text-slate-400 font-medium">Unconsumed balance</span>
        </div>

        {/* Card 4: Remaining (Baqaya) */}
        <div className="bg-white border-2 border-slate-200 rounded-[28px] p-5 shadow-sm space-y-1 flex flex-col justify-between">
          <div>
            <span className="block text-[10px] text-slate-500 font-bold uppercase tracking-wider">Remaining (Baqaya)</span>
            <div className={`flex items-center gap-1 mt-1 text-xl font-black ${
              metrics.remaining > 0 ? 'text-rose-600' : 'text-slate-900'
            }`}>
              {metrics.remaining > 0 && (
                <svg className="w-5 h-5 text-rose-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 13l-7 7-7-7m14-6l-7 7-7-7" />
                </svg>
              )}
              <span>{formatPKR(metrics.remaining)}</span>
            </div>
          </div>
          <span className="text-[9px] text-slate-400 font-medium">Net balance owed</span>
        </div>
      </div>

      {/* JWO Cards List - Thick vertical cards with large fonts */}
      <div className="space-y-4">
        {jobWorkOrders.length > 0 ? (
          jobWorkOrders.map((order) => (
            <div
              key={order.id}
              className="bg-white rounded-[32px] border-2 border-slate-200 p-6 shadow-sm flex flex-col gap-4 hover:border-indigo-300 transition-colors"
            >
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-slate-100 pb-3">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs text-slate-400 font-bold">{order.date}</span>
                    <span className={`inline-block rounded-full px-2.5 py-0.5 text-[9px] font-black uppercase tracking-wider ${
                      order.status === 'COMPLETED' ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-800'
                    }`}>
                      {order.status}
                    </span>
                    <span className={`inline-block rounded-full px-2.5 py-0.5 text-[9px] font-black uppercase tracking-wider ${
                      order.materialStatus === 'Returned' ? 'bg-emerald-50 text-emerald-800' : 'bg-rose-50 text-rose-800'
                    }`}>
                      {order.materialStatus === 'Returned' ? 'Returned (Shirts Mil Gayi)' : 'Pending (Silai Baqi)'}
                    </span>
                  </div>
                  {/* Large order number and maker name */}
                  <h4 className="text-lg sm:text-xl font-black text-slate-900 leading-tight">
                    {order.orderNumber} <span className="text-slate-400 font-bold">| Maker:</span> {order.makerName}
                  </h4>
                </div>

                {/* Labor Charges with downward red arrow */}
                <div className="text-right flex flex-col items-end">
                  <span className="block text-[10px] text-slate-500 font-bold uppercase">Stitching Cost</span>
                  <div className="flex items-center gap-1 text-rose-600 font-black text-lg sm:text-xl mt-0.5">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 13l-7 7-7-7m14-6l-7 7-7-7" />
                    </svg>
                    <span>{formatPKR(order.laborCost)}</span>
                  </div>
                  <span className="text-[10px] text-rose-500 font-extrabold">Paisa Dena Hai (To Pay)</span>
                </div>
              </div>

              {/* Stats Row */}
              <div className="grid grid-cols-2 gap-4 text-xs font-bold text-slate-600">
                <div>
                  <span className="block text-[9px] text-slate-400 uppercase mb-0.5">Yarn Issued</span>
                  <span className="text-slate-800 text-sm font-extrabold">{order.yarnIssuedLbs.toLocaleString()} lbs</span>
                </div>
                <div>
                  <span className="block text-[9px] text-slate-400 uppercase mb-0.5">Shirts Received</span>
                  <span className="text-slate-800 text-sm font-extrabold">{order.shirtsReceivedPcs.toLocaleString()} pcs</span>
                  {order.receivedItems && order.receivedItems.length > 0 && (
                    <div className="mt-1 space-y-0.5">
                      {order.receivedItems.map((item, idx) => (
                        <span key={idx} className="block text-[10px] text-indigo-600 font-semibold leading-tight">
                          • {item.itemName}: <span className="font-bold">{item.quantity.toLocaleString()} pcs</span>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex justify-end pt-3 border-t border-slate-100">
                <button
                  onClick={() => openPaymentModal(order.makerId)}
                  className="rounded-xl bg-slate-50 border-2 border-slate-200 hover:bg-slate-100 px-4 py-2 text-xs font-black text-indigo-700 active:scale-95 cursor-pointer transition-transform"
                >
                  Pay Maker (Paisa Bhejein)
                </button>
              </div>
            </div>
          ))
        ) : (
          <div className="bg-white rounded-[32px] border-2 border-slate-200 p-12 text-center text-slate-400 font-bold">
            No orders found.
          </div>
        )}
      </div>

      <PaginationBar pagination={pagination} onPageChange={handlePageChange} />

      {/* Payment Modal Backdrop */}
      {isPaymentModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white border-2 border-slate-200 rounded-[36px] shadow-2xl overflow-hidden animate-in fade-in duration-200">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="text-base font-black text-slate-900">Record Outbound Payment (Paisa Diya)</h3>
              <button
                onClick={closePaymentModal}
                className="text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleSubmit(onSubmitPayment)} className="p-6 space-y-6">
              {/* Select Maker */}
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Select Maker (Karkhana Select Karein)</label>
                <select
                  {...register('entityId')}
                  className="block w-full rounded-2xl border-2 border-slate-200 bg-white px-4 py-3.5 text-base font-bold text-slate-950"
                  value={watch('entityId')}
                  onChange={(e) => setValue('entityId', e.target.value)}
                >
                  <option value="">-- Choose Maker --</option>
                  {makers.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
                {errors.entityId && (
                  <p className="mt-2 text-xs text-rose-600 font-bold">{errors.entityId.message}</p>
                )}
              </div>

              {/* Amount input */}
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Payment Amount (PKR) (Raqam)</label>
                <input
                  type="number"
                  step="0.01"
                  {...register('amount', { valueAsNumber: true })}
                  className="mt-2 block w-full rounded-2xl border-2 border-slate-200 px-4 py-3.5 text-lg font-bold"
                />
                <p className="mt-2 text-[11px] text-slate-450 font-semibold leading-relaxed">
                  Entering an amount greater than the current balance will automatically record the difference as an Advance.
                </p>
                {errors.amount && (
                  <p className="mt-2 text-xs text-rose-600 font-bold">{errors.amount.message}</p>
                )}
              </div>

              {errorMessage && (
                <div className="rounded-xl bg-rose-50 p-4 border border-rose-250 text-xs text-rose-800 font-bold">
                  {errorMessage}
                </div>
              )}

              <div className="flex gap-3 justify-end pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={closePaymentModal}
                  className="rounded-2xl border-2 border-slate-350 px-5 py-3 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="rounded-2xl bg-indigo-600 px-5 py-3 text-xs font-black text-white hover:bg-indigo-500 disabled:bg-indigo-400 transition-colors cursor-pointer"
                >
                  {isSubmitting ? 'Posting Ledger...' : 'Post Outbound Payment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
