import React from 'react';
import { prisma } from '../../db';
import { MakerForm } from './MakerForm';
import { getInventoryPosition } from '../../reports';

export const revalidate = 0; // Dynamic server component

export default async function MakerPage() {
  let makers: { id: string; name: string }[] = [];
  let rawItems: { id: string; name: string; sku: string; availableStock: number }[] = [];
  let finishedItems: { id: string; name: string; sku: string }[] = [];
  let orders: { id: string; orderNumber: string; makerId: string }[] = [];
  let fetchError: string | null = null;

  try {
    makers = await prisma.entity.findMany({
      where: { type: 'MAKER' },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });

    const rawItemsList = await prisma.inventoryItem.findMany({
      where: { type: 'RAW_MATERIAL' },
      select: { id: true, name: true, sku: true },
      orderBy: { name: 'asc' },
    });

    const inventory = await getInventoryPosition();
    rawItems = rawItemsList.map((item) => {
      const invItem = inventory.rawMaterials.find((r) => r.itemId === item.id);
      return {
        ...item,
        availableStock: invItem ? invItem.balanceLbs : 0,
      };
    });

    finishedItems = await prisma.inventoryItem.findMany({
      where: { type: 'FINISHED_GOOD' },
      select: { id: true, name: true, sku: true },
      orderBy: { name: 'asc' },
    });
  } catch (error: any) {
    console.error('Failed to load maker entities:', error);
    fetchError = error.message || 'Unknown database connection error';
  }

  return (
    <div className="p-8 space-y-8">
      {/* Header Banner */}
      <div className="flex justify-between items-center border-b border-slate-200 pb-5">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">Makers (Karkhana / Thekedar)</h2>
          <p className="text-sm text-slate-500 mt-1">Manage WIP inventory transfers, stitch orders, and yield audits.</p>
        </div>
      </div>

      {/* Database offline warning banner */}
      {fetchError && (
        <div className="rounded-lg bg-amber-50 p-4 border border-amber-200">
          <div className="flex">
            <div className="shrink-0">
              <svg className="h-5 w-5 text-amber-600" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.537-1.517 2.537H3.72c-1.347 0-2.19-1.37-1.517-2.537l6.28-10.875zM10 8a.75.75 0 01.75.75v3.75a.75.75 0 01-1.5 0v-3.75A.75.75 0 0110 8zm0 7a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-semibold text-amber-800">Database Offline / Unseeded</h3>
              <div className="text-xs text-amber-700 mt-1">
                Failed to load makers. Please configure your database connection in `.env` and run the database setup steps.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Renders the forms layout client */}
      <div className="mt-8">
        <MakerForm
          makers={makers}
          rawItems={rawItems}
          finishedItems={finishedItems}
        />
      </div>
    </div>
  );
}
