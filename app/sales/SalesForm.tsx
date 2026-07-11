'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useRouter } from 'next/navigation';

const schema = z.object({
  companyId: z.string().uuid('Please select a valid company/customer'),
  finishedGoodId: z.string().uuid('Please select a valid finished shirt'),
  quantity: z.number().positive('Quantity must be greater than 0'),
  unitPrice: z.number().positive('Price of 1 Shirt must be greater than 0'),
  poNumber: z.string().optional(),
  jobNumber: z.string().optional(),
  paymentTerms: z.string().optional(),
  shippingMethod: z.string().optional(),
});

type FormInputs = z.infer<typeof schema>;

interface Props {
  companies: { id: string; name: string }[];
  items: { id: string; name: string; sku: string }[];
}

export function SalesForm({ companies, items }: Props) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [invoiceDetails, setInvoiceDetails] = useState<{
    invoiceNumber: string;
    subtotal: number;
    gst: number;
    totalPrice: number;
    quantity: number;
    unitPrice: number;
    itemName: string;
    companyName: string;
  } | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    trigger,
    formState: { errors },
  } = useForm<FormInputs>({
    resolver: zodResolver(schema),
  });

  const companyIdValue = watch('companyId');
  const finishedGoodIdValue = watch('finishedGoodId');
  const quantityValue = watch('quantity');
  const unitPriceValue = watch('unitPrice');
  const poNumberValue = watch('poNumber');
  const jobNumberValue = watch('jobNumber');
  const paymentTermsValue = watch('paymentTerms');
  const shippingMethodValue = watch('shippingMethod');

  const selectedCompanyName = companies.find(c => c.id === companyIdValue)?.name || '';
  const selectedItemName = items.find(i => i.id === finishedGoodIdValue)?.name || '';

  const handleNext = async () => {
    if (step === 1) {
      const isValid = await trigger(['companyId', 'finishedGoodId']);
      if (isValid) setStep(2);
    } else if (step === 2) {
      const isValid = await trigger(['quantity']);
      if (isValid) setStep(3);
    } else if (step === 3) {
      const isValid = await trigger(['unitPrice']);
      if (isValid) setStep(4);
    } else if (step === 4) {
      setStep(5);
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
    setInvoiceDetails(null);

    try {
      const response = await fetch('/api/invoice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      const resBody = await response.json();

      if (!response.ok) {
        throw new Error(resBody.error || 'Server error occurred');
      }

      setFeedback({
        type: 'success',
        message: `Invoice generated successfully! Bill: ${resBody.invoiceNumber}`,
      });
      setInvoiceDetails(resBody);

      // Auto-trigger invoice PDF download
      if (resBody.pdfBase64) {
        try {
          const byteCharacters = atob(resBody.pdfBase64);
          const byteNumbers = new Array(byteCharacters.length);
          for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
          }
          const byteArray = new Uint8Array(byteNumbers);
          const blob = new Blob([byteArray], { type: 'application/pdf' });
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `${resBody.invoiceNumber}.pdf`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          window.URL.revokeObjectURL(url);
        } catch (downloadError) {
          console.error('Failed to auto-download PDF:', downloadError);
        }
      }

      reset();
      setStep(1);
      router.refresh();
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
    <div className="space-y-6">
      {/* Invoice Details Success Card */}
      {invoiceDetails && (
        <div className="mx-auto max-w-lg bg-slate-900 text-white rounded-[32px] shadow-xl p-6 border border-slate-800 animate-in fade-in duration-200">
          <div className="flex justify-between items-start border-b border-slate-850 pb-4">
            <div>
              <span className="inline-block rounded bg-indigo-500/10 px-2.5 py-0.5 text-[10px] font-bold text-indigo-400">
                OFFICIAL SALES TAX BILL
              </span>
              <h4 className="text-lg font-bold text-white mt-1">{invoiceDetails.invoiceNumber}</h4>
              <p className="text-[10px] text-slate-400 mt-0.5">With 18% GST (Tax)</p>
            </div>
            <div className="text-right">
              <span className="block text-[9px] text-slate-400 font-bold uppercase">Total</span>
              <span className="text-xl font-black text-indigo-400">
                PKR {Number(invoiceDetails.totalPrice).toLocaleString()}
              </span>
            </div>
          </div>

          <div className="mt-4 space-y-3 text-xs font-semibold text-slate-300">
            <div>
              <span className="block text-[9px] text-slate-400 uppercase">Party</span>
              <span className="text-white font-bold">{invoiceDetails.companyName}</span>
            </div>
            <div>
              <span className="block text-[9px] text-slate-400 uppercase">Item Shipped</span>
              <span className="text-white font-bold">{invoiceDetails.itemName}</span>
            </div>
            <div className="grid grid-cols-4 gap-2 bg-slate-850 p-3 rounded-xl border border-slate-850">
              <div>
                <span className="block text-[9px] text-slate-400">Qty</span>
                <span className="text-white font-bold">{invoiceDetails.quantity} pcs</span>
              </div>
              <div>
                <span className="block text-[9px] text-slate-400">Rate</span>
                <span className="text-white font-bold">{invoiceDetails.unitPrice}</span>
              </div>
              <div>
                <span className="block text-[9px] text-slate-400">Sub</span>
                <span className="text-white font-bold">{invoiceDetails.subtotal}</span>
              </div>
              <div>
                <span className="block text-[9px] text-slate-400">GST 18%</span>
                <span className="text-amber-400 font-bold">{invoiceDetails.gst}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Wizard Form Container */}
      <div className="mx-auto max-w-lg bg-white border-2 border-slate-200 rounded-[32px] shadow-md p-6 sm:p-8 min-h-[460px] flex flex-col justify-between">
        <div>
          {/* Header */}
          <div className="text-center border-b border-slate-100 pb-4 mb-6">
            <h3 className="text-xl font-black text-slate-900">Make Bill/Invoice (Bill Banayein)</h3>
            <span className="inline-block mt-2 rounded-full bg-indigo-50 px-3 py-1 text-xs font-bold text-indigo-700">
              Step {step} of 5
            </span>
          </div>

          {/* Form Feedback */}
          {feedback && !invoiceDetails && (
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
            
            {/* STEP 1: CHOOSE PARTY AND SHIRT */}
            {step === 1 && (
              <div className="space-y-5 animate-in fade-in duration-200">
                {/* Select Customer */}
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Select Customer (Company/Party Select Karein)</label>
                  <select
                    {...register('companyId')}
                    className="block w-full rounded-2xl border-2 border-slate-200 bg-white px-4 py-3.5 text-base text-slate-900 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                  >
                    <option value="">-- Choose Customer (Company/Party) --</option>
                    {companies.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                  {errors.companyId && (
                    <p className="mt-2 text-xs text-rose-600 font-bold">{errors.companyId.message}</p>
                  )}
                </div>

                {/* Select Finished Shirt */}
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Finished Shirt Item (Tayar Shirt)</label>
                  <select
                    {...register('finishedGoodId')}
                    className="block w-full rounded-2xl border-2 border-slate-200 bg-white px-4 py-3.5 text-base text-slate-900 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                  >
                    <option value="">-- Choose Shirt (Tayar Shirt) --</option>
                    {items.map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.name} ({i.sku})
                      </option>
                    ))}
                  </select>
                  {errors.finishedGoodId && (
                    <p className="mt-2 text-xs text-rose-600 font-bold">{errors.finishedGoodId.message}</p>
                  )}
                </div>
              </div>
            )}

            {/* STEP 2: QUANTITY */}
            {step === 2 && (
              <div className="space-y-5 animate-in fade-in duration-200">
                <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 text-xs font-bold text-slate-600 space-y-1">
                  <p>Customer: <span className="text-slate-900 font-black">{selectedCompanyName}</span></p>
                  <p>Shirt: <span className="text-slate-900 font-black">{selectedItemName}</span></p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Quantity to Deliver (Taadaad - pieces)</label>
                  <input
                    type="number"
                    placeholder="e.g. 100"
                    {...register('quantity', { valueAsNumber: true })}
                    className="block w-full rounded-2xl border-2 border-slate-200 px-4 py-3.5 text-lg text-slate-900 font-bold focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                  />
                  {errors.quantity && (
                    <p className="mt-2 text-xs text-rose-600 font-bold">{errors.quantity.message}</p>
                  )}
                </div>
              </div>
            )}

            {/* STEP 3: PRICE OF 1 SHIRT */}
            {step === 3 && (
              <div className="space-y-5 animate-in fade-in duration-200">
                <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 text-xs font-bold text-slate-600 space-y-1">
                  <p>Customer: <span className="text-slate-900 font-black">{selectedCompanyName}</span></p>
                  <p>Shirt: <span className="text-slate-900 font-black">{selectedItemName}</span></p>
                  <p>Qty: <span className="text-slate-900 font-black">{quantityValue} Pcs</span></p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Price of 1 Shirt (Aik Shirt Ki Keemat)</label>
                  <input
                    type="number"
                    step="any"
                    placeholder="e.g. 600"
                    {...register('unitPrice', { valueAsNumber: true })}
                    className="block w-full rounded-2xl border-2 border-slate-200 px-4 py-3.5 text-lg text-slate-900 font-bold focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                  />
                  <p className="mt-3 text-sm text-indigo-600 font-black">
                    Subtotal: Rs. {quantityValue && unitPriceValue ? (Number(quantityValue) * Number(unitPriceValue)).toLocaleString() : '0.00'}<br />
                    Total (+ 18% GST): Rs. {quantityValue && unitPriceValue ? (Number(quantityValue) * Number(unitPriceValue) * 1.18).toLocaleString() : '0.00'}
                  </p>
                  {errors.unitPrice && (
                    <p className="mt-2 text-xs text-rose-600 font-bold">{errors.unitPrice.message}</p>
                  )}
                </div>
              </div>
            )}

            {/* STEP 4: OPTIONAL METADATA */}
            {step === 4 && (
              <div className="space-y-5 animate-in fade-in duration-200">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Optional Invoice Details (Mazeed Tafseel)</p>
                
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 mb-1">PO Number (PO Number)</label>
                    <input
                      type="text"
                      placeholder="e.g. PO-123"
                      {...register('poNumber')}
                      className="block w-full rounded-xl border-2 border-slate-200 px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 mb-1">Job / JWO Number</label>
                    <input
                      type="text"
                      placeholder="e.g. JWO-789"
                      {...register('jobNumber')}
                      className="block w-full rounded-xl border-2 border-slate-200 px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 mb-1">Payment Terms</label>
                    <input
                      type="text"
                      placeholder="e.g. 60 DAYS"
                      {...register('paymentTerms')}
                      className="block w-full rounded-xl border-2 border-slate-200 px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 mb-1">Shipping Method</label>
                    <input
                      type="text"
                      placeholder="e.g. ROAD FREIGHT"
                      {...register('shippingMethod')}
                      className="block w-full rounded-xl border-2 border-slate-200 px-3 py-2 text-sm"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* STEP 5: FINAL CONFIRMATION */}
            {step === 5 && (
              <div className="space-y-5 animate-in fade-in duration-200">
                <span className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Final Confirmation (Hisaab Confirm Karein)</span>
                
                <div className="bg-slate-50 border border-slate-100 rounded-3xl p-5 space-y-3 font-semibold text-xs text-slate-700">
                  <div className="flex justify-between">
                    <span>Customer Party:</span>
                    <span className="text-slate-900 font-bold">{selectedCompanyName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Garment Item:</span>
                    <span className="text-slate-900 font-bold">{selectedItemName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Delivered Quantity:</span>
                    <span className="text-slate-900 font-bold">{quantityValue} pieces</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Price per Shirt:</span>
                    <span className="text-slate-900 font-bold">Rs. {Number(unitPriceValue).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between border-t border-slate-200 pt-2 font-bold text-sm text-slate-900">
                    <span>Total Amount (with GST):</span>
                    <span className="text-indigo-600 font-black">
                      Rs. {quantityValue && unitPriceValue ? (Number(quantityValue) * Number(unitPriceValue) * 1.18).toLocaleString() : '0.00'}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </form>
        </div>

        {/* Action Controls */}
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
          
          {step < 5 ? (
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
              {loading ? 'Generating Bill...' : 'Make Bill (Bill Banayein)'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
