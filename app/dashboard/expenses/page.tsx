import React from 'react';
import { prisma } from '../../../db';
import { ExpenseForm } from './ExpenseForm';
import { DEFAULT_PAGE_SIZE } from '../../../lib/pagination';

export const revalidate = 0; // Dynamic server component

export default async function ExpensesPage() {
  let categories: { id: string; name: string }[] = [];
  let recentExpenses: any[] = [];
  let errorMsg: string | null = null;

  try {
    categories = await prisma.expenseCategory.findMany({
      orderBy: { name: 'asc' },
    });

    const now = new Date();
    const pktOffset = 5 * 60 * 60 * 1000;
    const pktTime = new Date(now.getTime() + pktOffset);
    const pktDateString = pktTime.toISOString().split('T')[0];

    const startOfToday = new Date(`${pktDateString}T00:00:00.000Z`);
    startOfToday.setHours(startOfToday.getHours() - 5);

    const endOfToday = new Date(`${pktDateString}T23:59:59.999Z`);
    endOfToday.setHours(endOfToday.getHours() - 5);

    recentExpenses = await prisma.expense.findMany({
      where: {
        expenseDate: {
          gte: startOfToday,
          lte: endOfToday,
        },
      },
      orderBy: { expenseDate: 'desc' },
      take: DEFAULT_PAGE_SIZE,
      include: {
        category: true,
      },
    });
  } catch (error: any) {
    console.error('Failed to load expenses data:', error);
    errorMsg = error.message || 'Unknown database error';
  }

  // Format initial expenses for serialization safely
  const serializedExpenses = recentExpenses.map(e => ({
    id: e.id,
    amount: Number(e.amount),
    description: e.description,
    expenseDate: e.expenseDate.toISOString(),
    categoryName: e.category.name,
  }));

  return (
    <div className="p-4 sm:p-8 space-y-8">
      {/* Header */}
      <div className="border-b border-slate-200 pb-5">
        <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">Daily Expenses (Rozana Kharcha)</h2>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">
          Record petty cash outlays and factory operational overheads. Entries update cash positions and double-entry financial ledger records automatically.
        </p>
      </div>

      {errorMsg && (
        <div className="rounded-lg bg-rose-50 p-4 border border-rose-200 text-xs text-rose-800 font-medium">
          {errorMsg}
        </div>
      )}

      {/* Main interactive form + list */}
      <ExpenseForm categories={categories} initialExpenses={serializedExpenses} />
    </div>
  );
}
