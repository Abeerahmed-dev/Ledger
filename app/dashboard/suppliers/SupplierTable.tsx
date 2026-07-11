'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useRouter, usePathname } from 'next/navigation';
import { PaginationBar } from '../../components/PaginationBar';
import type { PaginationMeta } from '../../../lib/pagination';

const paymentSchema = z.object({
  entityId: z.string().uuid('Please select a valid supplier.'),
  amount: z.number().positive('Payment amount must be greater than zero.'),
  paymentType: z.enum(['INBOUND', 'OUTBOUND']),
});

type PaymentInputs = z.infer<typeof paymentSchema>;

interface SupplierRecord {
  id: string;
  name: string;
}

interface YarnItemRecord {
  id: string;
  name: string;
  sku: string;
}

interface TransactionCard {
  id: string;
  type: 'PURCHASE' | 'PAYMENT';
  date: string;
  entityId: string;
  entityName: string;
  itemName: string | null;
  itemId: string | null;
  sku: string | null;
  quantity: number;
  totalPrice: number;
  invoiceNumber: string;
}

interface Props {
  suppliers: SupplierRecord[];
  yarnItems: YarnItemRecord[];
  transactionCards: TransactionCard[];
  pagination: PaginationMeta;
  metrics: {
    totalBilled: number;
    totalPaid: number;
    advancePaid: number;
    remaining: number;
  };
  filters: {
    supplierId: string;
    itemId: string;
    startDate: string;
    endDate: string;
  };
}

