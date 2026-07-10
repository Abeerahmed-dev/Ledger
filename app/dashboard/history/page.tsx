import React from 'react';
import { prisma } from '../../../db';
import { HistoryLogs } from './HistoryLogs';
import {
  buildPaginationMeta,
  DEFAULT_PAGE_SIZE,
  getSkip,
  parsePageParam,
} from '../../../lib/pagination';
import { Prisma } from '@prisma/client';

export const revalidate = 0; // Dynamic server component

interface PageProps {
  searchParams: Promise<{
    month?: string;
    year?: string;
    startDate?: string;
    endDate?: string;
    page?: string;
    type?: string;
  }>;
}

export default async function HistoryPage({ searchParams }: PageProps) {
  let logs: any[] = [];
  let errorMsg: string | null = null;

  // Defaults for aggregation dashboard
  let totalYarnBought = 0;
  let totalShirtsReceived = 0;
  let totalSales = 0;
  let totalExpenses = 0;

  const now = new Date();
  const resolvedParams = await searchParams;
  const currentMonth = resolvedParams.month ? parseInt(resolvedParams.month) : now.getMonth() + 1;
  const currentYear = resolvedParams.year ? parseInt(resolvedParams.year) : now.getFullYear();
  const page = parsePageParam(resolvedParams.page);
  const selectedType = resolvedParams.type || 'ALL';

  let pagination = buildPaginationMeta(page, DEFAULT_PAGE_SIZE, 0);

  // Resolve start/end dates
  let start: Date;
  let end: Date;

  if (resolvedParams.startDate && resolvedParams.endDate) {
    start = new Date(resolvedParams.startDate);
    end = new Date(resolvedParams.endDate);
    end.setHours(23, 59, 59, 999);
  } else {
    start = new Date(currentYear, currentMonth - 1, 1);
    end = new Date(currentYear, currentMonth, 0, 23, 59, 59, 999);
  }

  try {
    const logWhere: Prisma.ActivityLogWhereInput = {
      timestamp: { gte: start, lte: end },
      ...(selectedType !== 'ALL' ? { actionType: selectedType as any } : {}),
    };

    const [fetchedLogs, totalLogs] = await Promise.all([
      prisma.activityLog.findMany({
        where: logWhere,
        orderBy: { timestamp: 'desc' },
        take: DEFAULT_PAGE_SIZE,
        skip: getSkip(page, DEFAULT_PAGE_SIZE),
      }),
      prisma.activityLog.count({ where: logWhere }),
    ]);

    logs = fetchedLogs;
    pagination = buildPaginationMeta(page, DEFAULT_PAGE_SIZE, totalLogs);

    // 2. Aggregate Total Yarn Bought (KG) from PurchaseLines
    const yarnBoughtAgg = await prisma.purchaseLine.aggregate({
      where: {
        purchaseInvoice: {
          invoiceDate: {
            gte: start,
            lte: end,
          },
        },
      },
      _sum: {
        quantity: true,
      },
    });
    totalYarnBought = yarnBoughtAgg._sum.quantity ? Number(yarnBoughtAgg._sum.quantity) : 0;

    // 3. Aggregate Total Shirts Received (PCS) from InventoryLedger
    const shirtsReceivedAgg = await prisma.inventoryLedger.aggregate({
      where: {
        toLocation: { type: 'MAIN_WAREHOUSE' },
        item: { type: 'FINISHED_GOOD' },
        transactionAt: {
          gte: start,
          lte: end,
        },
      },
      _sum: {
        quantity: true,
      },
    });
    totalShirtsReceived = shirtsReceivedAgg._sum.quantity ? Number(shirtsReceivedAgg._sum.quantity) : 0;

    // 4. Aggregate Net Sales Revenue (Kul Bikri) from FinancialLedger
    const salesAgg = await prisma.financialLedger.aggregate({
      where: {
        account: { type: 'REVENUE' },
        transaction: {
          postedAt: {
            gte: start,
            lte: end,
          },
        },
      },
      _sum: {
        credit: true,
      },
    });
    totalSales = salesAgg._sum.credit ? Number(salesAgg._sum.credit) : 0;

    // 5. Aggregate Net Expenses (Kul Kharcha) from FinancialLedger
    const expenseAgg = await prisma.financialLedger.aggregate({
      where: {
        account: { type: 'EXPENSE' },
        transaction: {
          postedAt: {
            gte: start,
            lte: end,
          },
        },
      },
      _sum: {
        debit: true,
      },
    });
    totalExpenses = expenseAgg._sum.debit ? Number(expenseAgg._sum.debit) : 0;

  } catch (error: any) {
    console.error('Failed to load activity logs and summaries:', error);
    errorMsg = error.message || 'Unknown database connection error';
  }

  // Format model log entries for safe transport
  const formattedLogs = logs.map((log) => ({
    id: log.id,
    timestamp: log.timestamp.toISOString(),
    actionType: log.actionType,
    description: log.description,
    orderNumber: log.orderNumber || null,
  }));

  return (
    <div className="p-4 sm:p-8 space-y-6 pb-24 md:pb-8 max-w-4xl mx-auto">
      {/* Header Section */}
      <div className="flex justify-between items-center border-b border-slate-200 pb-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900">History (Pichla Record)</h2>
          <p className="text-xs text-slate-500 mt-1">
            An append-only transaction registry tracking every action taken within the micro-ERP system.
          </p>
        </div>
      </div>

      {/* Database connection alert message */}
      {errorMsg && (
        <div className="rounded-xl bg-amber-50 p-4 border border-amber-250 text-xs text-amber-800 font-semibold">
          {errorMsg}
        </div>
      )}

      {/* History logs rendering */}
      <HistoryLogs
        logs={formattedLogs}
        initialMonth={currentMonth}
        initialYear={currentYear}
        selectedType={selectedType}
        pagination={pagination}
        totalYarnBought={totalYarnBought}
        totalShirtsReceived={totalShirtsReceived}
        totalSales={totalSales}
        totalExpenses={totalExpenses}
      />
    </div>
  );
}
