import React from 'react';
import { prisma } from '../../../db';
import { SupplierTable } from './SupplierTable';
import {
  DEFAULT_PAGE_SIZE,
  LIST_QUERY_CAP,
  paginateArray,
  parsePageParam,
} from '../../../lib/pagination';

export const revalidate = 0; // Dynamic server component

interface PageProps {
  searchParams: Promise<{
    supplierId?: string;
    itemId?: string;
    startDate?: string;
    endDate?: string;
    page?: string;
  }>;
}

export default async function SupplierLedgerPage({ searchParams }: PageProps) {
  const resolvedParams = await searchParams;
  const supplierId = resolvedParams.supplierId || '';
  const itemId = resolvedParams.itemId || '';
  const startDate = resolvedParams.startDate || '';
  const endDate = resolvedParams.endDate || '';
  const page = parsePageParam(resolvedParams.page);

  let errorMsg: string | null = null;
  let suppliersList: any[] = [];
  let yarnItems: any[] = [];
  let transactionCards: any[] = [];
  let pagination = paginateArray([], page, DEFAULT_PAGE_SIZE).meta;

  try {
    // 1. Fetch suppliers and items for dropdowns
    suppliersList = await prisma.entity.findMany({
      where: { type: 'SUPPLIER' },
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    });

    yarnItems = await prisma.inventoryItem.findMany({
      where: { type: 'RAW_MATERIAL' },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, sku: true },
    });

    // 2. Fetch purchases (PurchaseLine)
    const purchases = await prisma.purchaseLine.findMany({
      include: {
        purchaseInvoice: {
          include: {
            supplier: true,
          },
        },
        item: true,
      },
      orderBy: {
        purchaseInvoice: {
          invoiceDate: 'desc',
        },
      },
      take: LIST_QUERY_CAP,
    });

    const payments = await prisma.financialTransaction.findMany({
      where: {
        description: {
          startsWith: 'Outbound Payment to',
        },
      },
      include: {
        lines: true,
      },
      orderBy: {
        postedAt: 'desc',
      },
      take: LIST_QUERY_CAP,
    });

    // 4. Map to unified transaction cards
    const purchaseCards = purchases.map((p) => ({
      id: p.id,
      type: 'PURCHASE',
      date: p.purchaseInvoice.invoiceDate.toISOString().split('T')[0],
      entityId: p.purchaseInvoice.supplierId,
      entityName: p.purchaseInvoice.supplier.name,
      itemName: p.item.name,
      itemId: p.itemId,
      sku: p.item.sku,
      quantity: Number(p.quantity), // in KG
      totalPrice: Number(p.totalPrice),
      invoiceNumber: p.purchaseInvoice.invoiceNumber,
    }));

    const paymentCards = payments.map((pay) => {
      const supplier = suppliersList.find((s) => s.id === pay.reference);
      const amount = pay.lines.reduce((max, line) => {
        const val = Math.max(Number(line.debit), Number(line.credit));
        return val > max ? val : max;
      }, 0);

      return {
        id: pay.id,
        type: 'PAYMENT',
        date: pay.postedAt.toISOString().split('T')[0],
        entityId: pay.reference || '',
        entityName: supplier ? supplier.name : 'Unknown Supplier (Sootar Wala)',
        itemName: null,
        itemId: null,
        sku: null,
        quantity: 0,
        totalPrice: amount,
        invoiceNumber: pay.description,
      };
    });

    // Combine all cards
    let allCards = [...purchaseCards, ...paymentCards];

    // Sort combined cards by date desc
    allCards.sort((a, b) => b.date.localeCompare(a.date));

    // 5. Apply filters
    if (supplierId) {
      allCards = allCards.filter((c) => c.entityId === supplierId);
    }
    if (itemId) {
      // For specific yarn types, hide payments and filter purchases
      allCards = allCards.filter((c) => c.itemId === itemId);
    }
    if (startDate) {
      allCards = allCards.filter((c) => c.date >= startDate);
    }
    if (endDate) {
      allCards = allCards.filter((c) => c.date <= endDate);
    }

    const paged = paginateArray(allCards, page, DEFAULT_PAGE_SIZE);
    transactionCards = paged.items;
    pagination = paged.meta;
  } catch (error: any) {
    console.error('Failed to load supplier ledger:', error);
    errorMsg = error.message || 'Unknown database error';
  }

  return (
    <div className="p-8 space-y-8">
      {/* Header Banner */}
      <div className="flex justify-between items-center border-b border-slate-200 pb-5">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">Suppliers (Sootar Walay)</h2>
          <p className="text-sm text-slate-500 mt-1">
            Track yarn purchases, total billed (Udhar), total paid (Paisa Diya), and To Pay (Paisa Dena Hai).
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

      {/* Supplier ledger table and filtering */}
      <SupplierTable
        suppliers={suppliersList}
        yarnItems={yarnItems}
        transactionCards={transactionCards}
        pagination={pagination}
        filters={{
          supplierId,
          itemId,
          startDate,
          endDate,
        }}
      />
    </div>
  );
}

