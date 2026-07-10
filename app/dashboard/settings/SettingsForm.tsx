'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useRouter } from 'next/navigation';

const entitySchema = z.object({
  name: z.string().min(1, 'Name is required.'),
  type: z.enum(['COMPANY', 'SUPPLIER', 'MAKER']),
  ntnNumber: z.string().optional(),
  strnNumber: z.string().optional(),
  address: z.string().optional(),
});

const itemSchema = z.object({
  sku: z.string().min(1, 'SKU is required.'),
  name: z.string().min(1, 'Name is required.'),
  type: z.enum(['RAW_MATERIAL', 'FINISHED_GOOD']),
});

type EntityInputs = z.infer<typeof entitySchema>;
type ItemInputs = z.infer<typeof itemSchema>;

interface EntityRecord {
  id: string;
  name: string;
  type: string;
  ntnNumber?: string | null;
  strnNumber?: string | null;
  address?: string | null;
}

interface Props {
  initialEntities: EntityRecord[];
  initialItems: { id: string; sku: string; name: string; type: string; unit: string }[];
  initialExpenseCategories: { id: string; name: string }[];
}

export function SettingsForm({ initialEntities, initialItems, initialExpenseCategories }: Props) {
  const router = useRouter();
  const [loadingEntity, setLoadingEntity] = useState(false);
  const [loadingItem, setLoadingItem] = useState(false);

  // Category CRUD states
  const [newCatName, setNewCatName] = useState('');
  const [loadingCat, setLoadingCat] = useState(false);
  const [editingCatId, setEditingCatId] = useState<string | null>(null);
  const [editingCatName, setEditingCatName] = useState('');

  // Entity Edit states
  const [editingEntityId, setEditingEntityId] = useState<string | null>(null);
  const [editingEntityName, setEditingEntityName] = useState('');
  const [editingEntityType, setEditingEntityType] = useState<'COMPANY' | 'SUPPLIER' | 'MAKER'>('COMPANY');
  const [editingEntityNtn, setEditingEntityNtn] = useState('');
  const [editingEntityStrn, setEditingEntityStrn] = useState('');
  const [editingEntityAddress, setEditingEntityAddress] = useState('');
  const [loadingUpdateEntity, setLoadingUpdateEntity] = useState(false);

  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const entityForm = useForm<EntityInputs>({
    resolver: zodResolver(entitySchema),
  });
  const selectedType = entityForm.watch('type');

  const itemForm = useForm<ItemInputs>({
    resolver: zodResolver(itemSchema),
  });

  const onSubmitEntity = async (data: EntityInputs) => {
    setLoadingEntity(true);
    setFeedback(null);

    try {
      const res = await fetch('/api/settings/entities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      const body = await res.json();

      if (!res.ok) {
        throw new Error(body.error || 'Failed to save entity.');
      }

      setFeedback({ type: 'success', message: `Entity "${body.name}" successfully created.` });
      entityForm.reset();
      router.refresh();
    } catch (err: any) {
      console.error(err);
      setFeedback({ type: 'error', message: err.message || 'Entity creation failed.' });
    } finally {
      setLoadingEntity(false);
    }
  };

  const handleUpdateEntity = async (id: string) => {
    setLoadingUpdateEntity(true);
    setFeedback(null);
    try {
      const res = await fetch('/api/settings/entities', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          name: editingEntityName,
          type: editingEntityType,
          ntnNumber: editingEntityNtn,
          strnNumber: editingEntityStrn,
          address: editingEntityAddress,
        }),
      });

      const body = await res.json();
      if (!res.ok) throw new Error(body.error || 'Failed to update entity');

      setFeedback({ type: 'success', message: `Entity "${body.name}" updated successfully.` });
      setEditingEntityId(null);
      router.refresh();
    } catch (err: any) {
      console.error(err);
      setFeedback({ type: 'error', message: err.message || 'Entity update failed.' });
    } finally {
      setLoadingUpdateEntity(false);
    }
  };

  const onSubmitItem = async (data: ItemInputs) => {
    setLoadingItem(true);
    setFeedback(null);

    // Auto-map Unit based on Item Type
    const payload = {
      ...data,
      unit: data.type === 'RAW_MATERIAL' ? 'LBS' : 'PCS',
    };

    try {
      const res = await fetch('/api/settings/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const body = await res.json();

      if (!res.ok) {
        throw new Error(body.error || 'Failed to save inventory item.');
      }

      setFeedback({ type: 'success', message: `Item "${body.name}" (${body.sku}) successfully created.` });
      itemForm.reset();
      router.refresh();
    } catch (err: any) {
      console.error(err);
      setFeedback({ type: 'error', message: err.message || 'Item creation failed.' });
    } finally {
      setLoadingItem(false);
    }
  };

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim()) return;
    setLoadingCat(true);
    setFeedback(null);

    try {
      const res = await fetch('/api/settings/expense-categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newCatName }),
      });

      const body = await res.json();

      if (!res.ok) {
        throw new Error(body.error || 'Failed to create category.');
      }

      setFeedback({ type: 'success', message: `Expense category "${body.name}" created.` });
      setNewCatName('');
      router.refresh();
    } catch (err: any) {
      console.error(err);
      setFeedback({ type: 'error', message: err.message || 'Creation failed.' });
    } finally {
      setLoadingCat(false);
    }
  };

  const handleUpdateCategory = async (id: string) => {
    if (!editingCatName.trim()) return;
    setFeedback(null);

    try {
      const res = await fetch('/api/settings/expense-categories', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, name: editingCatName }),
      });

      const body = await res.json();

      if (!res.ok) {
        throw new Error(body.error || 'Failed to update category.');
      }

      setFeedback({ type: 'success', message: `Expense category updated to "${body.name}".` });
      setEditingCatId(null);
      setEditingCatName('');
      router.refresh();
    } catch (err: any) {
      console.error(err);
      setFeedback({ type: 'error', message: err.message || 'Update failed.' });
    }
  };

  const handleDeleteCategory = async (id: string) => {
    if (!confirm('Are you sure you want to delete this expense category?')) return;
    setFeedback(null);

    try {
      const res = await fetch(`/api/settings/expense-categories?id=${id}`, {
        method: 'DELETE',
      });

      const body = await res.json();

      if (!res.ok) {
        throw new Error(body.error || 'Failed to delete category.');
      }

      setFeedback({ type: 'success', message: `Expense category "${body.name}" deleted.` });
      router.refresh();
    } catch (err: any) {
      console.error(err);
      setFeedback({ type: 'error', message: err.message || 'Deletion failed.' });
    }
  };

  const inputCls = 'mt-2 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none';
  const labelCls = 'block text-xs font-semibold text-slate-700 uppercase tracking-wider';

  return (
    <div className="space-y-12">
      {/* Feedback Banner */}
      {feedback && (
        <div
          className={`rounded-lg p-4 text-xs font-semibold border ${
            feedback.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-rose-50 text-rose-800 border-rose-200'
          }`}
        >
          {feedback.message}
        </div>
      )}

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        {/* Form 1: Add Entity */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 space-y-6">
          <div>
            <h3 className="text-base font-bold text-slate-900">Add New Partner / Entity (Naya Partner / Party Add Karein)</h3>
            <p className="text-xs text-slate-500 mt-1">Register suppliers (Sootar Walay), maker factories (Karkhana), or buying companies (Party).</p>
          </div>

          <form onSubmit={entityForm.handleSubmit(onSubmitEntity)} className="space-y-4">
            <div>
              <label className={labelCls}>Entity Name (Naam)</label>
              <input
                type="text"
                placeholder="e.g. Master Dyeing Unit B"
                {...entityForm.register('name')}
                className={inputCls}
              />
              {entityForm.formState.errors.name && (
                <p className="mt-1 text-xs text-rose-600 font-medium">{entityForm.formState.errors.name.message}</p>
              )}
            </div>

            <div>
              <label className={labelCls}>Entity Role (Kaam/Role)</label>
              <select
                {...entityForm.register('type')}
                className={inputCls}
              >
                <option value="">-- Choose Role --</option>
                <option value="SUPPLIER">Supplier (Sootar Walay)</option>
                <option value="MAKER">Maker (Karkhana / Thekedar)</option>
                <option value="COMPANY">Company (Party)</option>
              </select>
              {entityForm.formState.errors.type && (
                <p className="mt-1 text-xs text-rose-600 font-medium">{entityForm.formState.errors.type.message}</p>
              )}
            </div>

            {/* Extra fields for COMPANY entities */}
            {selectedType === 'COMPANY' && (
              <>
                <div>
                  <label className={labelCls}>NTN Number <span className="text-slate-400 normal-case font-normal">(optional)</span></label>
                  <input
                    type="text"
                    placeholder="e.g. 1234567-8"
                    {...entityForm.register('ntnNumber')}
                    className={inputCls}
                  />
                </div>

                <div>
                  <label className={labelCls}>STRN Number <span className="text-slate-400 normal-case font-normal">(optional)</span></label>
                  <input
                    type="text"
                    placeholder="e.g. 3277876-1"
                    {...entityForm.register('strnNumber')}
                    className={inputCls}
                  />
                </div>

                <div>
                  <label className={labelCls}>Address (Pata) <span className="text-slate-400 normal-case font-normal">(optional)</span></label>
                  <textarea
                    placeholder="e.g. Plot 45, Industrial Area, Karachi"
                    {...entityForm.register('address')}
                    className={inputCls}
                    rows={2}
                  />
                </div>
              </>
            )}

            <button
              type="submit"
              disabled={loadingEntity}
              className="w-full flex items-center justify-center rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-indigo-500 disabled:bg-indigo-400 transition-colors"
            >
              {loadingEntity ? 'Creating...' : 'Register Entity (Partner/Party Banayein)'}
            </button>
          </form>
        </div>

        {/* Form 2: Add InventoryItem */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 space-y-6">
          <div>
            <h3 className="text-base font-bold text-slate-900">Add New Inventory Item (Naya Maal/Item Add Karein)</h3>
            <p className="text-xs text-slate-500 mt-1">Register raw materials (yarn weight) or finished shirts.</p>
          </div>

          <form onSubmit={itemForm.handleSubmit(onSubmitItem)} className="space-y-4">
            <div>
              <label className={labelCls}>Item SKU (Code)</label>
              <input
                type="text"
                placeholder="e.g. YARN-COTTON-40S"
                {...itemForm.register('sku')}
                className={inputCls}
              />
              {itemForm.formState.errors.sku && (
                <p className="mt-1 text-xs text-rose-600 font-medium">{itemForm.formState.errors.sku.message}</p>
              )}
            </div>

            <div>
              <label className={labelCls}>Item Name (Maal Ka Naam)</label>
              <input
                type="text"
                placeholder="e.g. Carded Cotton Yarn 40s"
                {...itemForm.register('name')}
                className={inputCls}
              />
              {itemForm.formState.errors.name && (
                <p className="mt-1 text-xs text-rose-600 font-medium">{itemForm.formState.errors.name.message}</p>
              )}
            </div>

            <div>
              <label className={labelCls}>Item Category (Maal Ki Qisam)</label>
              <select
                {...itemForm.register('type')}
                className={inputCls}
              >
                <option value="">-- Choose Category --</option>
                <option value="RAW_MATERIAL">Raw Material (Dhaaga - LBS)</option>
                <option value="FINISHED_GOOD">Finished Good (Tayar Shirt - PCS)</option>
              </select>
              {itemForm.formState.errors.type && (
                <p className="mt-1 text-xs text-rose-600 font-medium">{itemForm.formState.errors.type.message}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={loadingItem}
              className="w-full flex items-center justify-center rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-indigo-500 disabled:bg-indigo-400 transition-colors"
            >
              {loadingItem ? 'Creating...' : 'Register Item (Item Banayein)'}
            </button>
          </form>
        </div>

        {/* Form 3: Add Expense Category */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 space-y-6">
          <div>
            <h3 className="text-base font-bold text-slate-900">Add Expense Category (Kharchay Ki Qisam Add Karein)</h3>
            <p className="text-xs text-slate-500 mt-1">Create operational overhead categories (e.g. Generator Ka Diesel, Chai/Khana).</p>
          </div>

          <form onSubmit={handleCreateCategory} className="space-y-4">
            <div>
              <label className={labelCls}>Category Name (Kharchay Ki Qisam Ka Naam)</label>
              <input
                type="text"
                placeholder="e.g. Tea & Refreshments"
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
                className={inputCls}
              />
            </div>

            <button
              type="submit"
              disabled={loadingCat}
              className="w-full flex items-center justify-center rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-indigo-500 disabled:bg-indigo-400 transition-colors"
            >
              {loadingCat ? 'Creating...' : 'Register Category (Kharchay Ki Qisam Banayein)'}
            </button>
          </form>
        </div>
      </div>

      {/* Lists of Current Settings */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        {/* Entities list with inline edit */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 space-y-4">
          <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wide">Entities Registry (Partners/Parties List)</h4>
          <div className="max-h-96 overflow-y-auto border border-slate-100 rounded-lg divide-y divide-slate-100">
            {initialEntities.map((e) => (
              <div key={e.id} className="p-3 hover:bg-slate-50 text-xs">
                {editingEntityId === e.id ? (
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={editingEntityName}
                      onChange={(ev) => setEditingEntityName(ev.target.value)}
                      className="w-full rounded border border-slate-300 px-2 py-1 text-xs focus:border-indigo-500 focus:outline-none"
                      placeholder="Name"
                    />
                    <select
                      value={editingEntityType}
                      onChange={(ev) => setEditingEntityType(ev.target.value as any)}
                      className="w-full rounded border border-slate-300 px-2 py-1 text-xs focus:border-indigo-500 focus:outline-none"
                    >
                      <option value="SUPPLIER">Supplier</option>
                      <option value="MAKER">Maker</option>
                      <option value="COMPANY">Company</option>
                    </select>
                    {editingEntityType === 'COMPANY' && (
                      <>
                        <input
                          type="text"
                          value={editingEntityNtn}
                          onChange={(ev) => setEditingEntityNtn(ev.target.value)}
                          className="w-full rounded border border-slate-300 px-2 py-1 text-xs focus:border-indigo-500 focus:outline-none"
                          placeholder="NTN Number"
                        />
                        <input
                          type="text"
                          value={editingEntityStrn}
                          onChange={(ev) => setEditingEntityStrn(ev.target.value)}
                          className="w-full rounded border border-slate-300 px-2 py-1 text-xs focus:border-indigo-500 focus:outline-none"
                          placeholder="STRN Number"
                        />
                        <textarea
                          value={editingEntityAddress}
                          onChange={(ev) => setEditingEntityAddress(ev.target.value)}
                          className="w-full rounded border border-slate-300 px-2 py-1 text-xs focus:border-indigo-500 focus:outline-none"
                          placeholder="Address"
                          rows={2}
                        />
                      </>
                    )}
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleUpdateEntity(e.id)}
                        disabled={loadingUpdateEntity}
                        className="flex-1 rounded bg-indigo-600 px-2 py-1 text-xs font-semibold text-white hover:bg-indigo-500 disabled:bg-indigo-400"
                      >
                        {loadingUpdateEntity ? 'Saving...' : 'Save'}
                      </button>
                      <button
                        onClick={() => setEditingEntityId(null)}
                        className="flex-1 rounded bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-200"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex justify-between items-start gap-2">
                    <div>
                      <span className="font-semibold text-slate-900 block">{e.name}</span>
                      {e.ntnNumber && <span className="text-slate-400">NTN: {e.ntnNumber}</span>}
                      {e.strnNumber && <span className="text-slate-400 ml-2">STRN: {e.strnNumber}</span>}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="inline-block rounded px-2 py-0.5 font-bold uppercase tracking-wider bg-slate-100 text-slate-600">
                        {e.type}
                      </span>
                      <button
                        onClick={() => {
                          setEditingEntityId(e.id);
                          setEditingEntityName(e.name);
                          setEditingEntityType(e.type as any);
                          setEditingEntityNtn(e.ntnNumber || '');
                          setEditingEntityStrn(e.strnNumber || '');
                          setEditingEntityAddress(e.address || '');
                        }}
                        className="text-indigo-600 hover:text-indigo-500 font-semibold"
                      >
                        Edit
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Items list */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 space-y-4">
          <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wide">Items Registry (Maal List)</h4>
          <div className="max-h-96 overflow-y-auto border border-slate-100 rounded-lg divide-y divide-slate-100">
            {initialItems.map((i) => (
              <div key={i.id} className="flex justify-between items-center p-3 hover:bg-slate-50 text-xs">
                <div>
                  <span className="font-mono text-indigo-600 font-semibold mr-2">[{i.sku}]</span>
                  <span className="font-semibold text-slate-950">{i.name}</span>
                </div>
                <span className="inline-block rounded px-2 py-0.5 font-bold uppercase tracking-wider bg-indigo-50 text-indigo-600 scale-95">
                  {i.type === 'RAW_MATERIAL' ? 'RAW (LBS)' : 'FG (PCS)'}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Expense Categories list */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 space-y-4">
          <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wide">Expense Categories (Kharchay Ki Qismaat List)</h4>
          <div className="max-h-96 overflow-y-auto border border-slate-100 rounded-lg divide-y divide-slate-100">
            {initialExpenseCategories.map((c) => (
              <div key={c.id} className="flex justify-between items-center p-3 hover:bg-slate-50 text-xs">
                {editingCatId === c.id ? (
                  <div className="flex items-center gap-2 w-full">
                    <input
                      type="text"
                      value={editingCatName}
                      onChange={(e) => setEditingCatName(e.target.value)}
                      className="flex-1 rounded-lg border border-slate-300 px-2 py-1 text-xs text-slate-900 focus:border-indigo-500 focus:outline-none"
                    />
                    <button
                      onClick={() => handleUpdateCategory(c.id)}
                      className="p-1 text-emerald-600 hover:text-emerald-700 font-bold"
                      title="Save"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => {
                        setEditingCatId(null);
                        setEditingCatName('');
                      }}
                      className="p-1 text-slate-400 hover:text-slate-600"
                      title="Cancel"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <>
                    <span className="font-semibold text-slate-900">{c.name}</span>
                    <div className="flex items-center gap-3 shrink-0">
                      <button
                        onClick={() => {
                          setEditingCatId(c.id);
                          setEditingCatName(c.name);
                        }}
                        className="text-indigo-600 hover:text-indigo-500 font-semibold"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeleteCategory(c.id)}
                        className="text-rose-600 hover:text-rose-500 font-semibold"
                      >
                        Delete
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
