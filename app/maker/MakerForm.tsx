'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useRouter } from 'next/navigation';

// ==========================================
// Zod Validation Schemas
// ==========================================

const sendSchemaBase = z.object({
  makerId: z.string().uuid('Please select a valid maker'),
  itemId: z.string().uuid('Please select a valid yarn item'),
  quantity: z.number().positive('Quantity must be greater than 0'),
  orderNumber: z.string().optional(),
});

const receiveSchema = z.object({
  makerId: z.string().uuid('Please select a valid maker'),
  rawMaterialItemId: z.string().uuid('Please select a valid yarn item'),
  rawMaterialQuantityConsumed: z.number().positive('Consumed quantity must be greater than 0'),
  finishedGoodsItemId: z.string().uuid('Please select a valid shirt item'),
  finishedGoodsQuantityReceived: z.number().positive('Received quantity must be greater than 0'),
  makingChargePerShirt: z.number().positive('Making charge must be greater than 0'),
  orderNumber: z.string().optional(),
});

type SendInputs = z.infer<typeof sendSchemaBase>;
type ReceiveInputs = z.infer<typeof receiveSchema>;

interface Props {
  makers: { id: string; name: string }[];
  rawItems: { id: string; name: string; sku: string; availableStock: number }[];
  finishedItems: { id: string; name: string; sku: string }[];
}

