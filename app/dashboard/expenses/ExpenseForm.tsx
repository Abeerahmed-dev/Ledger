'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useRouter } from 'next/navigation';

const schema = z.object({
  date: z.string().min(1, 'Date is required.'),
  categoryId: z.string().uuid('Please select a valid category.'),
  amount: z.number().positive('Amount must be greater than 0.'),
  description: z.string().optional(),
});

type FormInputs = z.infer<typeof schema>;

interface Props {
  categories: { id: string; name: string }[];
  initialExpenses: {
    id: string;
    amount: number;
    description: string | null;
    expenseDate: string;
    categoryName: string;
  }[];
}

export function ExpenseForm({ categories, initialExpenses }: Props) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  
  const [expenses, setExpenses] = useState(initialExpenses);
  const todayStr = new Date().toISOString().split('T')[0];

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
      date: todayStr,
      categoryId: '',
      amount: undefined,
      description: '',
    },
  });

  const dateValue = watch('date');
  const categoryIdValue = watch('categoryId');
  const amountValue = watch('amount');
  const descriptionValue = watch('description');

  const selectedCategoryName = categories.find(c => c.id === categoryIdValue)?.name || '';

  const handleNext = async () => {
    if (step === 1) {
      const isValid = await trigger(['date']);
      if (isValid) setStep(2);
    } else if (step === 2) {
      const isValid = await trigger(['categoryId']);
      if (isValid) setStep(3);
    } else if (step === 3) {
      const isValid = await trigger(['amount']);
      if (isValid) setStep(4);
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

    const payload = {
      categoryId: data.categoryId,
      amount: data.amount,
      description: data.description || undefined,
      date: new Date(data.date).toISOString(),
    };

    try {
      const response = await fetch('/api/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const body = await response.json();

      if (!response.ok) {
        throw new Error(body.error || 'Server rejected the expense record.');
      }

      setFeedback({
        type: 'success',
        message: `Expense successfully recorded!`,
      });

      reset({
        date: todayStr,
        categoryId: '',
        amount: undefined,
        description: '',
      });

      const newExpenseItem = {
        id: body.id,
        amount: Number(body.amount),
        description: body.description,
        expenseDate: body.expenseDate,
        categoryName: body.category.name,
      };
      
      setExpenses((prev) => [newExpenseItem, ...prev].slice(0, 20));
      setStep(1);
      router.refresh();
    } catch (err: any) {
      console.error(err);
      setFeedback({
        type: 'error',
        message: err.message || 'Failed to submit expense.',
      });
    } finally {
      setLoading(false);
    }
  };

  const todayExpenses = expenses.filter((e) => e.expenseDate.startsWith(todayStr));
  const totalSpentToday = todayExpenses.reduce((sum, e) => sum + e.amount, 0);

  return (
    <div className="space-y-6 pb-24 md:pb-8">
      {/* Prominent sticky summary bar */}
      <div className="sticky top-0 z-20 bg-slate-900 text-white rounded-2xl p-5 flex items-center justify-between shadow-lg border border-slate-800">
        <div>
          <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">Live Budget Tracker (Budget Record)</span>
          <h3 className="text-sm sm:text-base font-extrabold tracking-tight mt-0.5">Total Spent Today (Aaj Ka Kharcha)</h3>
        </div>
        <div className="text-right">
          <span className="text-lg sm:text-xl font-black text-rose-400 tracking-tight">
            Rs. {totalSpentToday.toLocaleString()}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 items-start">
        {/* Left side: Record form */}
        <div className="lg:col-span-5 bg-white border-2 border-slate-200 rounded-[32px] shadow-sm p-6 sm:p-8 min-h-[440px] flex flex-col justify-between">
          <div>
            <div className="text-center border-b border-slate-100 pb-4 mb-6">
              <h3 className="text-base font-bold text-slate-900">Record Expense (Rozana Kharcha)</h3>
              <span className="inline-block mt-2 rounded-full bg-indigo-50 px-3 py-1 text-xs font-bold text-indigo-700">
                Step {step} of 4
              </span>
            </div>

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
              {/* Step 1: Date */}
              {step === 1 && (
                <div className="space-y-4 animate-in fade-in duration-200">
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Date (Tareekh)</label>
                  <input
                    type="date"
                    {...register('date')}
                    className="block w-full rounded-2xl border-2 border-slate-200 px-4 py-3.5 text-base text-slate-900 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                  />
                  {errors.date && (
                    <p className="mt-2 text-xs text-rose-600 font-bold">{errors.date.message}</p>
                  )}
                </div>
              )}

              {/* Step 2: Category */}
              {step === 2 && (
                <div className="space-y-4 animate-in fade-in duration-200">
                  <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 text-xs font-bold text-slate-600">
                    <p>Date Selected: <span className="text-slate-900 font-black">{dateValue}</span></p>
                  </div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Category (Kharchay Ki Qisam)</label>
                  <select
                    {...register('categoryId')}
                    className="block w-full rounded-2xl border-2 border-slate-200 bg-white px-4 py-3.5 text-base text-slate-900 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                  >
                    <option value="">-- Choose Category --</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                  {errors.categoryId && (
                    <p className="mt-2 text-xs text-rose-600 font-bold">{errors.categoryId.message}</p>
                  )}
                </div>
              )}

              {/* Step 3: Amount */}
              {step === 3 && (
                <div className="space-y-4 animate-in fade-in duration-200">
                  <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 text-xs font-bold text-slate-600 space-y-1">
                    <p>Date: <span className="text-slate-900 font-black">{dateValue}</span></p>
                    <p>Category: <span className="text-slate-900 font-black">{selectedCategoryName}</span></p>
                  </div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Amount (Paisa/Raqam)</label>
                  <input
                    type="number"
                    step="any"
                    placeholder="e.g. 1500"
                    {...register('amount', { valueAsNumber: true })}
                    className="block w-full rounded-2xl border-2 border-slate-200 px-4 py-3.5 text-lg font-bold text-slate-900 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                  />
                  {errors.amount && (
                    <p className="mt-2 text-xs text-rose-600 font-bold">{errors.amount.message}</p>
                  )}
                </div>
              )}

              {/* Step 4: Description */}
              {step === 4 && (
                <div className="space-y-4 animate-in fade-in duration-200">
                  <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 text-xs font-bold text-slate-600 space-y-1">
                    <p>Date: <span className="text-slate-900 font-black">{dateValue}</span></p>
                    <p>Category: <span className="text-slate-900 font-black">{selectedCategoryName}</span></p>
                    <p>Amount: <span className="text-slate-900 font-black">Rs. {Number(amountValue).toLocaleString()}</span></p>
                  </div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Note / Description (Kharchay Ki Tafseel)</label>
                  <textarea
                    rows={3}
                    placeholder="e.g. Purchased generator fuel"
                    {...register('description')}
                    className="block w-full rounded-2xl border-2 border-slate-200 px-4 py-3 text-sm text-slate-900 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
              )}
            </form>
          </div>

          {/* Controls */}
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
            
            {step < 4 ? (
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
                {loading ? 'Saving...' : 'Save (Kharcha Likhein)'}
              </button>
            )}
          </div>
        </div>

        {/* Right side: Recent list */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-[32px] shadow-sm p-6 space-y-4">
          <div>
            <h3 className="text-base font-bold text-slate-900">Expenses Logged Today (Aaj Ka Kharcha Log)</h3>
            <p className="text-xs text-slate-500 mt-1">Operational overhead items recorded today</p>
          </div>

          <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
            {todayExpenses.length === 0 ? (
              <div className="text-center py-10 text-xs text-slate-400 font-medium">
                No factory expenses logged today.
              </div>
            ) : (
              todayExpenses.map((e) => (
                <div
                  key={e.id}
                  className="flex justify-between items-center border border-slate-100 rounded-2xl p-4 hover:bg-slate-50 transition-colors gap-3"
                >
                  <div className="space-y-1">
                    <span className="inline-block rounded px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wider bg-rose-50 text-rose-600">
                      {e.categoryName}
                    </span>
                    {e.description && (
                      <p className="text-xs text-slate-700 font-medium">
                        {e.description}
                      </p>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-base font-black text-rose-600">
                      - Rs. {e.amount.toLocaleString()}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
