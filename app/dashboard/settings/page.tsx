import React from 'react';
import { prisma } from '../../../db';
import { SettingsForm } from './SettingsForm';

export const revalidate = 0; // Dynamic server component

export default async function SettingsPage() {
  let entities: any[] = [];
  let items: any[] = [];
  let expenseCategories: any[] = [];
  let errorMsg: string | null = null;

  try {
    entities = await prisma.entity.findMany({
      orderBy: { name: 'asc' },
      select: { id: true, name: true, type: true, ntnNumber: true, strnNumber: true, address: true },
    });

    items = await prisma.inventoryItem.findMany({
      orderBy: { name: 'asc' },
    });

    expenseCategories = await prisma.expenseCategory.findMany({
      orderBy: { name: 'asc' },
    });
  } catch (error: any) {
    console.error('Failed to load settings data:', error);
    errorMsg = error.message || 'Unknown database connection error';
  }

  return (
    <div className="p-8 space-y-8">
      {/* Header Section */}
      <div className="flex justify-between items-center border-b border-slate-200 pb-5">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">Settings (Master Data)</h2>
          <p className="text-sm text-slate-500 mt-1">
            Dynamically insert yarn types, shirt types, suppliers, makers, customer companies, and expense categories.
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

      {/* Settings form rendering */}
      <SettingsForm initialEntities={entities} initialItems={items} initialExpenseCategories={expenseCategories} />
    </div>
  );
}
