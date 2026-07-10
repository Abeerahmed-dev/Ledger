'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const schema = z.object({
  supplierId: z.string().uuid('Please select a valid supplier'),
  itemId: z.string().uuid('Please select a valid yarn item'),
  sacks: z.number().positive('Sacks must be greater than 0'),
  pricePerSack: z.number().positive('Price per sack must be greater than 0'),
});

type FormInputs = z.infer<typeof schema>;

interface Props {
  suppliers: { id: string; name: string }[];
  items: { id: string; name: string; sku: string }[];
}

export function ProcurementForm({ suppliers, items }: Props) {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    trigger,
    formState: { errors },
  } = useForm<FormInputs>({
    resolver: zodResolver(schema),
    defaultValues: {
      sacks: undefined,
      pricePerSack: undefined,
    },
  });

  const supplierIdValue = watch('supplierId');
  const itemIdValue = watch('itemId');
  const sacksValue = watch('sacks');
  const pricePerSackValue = watch('pricePerSack');

  const selectedSupplierName = suppliers.find(s => s.id === supplierIdValue)?.name || '';
  const selectedItemName = items.find(i => i.id === itemIdValue)?.name || '';

  const handleNext = async () => {
    if (step === 1) {
      const isValid = await trigger(['supplierId', 'itemId']);
      if (isValid) setStep(2);
    } else if (step === 2) {
      const isValid = await trigger(['sacks']);
      if (isValid) setStep(3);
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
    }
  };

  const onSubmit = async (data: FormInputs) => {
    setLoading(true);
    setFeedback(null);

    const quantityInKg = Number(data.sacks) * 45.34;
    const totalAmount = Number(data.sacks) * Number(data.pricePerSack);
    
    const timestamp = Date.now();
    const invoiceNumber = `PI-${timestamp}-${Math.floor(1000 + Math.random() * 9000)}`;

    const payload = {
      supplierId: data.supplierId,
      itemId: data.itemId,
      quantityInKg: quantityInKg,
      totalAmount: totalAmount,
      invoiceNumber: invoiceNumber,
      invoiceDate: new Date().toISOString(),
    };

    try {
      const response = await fetch('/api/procure', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const resBody = await response.json();

      if (!response.ok) {
        throw new Error(resBody.error || 'Server error occurred');
      }

      setFeedback({
        type: 'success',
        message: `Yarn purchased successfully! Bill Number: ${invoiceNumber}`,
      });
      reset();
      setStep(1);
    } catch (err: any) {
      console.error(err);
      setFeedback({
        type: 'error',
        message: err.message || 'Failed to dispatch API request.',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-lg bg-white border-2 border-slate-200 rounded-[32px] shadow-md p-6 sm:p-8 min-h-[450px] flex flex-col justify-between">
      <div>
        {/* Title */}
        <div className="text-center border-b border-slate-100 pb-4 mb-6">
          <h3 className="text-xl font-black text-slate-900">Buy Yarn (Dhaaga Khareedein)</h3>
          <span className="inline-block mt-2 rounded-full bg-indigo-50 px-3 py-1 text-xs font-bold text-indigo-700">
            Step {step} of 3
          </span>
        </div>

        {/* Form Feedback */}
        {feedback && (
          <div
            className={`rounded-2xl p-4 mb-6 text-sm font-bold border ${
              feedback.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : 'bg-rose-50 text-rose-800 border-rose-200'
            }`}
          >
            {feedback.message}
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          
          {/* STEP 1: SELECT PARTNER & ITEM */}
          {step === 1 && (
            <div className="space-y-5 animate-in fade-in duration-200">
              {/* Select Supplier */}
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Select Supplier (Sootar Wala Select Karein)</label>
                <select
                  {...register('supplierId')}
                  className="block w-full rounded-2xl border-2 border-slate-200 bg-white px-4 py-3.5 text-base text-slate-900 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                >
                  <option value="">-- Choose Supplier (Sootar Wala) --</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
                {errors.supplierId && (
                  <p className="mt-2 text-xs text-rose-600 font-bold">{errors.supplierId.message}</p>
                )}
              </div>

              {/* Select Yarn Item */}
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Yarn Item (Dhaaga Ki Qisam)</label>
                <select
                  {...register('itemId')}
                  className="block w-full rounded-2xl border-2 border-slate-200 bg-white px-4 py-3.5 text-base text-slate-900 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                >
                  <option value="">-- Choose Yarn (Dhaaga) --</option>
                  {items.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.name} ({i.sku})
                    </option>
                  ))}
                </select>
                {errors.itemId && (
                  <p className="mt-2 text-xs text-rose-600 font-bold">{errors.itemId.message}</p>
                )}
              </div>
            </div>
          )}

          {/* STEP 2: NUMBER OF SACKS */}
          {step === 2 && (
            <div className="space-y-5 animate-in fade-in duration-200">
              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 text-xs font-bold text-slate-600 space-y-1">
                <p>Supplier: <span className="text-slate-900 font-black">{selectedSupplierName}</span></p>
                <p>Yarn Type: <span className="text-slate-900 font-black">{selectedItemName}</span></p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Number of Sacks (Bori Ki Taadaad)</label>
                <input
                  type="number"
                  step="any"
                  placeholder="e.g. 10"
                  {...register('sacks', { valueAsNumber: true })}
                  className="block w-full rounded-2xl border-2 border-slate-200 px-4 py-3.5 text-lg text-slate-900 font-bold focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                />
                
                {/* Real-time convert preview */}
                <p className="mt-3 text-sm text-indigo-600 font-black">
                  Calculated KGs: {sacksValue ? (Number(sacksValue) * 45.34).toLocaleString() : '0.00'} KG
                </p>
                {errors.sacks && (
                  <p className="mt-2 text-xs text-rose-600 font-bold">{errors.sacks.message}</p>
                )}
              </div>
            </div>
          )}

          {/* STEP 3: PRICE PER SACK */}
          {step === 3 && (
            <div className="space-y-5 animate-in fade-in duration-200">
              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 text-xs font-bold text-slate-600 space-y-1">
                <p>Supplier: <span className="text-slate-900 font-black">{selectedSupplierName}</span></p>
                <p>Yarn Type: <span className="text-slate-900 font-black">{selectedItemName}</span></p>
                <p>Sacks: <span className="text-slate-900 font-black">{sacksValue} Bags ({sacksValue ? (Number(sacksValue) * 45.34).toLocaleString() : '0.00'} KG)</span></p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Price per Sack (Bori Ki Keemat)</label>
                <input
                  type="number"
                  step="any"
                  placeholder="e.g. 5000"
                  {...register('pricePerSack', { valueAsNumber: true })}
                  className="block w-full rounded-2xl border-2 border-slate-200 px-4 py-3.5 text-lg text-slate-900 font-bold focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                />
                
                {/* Total Cost preview */}
                <p className="mt-3 text-sm text-indigo-600 font-black">
                  Total Bill Amount: Rs. {sacksValue && pricePerSackValue ? (Number(sacksValue) * Number(pricePerSackValue)).toLocaleString() : '0.00'}
                </p>
                {errors.pricePerSack && (
                  <p className="mt-2 text-xs text-rose-600 font-bold">{errors.pricePerSack.message}</p>
                )}
              </div>
            </div>
          )}
        </form>
      </div>

      {/* Wizard Action Controls */}
      <div className="flex gap-4 pt-6 mt-6 border-t border-slate-100">
        {step > 1 && (
          <button
            type="button"
            onClick={handleBack}
            className="flex-1 rounded-2xl border-2 border-slate-300 py-3.5 text-sm font-bold text-slate-700 hover:bg-slate-50 transition-colors active:scale-95 cursor-pointer"
          >
            Back (Piche)
          </button>
        )}
        
        {step < 3 ? (
          <button
            type="button"
            onClick={handleNext}
            className="flex-1 rounded-2xl bg-indigo-600 py-3.5 text-sm font-bold text-white hover:bg-indigo-500 transition-colors active:scale-95 cursor-pointer"
          >
            Next (Agla Step)
          </button>
        ) : (
          <button
            type="button"
            onClick={handleSubmit(onSubmit)}
            disabled={loading}
            className="flex-1 rounded-2xl bg-emerald-600 py-3.5 text-sm font-black text-white hover:bg-emerald-500 transition-colors disabled:bg-emerald-400 active:scale-95 cursor-pointer"
          >
            {loading ? 'Saving...' : 'Save Record (Mahfooz Karein)'}
          </button>
        )}
      </div>
    </div>
  );
}