export function SupplierTable({ suppliers, yarnItems, transactionCards, pagination, metrics, filters }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [showFilters, setShowFilters] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedSupplierId, setSelectedSupplierId] = useState<string | null>(null);

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
      entityId: filters.supplierId || '',
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

  const openPaymentModal = (supplierId?: string) => {
    const defaultId = supplierId || filters.supplierId || (suppliers[0]?.id || '');
    setValue('entityId', defaultId);
    setValue('amount', 0);
    setSelectedSupplierId(defaultId);
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

  // Aggregated totals
  const purchaseTransactions = transactionCards.filter(c => c.type === 'PURCHASE');
  const paymentTransactions = transactionCards.filter(c => c.type === 'PAYMENT');

  const totalKg = purchaseTransactions.reduce((sum, c) => sum + c.quantity, 0);
  const totalBilled = purchaseTransactions.reduce((sum, c) => sum + c.totalPrice, 0);
  const totalPaid = paymentTransactions.reduce((sum, c) => sum + c.totalPrice, 0);

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

          {(filters.supplierId || filters.itemId || filters.startDate || filters.endDate) && (
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
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
            {/* Supplier Name */}
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 font-sans">Supplier Name (Sootar Wala)</label>
              <select
                value={filters.supplierId}
                onChange={(e) => handleFilterChange('supplierId', e.target.value)}
                className="block w-full rounded-xl border-2 border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-900"
              >
                <option value="">All Suppliers</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Yarn Type */}
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Yarn/Material Type</label>
              <select
                value={filters.itemId}
                onChange={(e) => handleFilterChange('itemId', e.target.value)}
                className="block w-full rounded-xl border-2 border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-900"
              >
                <option value="">All Yarn Types</option>
                {yarnItems.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name} ({item.sku})
                  </option>
                ))}
              </select>
            </div>

            {/* Start Date */}
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Start Date (Shuru Date)</label>
              <input
                type="date"
                value={filters.startDate}
                onChange={(e) => handleFilterChange('startDate', e.target.value)}
                className="block w-full rounded-xl border-2 border-slate-200 px-3 py-2 text-xs font-bold"
              />
            </div>

            {/* End Date */}
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">End Date (Khatam Date)</label>
              <input
                type="date"
                value={filters.endDate}
                onChange={(e) => handleFilterChange('endDate', e.target.value)}
                className="block w-full rounded-xl border-2 border-slate-200 px-3 py-2 text-xs font-bold"
              />
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
          <span className="text-[9px] text-slate-400 font-medium">Yarn purchases invoiced</span>
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

      {/* Transaction Cards List - Thick vertical cards with large fonts */}
      <div className="space-y-4">
        {transactionCards.length > 0 ? (
          transactionCards.map((card) => (
            <div
              key={card.id}
              className="bg-white rounded-[32px] border-2 border-slate-200 p-6 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 hover:border-indigo-300 transition-colors"
            >
              <div className="space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`inline-block rounded-full px-3 py-1 text-[9px] font-black uppercase tracking-wider ${
                    card.type === 'PAYMENT' ? 'bg-emerald-50 text-emerald-800' : 'bg-indigo-50 text-indigo-800'
                  }`}>
                    {card.type === 'PAYMENT' ? 'Payment (Paisa Diya)' : 'Yarn Purchase (Dhaaga Khareeda)'}
                  </span>
                  <span className="text-xs text-slate-400 font-bold">{card.date}</span>
                </div>
                {/* Large entity name */}
                <h4 className="text-lg sm:text-xl font-black text-slate-900 leading-tight">{card.entityName}</h4>
                {card.type === 'PURCHASE' ? (
                  <p className="text-xs text-slate-600 font-semibold leading-relaxed">
                    Yarn: <span className="font-extrabold text-slate-800">{card.itemName}</span> | 
                    Weight: <span className="font-extrabold text-indigo-600">{(card.quantity / 45.34).toFixed(1)} sacks ({card.quantity} kg)</span>
                  </p>
                ) : (
                  <p className="text-xs text-slate-500 font-bold leading-relaxed">{card.invoiceNumber}</p>
                )}
              </div>

              <div className="flex sm:flex-col justify-between items-end w-full sm:w-auto border-t border-slate-100 sm:border-t-0 pt-4 sm:pt-0 shrink-0 gap-3">
                {/* Strict Color Coding based on Business Favorability */}
                <div className="flex flex-col items-end">
                  <div className={`flex items-center gap-1.5 font-black text-lg sm:text-xl ${
                    card.type === 'PAYMENT' ? 'text-emerald-600' : 'text-rose-600'
                  }`}>
                    {card.type === 'PAYMENT' ? (
                      <svg className="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 11l7-7 7 7M5 19l7-7 7 7" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5 text-rose-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 13l-7 7-7-7m14-6l-7 7-7-7" />
                      </svg>
                    )}
                    <span>{formatPKR(card.totalPrice)}</span>
                  </div>
                  <span className={`text-[10px] font-extrabold ${
                    card.type === 'PAYMENT' ? 'text-emerald-600' : 'text-rose-500'
                  }`}>
                    {card.type === 'PURCHASE' ? 'Paisa Dena Hai (To Pay)' : 'Paid / Advance (Peshgi)'}
                  </span>
                </div>

                <button
                  onClick={() => openPaymentModal(card.entityId)}
                  className="rounded-xl bg-slate-50 border-2 border-slate-200 hover:bg-slate-100 px-4 py-2 text-xs font-black text-indigo-700 cursor-pointer active:scale-95 transition-transform"
                >
                  Pay Vendor (Paisa Bhejein)
                </button>
              </div>
            </div>
          ))
        ) : (
          <div className="bg-white rounded-[32px] border-2 border-slate-200 p-12 text-center text-slate-400 font-bold">
            No records found.
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
                className="text-slate-450 hover:text-slate-600 transition-colors cursor-pointer"
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleSubmit(onSubmitPayment)} className="p-6 space-y-6">
              {/* Select Supplier */}
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Select Supplier (Sootar Wala Select Karein)</label>
                <select
                  {...register('entityId')}
                  className="block w-full rounded-2xl border-2 border-slate-200 bg-white px-4 py-3.5 text-base font-bold text-slate-950"
                  value={watch('entityId')}
                  onChange={(e) => setValue('entityId', e.target.value)}
                >
                  <option value="">-- Choose Supplier --</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
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