export function MakerForm({ makers, rawItems, finishedItems }: Props) {
  const router = useRouter();

  // Active Main Tab: 'send' | 'receive'
  const [activeTab, setActiveTab] = useState<'send' | 'receive'>('send');

  // Wizard Steps
  const [sendStep, setSendStep] = useState(1);
  const [recStep, setRecStep] = useState(1);

  const sendSchema = sendSchemaBase.refine((data) => {
    const selectedItem = rawItems.find((i) => i.id === data.itemId);
    const available = selectedItem ? selectedItem.availableStock : 0;
    return data.quantity <= available;
  }, {
    message: "Quantity exceeds available stock in Main Warehouse",
    path: ["quantity"],
  });

  // Transfer state
  const [sendLoading, setSendLoading] = useState(false);
  const [sendFeedback, setSendFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Receipt state
  const [recLoading, setRecLoading] = useState(false);
  const [recFeedback, setRecFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Form hooks
  const sendForm = useForm<SendInputs>({ resolver: zodResolver(sendSchema) });
  const receiveForm = useForm<ReceiveInputs>({ resolver: zodResolver(receiveSchema) });

  const watchSendMakerId = sendForm.watch('makerId');
  const watchSendItemId = sendForm.watch('itemId');
  const watchSendOrderNo = sendForm.watch('orderNumber');

  const watchRecMakerId = receiveForm.watch('makerId');
  const watchRecRawId = receiveForm.watch('rawMaterialItemId');
  const watchRecFinId = receiveForm.watch('finishedGoodsItemId');
  const watchRecRawQty = receiveForm.watch('rawMaterialQuantityConsumed');
  const watchRecOrderNo = receiveForm.watch('orderNumber');

  // Handle Transfer submit
  const onSendSubmit = async (data: SendInputs) => {
    setSendLoading(true);
    setSendFeedback(null);

    try {
      const response = await fetch('/api/transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      const resBody = await response.json();

      if (!response.ok) {
        throw new Error(resBody.error || 'Server error occurred');
      }

      setSendFeedback({
        type: 'success',
        message: `Yarn issued successfully! WIP ledger balance updated for Maker.`,
      });
      sendForm.reset();
      setSendStep(1);
      router.refresh();
    } catch (err: any) {
      console.error(err);
      setSendFeedback({
        type: 'error',
        message: err.message || 'Failed to dispatch API request.',
      });
    } finally {
      setSendLoading(false);
    }
  };

  // Handle Receipt submit
  const onReceiveSubmit = async (data: ReceiveInputs) => {
    setRecLoading(true);
    setRecFeedback(null);

    try {
      const payload = {
        makerId: data.makerId,
        rawMaterialItemId: data.rawMaterialItemId,
        rawMaterialQuantityConsumed: data.rawMaterialQuantityConsumed,
        finishedGoodsItemId: data.finishedGoodsItemId,
        finishedGoodsQuantityReceived: data.finishedGoodsQuantityReceived,
        serviceCost: data.finishedGoodsQuantityReceived * data.makingChargePerShirt,
        orderNumber: data.orderNumber || null,
      };

      const response = await fetch('/api/receive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const resBody = await response.json();

      if (!response.ok) {
        throw new Error(resBody.error || 'Server error occurred');
      }

      setRecFeedback({
        type: 'success',
        message: 'Shirts received successfully! Inventory and accounts payable updated.',
      });

      receiveForm.reset();
      setRecStep(1);
      router.refresh();
    } catch (err: any) {
      console.error(err);
      setRecFeedback({
        type: 'error',
        message: err.message || 'Failed to dispatch API request.',
      });
    } finally {
      setRecLoading(false);
    }
  };

  return (
    <div className="space-y-6 pb-24 md:pb-8 max-w-lg mx-auto animate-in fade-in duration-200">
      {/* Tab Selectors */}
      <div className="flex border-2 border-slate-200 rounded-[24px] bg-slate-100 p-1.5 shadow-sm">
        <button
          onClick={() => { setActiveTab('send'); setSendFeedback(null); }}
          className={`flex-1 text-center py-2.5 rounded-[18px] text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'send' ? 'bg-white shadow-sm text-indigo-700' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          Send Yarn (Dhaaga Bhejein)
        </button>
        <button
          onClick={() => { setActiveTab('receive'); setRecFeedback(null); }}
          className={`flex-1 text-center py-2.5 rounded-[18px] text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'receive' ? 'bg-white shadow-sm text-indigo-700' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          Receive Shirts (Tayar Maal Layein)
        </button>
      </div>

      {/* ==========================================
          TAB 1: SEND YARN TO MAKER
          ========================================== */}
      {activeTab === 'send' && (
        <div className="bg-white border-2 border-slate-200 rounded-[32px] shadow-md p-6 sm:p-8 min-h-[440px] flex flex-col justify-between">
          <div>
            <div className="text-center border-b border-slate-100 pb-4 mb-6">
              <h3 className="text-base font-bold text-slate-900 font-sans">Send to Maker (Maal Bhejein)</h3>
              <span className="inline-block mt-2 rounded-full bg-indigo-50 px-3 py-1 text-xs font-bold text-indigo-700">
                Step {sendStep} of 3
              </span>
            </div>

            {sendFeedback && (
              <div className={`rounded-xl p-4 mb-5 text-xs font-bold border ${sendFeedback.type === 'success' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-rose-50 text-rose-800 border-rose-200'}`}>
                {sendFeedback.message}
              </div>
            )}

            {sendStep === 1 && (
              <div className="space-y-4 animate-in fade-in duration-200">
                {/* Maker Select */}
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Select Maker Partner</label>
                  <select
                    {...sendForm.register('makerId')}
                    className="block w-full rounded-2xl border-2 border-slate-200 bg-white px-4 py-3.5 text-base font-bold"
                  >
                    <option value="">-- Choose Maker --</option>
                    {makers.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Optional Order Number input */}
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Order Number (Optional) (Order Number)</label>
                  <input
                    type="text"
                    placeholder="e.g. ORD-1025"
                    {...sendForm.register('orderNumber')}
                    className="block w-full rounded-2xl border-2 border-slate-200 px-4 py-3 text-base"
                  />
                </div>
              </div>
            )}

            {sendStep === 2 && (
              <div className="space-y-4 animate-in fade-in duration-200">
                <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 text-xs font-bold text-slate-650 space-y-1">
                  <p>Maker: <span className="text-slate-900 font-black">{makers.find(m => m.id === watchSendMakerId)?.name}</span></p>
                  {watchSendOrderNo && <p>Order Reference: <span className="text-slate-900 font-black">{watchSendOrderNo}</span></p>}
                </div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Yarn Item (Dhaaga Type)</label>
                <select
                  {...sendForm.register('itemId')}
                  className="block w-full rounded-2xl border-2 border-slate-200 bg-white px-4 py-3.5 text-base font-bold"
                >
                  <option value="">-- Choose Yarn --</option>
                  {rawItems.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.name} ({i.sku}) - Stock: {i.availableStock} KG
                    </option>
                  ))}
                </select>
              </div>
            )}

            {sendStep === 3 && (
              <div className="space-y-4 animate-in fade-in duration-200">
                <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 text-xs font-bold text-slate-650 space-y-1">
                  <p>Maker: <span className="text-slate-900 font-black">{makers.find(m => m.id === watchSendMakerId)?.name}</span></p>
                  <p>Yarn: <span className="text-slate-900 font-black">{rawItems.find(i => i.id === watchSendItemId)?.name}</span></p>
                </div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Quantity to Transfer (KG)</label>
                <input
                  type="number"
                  step="any"
                  placeholder="e.g. 50"
                  {...sendForm.register('quantity', { valueAsNumber: true })}
                  className="block w-full rounded-2xl border-2 border-slate-200 px-4 py-3.5 text-lg font-bold"
                />
                {sendForm.formState.errors.quantity && (
                  <p className="mt-2 text-xs text-rose-600 font-bold">{sendForm.formState.errors.quantity.message}</p>
                )}
              </div>
            )}
          </div>

          <div className="flex gap-4 pt-6 border-t border-slate-100">
            {sendStep > 1 && (
              <button
                type="button"
                onClick={() => setSendStep(sendStep - 1)}
                className="flex-1 rounded-2xl border-2 border-slate-300 py-3.5 text-sm font-bold text-slate-700 hover:bg-slate-50 active:scale-95 cursor-pointer"
              >
                Back
              </button>
            )}
            {sendStep < 3 ? (
              <button
                type="button"
                onClick={async () => {
                  if (sendStep === 1) {
                    const ok = await sendForm.trigger(['makerId']);
                    if (ok) setSendStep(2);
                  } else if (sendStep === 2) {
                    const ok = await sendForm.trigger(['itemId']);
                    if (ok) setSendStep(3);
                  }
                }}
                className="flex-1 rounded-2xl bg-indigo-600 py-3.5 text-sm font-bold text-white hover:bg-indigo-500 active:scale-95 cursor-pointer"
              >
                Next (Agla Step)
              </button>
            ) : (
              <button
                type="button"
                onClick={sendForm.handleSubmit(onSendSubmit)}
                disabled={sendLoading}
                className="flex-1 rounded-2xl bg-emerald-600 py-3.5 text-sm font-black text-white hover:bg-emerald-500 disabled:bg-emerald-400 active:scale-95 cursor-pointer"
              >
                {sendLoading ? 'Sending...' : 'Send (Maal Bhejein)'}
              </button>
            )}
          </div>
        </div>
      )}

      {/* ==========================================
          TAB 2: RECEIVE SHIRTS FROM MAKER
          ========================================== */}
      {activeTab === 'receive' && (
        <div className="bg-white border-2 border-slate-200 rounded-[32px] shadow-md p-6 sm:p-8 min-h-[450px] flex flex-col justify-between">
          <div>
            <div className="text-center border-b border-slate-100 pb-4 mb-6">
              <h3 className="text-base font-bold text-slate-900 font-sans">Receive Shirts (Shirts Wapas)</h3>
              <span className="inline-block mt-2 rounded-full bg-indigo-50 px-3 py-1 text-xs font-bold text-indigo-700">
                Step {recStep} of 4
              </span>
            </div>

            {recFeedback && (
              <div className={`rounded-xl p-4 mb-5 text-xs font-bold border ${recFeedback.type === 'success' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-rose-50 text-rose-800 border-rose-200'}`}>
                {recFeedback.message}
              </div>
            )}

            {recStep === 1 && (
              <div className="space-y-4 animate-in fade-in duration-200">
                {/* Maker Select */}
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Select Maker Partner</label>
                  <select
                    {...receiveForm.register('makerId')}
                    className="block w-full rounded-2xl border-2 border-slate-200 bg-white px-4 py-3.5 text-base font-bold"
                  >
                    <option value="">-- Choose Maker --</option>
                    {makers.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Optional Order Number input */}
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Order Number (Optional) (Order Number)</label>
                  <input
                    type="text"
                    placeholder="e.g. ORD-1025"
                    {...receiveForm.register('orderNumber')}
                    className="block w-full rounded-2xl border-2 border-slate-200 px-4 py-3 text-base"
                  />
                </div>
              </div>
            )}

            {recStep === 2 && (
              <div className="space-y-4 animate-in fade-in duration-200">
                <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 text-xs font-bold text-slate-650">
                  <p>Maker: <span className="text-slate-900 font-black">{makers.find(m => m.id === watchRecMakerId)?.name}</span></p>
                  {watchRecOrderNo && <p>Order Reference: <span className="text-slate-900 font-black">{watchRecOrderNo}</span></p>}
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Yarn Consumed (Dhaaga Select)</label>
                  <select
                    {...receiveForm.register('rawMaterialItemId')}
                    className="block w-full rounded-2xl border-2 border-slate-200 bg-white px-4 py-3.5 text-base font-bold"
                  >
                    <option value="">-- Choose Yarn --</option>
                    {rawItems.map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Finished Shirt (Tayar Shirt)</label>
                  <select
                    {...receiveForm.register('finishedGoodsItemId')}
                    className="block w-full rounded-2xl border-2 border-slate-200 bg-white px-4 py-3.5 text-base font-bold"
                  >
                    <option value="">-- Choose Shirt --</option>
                    {finishedItems.map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {recStep === 3 && (
              <div className="space-y-4 animate-in fade-in duration-200">
                <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 text-xs font-bold text-slate-650 space-y-1">
                  <p>Maker: <span className="text-slate-900 font-black">{makers.find(m => m.id === watchRecMakerId)?.name}</span></p>
                  <p>Yarn Type: <span className="text-slate-900 font-black">{rawItems.find(i => i.id === watchRecRawId)?.name}</span></p>
                  <p>Shirt: <span className="text-slate-900 font-black">{finishedItems.find(i => i.id === watchRecFinId)?.name}</span></p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Yarn Consumed (lbs)</label>
                  <input
                    type="number"
                    step="any"
                    placeholder="e.g. 100"
                    {...receiveForm.register('rawMaterialQuantityConsumed', { valueAsNumber: true })}
                    className="block w-full rounded-2xl border-2 border-slate-200 px-4 py-3.5 text-lg font-bold"
                  />
                </div>
              </div>
            )}

            {recStep === 4 && (
              <div className="space-y-4 animate-in fade-in duration-200">
                <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 text-xs font-bold text-slate-650 space-y-1">
                  <p>Yarn Consumed: <span className="text-slate-900 font-black">{watchRecRawQty} lbs</span></p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Actual Shirts Received (pcs)</label>
                  <input
                    type="number"
                    step="any"
                    placeholder="e.g. 195"
                    {...receiveForm.register('finishedGoodsQuantityReceived', { valueAsNumber: true })}
                    className="block w-full rounded-2xl border-2 border-slate-200 px-4 py-3.5 text-lg font-bold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Making Charge per Shirt (PKR / piece)</label>
                  <input
                    type="number"
                    step="any"
                    placeholder="e.g. 80"
                    {...receiveForm.register('makingChargePerShirt', { valueAsNumber: true })}
                    className="block w-full rounded-2xl border-2 border-slate-200 px-4 py-3.5 text-lg font-bold"
                  />
                </div>
              </div>
            )}
          </div>

          <div className="flex gap-4 pt-6 border-t border-slate-100">
            {recStep > 1 && (
              <button
                type="button"
                onClick={() => setRecStep(recStep - 1)}
                className="flex-1 rounded-2xl border-2 border-slate-300 py-3.5 text-sm font-bold text-slate-700 hover:bg-slate-50 active:scale-95 cursor-pointer"
              >
                Back
              </button>
            )}
            {recStep < 4 ? (
              <button
                type="button"
                onClick={async () => {
                  if (recStep === 1) {
                    const ok = await receiveForm.trigger(['makerId']);
                    if (ok) setRecStep(2);
                  } else if (recStep === 2) {
                    const ok = await receiveForm.trigger(['rawMaterialItemId', 'finishedGoodsItemId']);
                    if (ok) setRecStep(3);
                  } else if (recStep === 3) {
                    const ok = await receiveForm.trigger(['rawMaterialQuantityConsumed']);
                    if (ok) setRecStep(4);
                  }
                }}
                className="flex-1 rounded-2xl bg-indigo-600 py-3.5 text-sm font-bold text-white hover:bg-indigo-500 active:scale-95 cursor-pointer"
              >
                Next (Agla Step)
              </button>
            ) : (
              <button
                type="button"
                onClick={receiveForm.handleSubmit(onReceiveSubmit)}
                disabled={recLoading}
                className="flex-1 rounded-2xl bg-emerald-600 py-3.5 text-sm font-black text-white hover:bg-emerald-500 disabled:bg-emerald-400 active:scale-95 cursor-pointer"
              >
                {recLoading ? 'Logging...' : 'Receive (Wapas Layein)'}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
