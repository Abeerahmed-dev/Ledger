import React from 'react';
import { prisma } from '../../../db';
import { CompanyTable } from './CompanyTable';
import {
  DEFAULT_PAGE_SIZE,
  LIST_QUERY_CAP,
  paginateArray,
  parsePageParam,
} from '../../../lib/pagination';

export const revalidate = 0; // Dynamic server component

interface PageProps {
  searchParams: Promise<{
    companyId?: string;
    jwoNumber?: string;
    status?: string;
    page?: string;
  }>;
}

export default async function CompanyLedgerPage({ searchParams }: PageProps) {
  const resolvedParams = await searchParams;
  const companyId = resolvedParams.companyId || '';
  const jwoNumber = resolvedParams.jwoNumber || '';
  const status = resolvedParams.status || '';
  const page = parsePageParam(resolvedParams.page);

  let errorMsg: string | null = null;
  let companiesList: any[] = [];
  let uniqueJobNumbers: any[] = [];
  let transactionCards: any[] = [];
  let pagination = paginateArray([], page, DEFAULT_PAGE_SIZE).meta;
  let metrics = {
    totalBilled: 0,
    totalPaid: 0,
    advancePaid: 0,
    remaining: 0,
  };

  try {
    // 1. Fetch companies list
    companiesList = await prisma.entity.findMany({
      where: { type: 'COMPANY' },
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    });

    // 2. Fetch distinct Job/JWO Numbers
    const jobRecords = await prisma.salesInvoice.findMany({
      where: {
        AND: [
          { jobNumber: { not: null } },
          { jobNumber: { not: '' } }
        ]
      },
      select: {
        jobNumber: true,
      },
      distinct: ['jobNumber'],
      take: LIST_QUERY_CAP,
    });
    uniqueJobNumbers = jobRecords.map((r) => r.jobNumber).filter(Boolean);

    // 3. Fetch AR Account
    const arAccount = await prisma.chartOfAccounts.findUnique({
      where: { code: '1200' },
    });

    // 4. Fetch total received payments for all companies
    const companyPaymentsMap = new Map<string, number>();
    if (arAccount) {
      for (const c of companiesList) {
        const receivedSum = await prisma.financialLedger.aggregate({
          where: {
            accountId: arAccount.id,
            credit: { gt: 0 },
            transaction: { reference: c.id },
          },
          _sum: { credit: true },
        });
        const totalReceived = receivedSum._sum.credit ? Number(receivedSum._sum.credit) : 0;
        companyPaymentsMap.set(c.id, totalReceived);
      }
    }

    // 5. Fetch sales invoices sorted by date for FIFO calculation
    const invoices = await prisma.salesInvoice.findMany({
      include: {
        customer: true,
        lines: {
          include: {
            item: true,
          },
        },
      },
      orderBy: {
        invoiceDate: 'asc',
      },
      take: LIST_QUERY_CAP,
    });

    // 6. Map invoices to card records and compute FIFO payment status
    const companyRunningInvoiceSum = new Map<string, number>();

    const mappedInvoices = invoices.map((inv) => {
      const totalReceived = companyPaymentsMap.get(inv.customerId) || 0;
      const runningSum = companyRunningInvoiceSum.get(inv.customerId) || 0;

      const lineSum = inv.lines.reduce((sum, l) => sum + Number(l.totalPrice), 0);
      const gst = lineSum * 0.18;
      const invoiceTotal = lineSum + gst;

      const newRunningSum = runningSum + invoiceTotal;
      companyRunningInvoiceSum.set(inv.customerId, newRunningSum);

      const paymentStatus = totalReceived >= newRunningSum ? 'Cleared' : 'Unpaid Invoices';

      return {
        id: inv.id,
        invoiceNumber: inv.invoiceNumber,
        customerId: inv.customerId,
        customerName: inv.customer.name,
        date: inv.invoiceDate.toISOString().split('T')[0],
        poNumber: inv.poNumber || '',
        jobNumber: inv.jobNumber || '',
        paymentTerms: inv.paymentTerms || '',
        shippingMethod: inv.shippingMethod || '',
        itemName: inv.lines[0]?.item.name || 'Finished Shirts',
        sku: inv.lines[0]?.item.sku || '',
        quantity: inv.lines.reduce((sum, l) => sum + Number(l.quantity), 0),
        totalPrice: invoiceTotal,
        paymentStatus,
      };
    });

    // Group mappedInvoices by invoiceNumber + date to consolidate deliveries under the same bill
    const groupedInvoices: { [key: string]: typeof mappedInvoices } = {};
    for (const inv of mappedInvoices) {
      const key = `${inv.invoiceNumber}_${inv.date}`;
      if (!groupedInvoices[key]) {
        groupedInvoices[key] = [];
      }
      groupedInvoices[key].push(inv);
    }

    const consolidatedInvoices = Object.entries(groupedInvoices).map(([key, group]) => {
      const first = group[0];
      const totalQty = group.reduce((sum, item) => sum + item.quantity, 0);
      const totalPrice = group.reduce((sum, item) => sum + item.totalPrice, 0);

      // Distinct items description or name
      const distinctItems = [...new Set(group.map((item) => item.itemName))];
      const itemName = distinctItems.join(', ');

      return {
        id: first.id,
        invoiceNumber: first.invoiceNumber,
        customerId: first.customerId,
        customerName: first.customerName,
        date: first.date,
        poNumber: first.poNumber,
        jobNumber: first.jobNumber,
        paymentTerms: first.paymentTerms,
        shippingMethod: first.shippingMethod,
        itemName: itemName,
        sku: first.sku,
        quantity: totalQty,
        totalPrice: totalPrice,
        paymentStatus: first.paymentStatus,
      };
    });

    // Sort cards descending for presentation
    let allCards = [...consolidatedInvoices];
    allCards.sort((a, b) => b.date.localeCompare(a.date));

    // Apply filters
    if (companyId) {
      allCards = allCards.filter((c) => c.customerId === companyId);
    }
    if (jwoNumber) {
      allCards = allCards.filter((c) => c.jobNumber === jwoNumber);
    }
    if (status) {
      allCards = allCards.filter((c) => c.paymentStatus === status);
    }

    // Calculate the 4 metrics via Prisma aggregations for the selected Company
    const advanceAccount = await prisma.chartOfAccounts.findUnique({
      where: { code: '2200' },
    });

    metrics = {
      totalBilled: 0,
      totalPaid: 0,
      advancePaid: 0,
      remaining: 0,
    };

    if (arAccount) {
      const billedSum = await prisma.financialLedger.aggregate({
        where: {
          accountId: arAccount.id,
          debit: { gt: 0 },
          transaction: companyId ? { reference: companyId } : {
            reference: { in: companiesList.map((c) => c.id) }
          },
        },
        _sum: { debit: true },
      });
      metrics.totalBilled = billedSum._sum.debit ? Number(billedSum._sum.debit) : 0;

      const paidSum = await prisma.financialLedger.aggregate({
        where: {
          accountId: arAccount.id,
          credit: { gt: 0 },
          transaction: {
            reference: companyId ? companyId : { in: companiesList.map((c) => c.id) },
            description: { startsWith: 'Inbound Payment' },
          },
        },
        _sum: { credit: true },
      });
      metrics.totalPaid = paidSum._sum.credit ? Number(paidSum._sum.credit) : 0;
    }

    if (advanceAccount) {
      const advSum = await prisma.financialLedger.aggregate({
        where: {
          accountId: advanceAccount.id,
          transaction: companyId ? { reference: companyId } : {
            reference: { in: companiesList.map((c) => c.id) }
          },
        },
        _sum: { debit: true, credit: true },
      });
      const debit = advSum._sum.debit ? Number(advSum._sum.debit) : 0;
      const credit = advSum._sum.credit ? Number(advSum._sum.credit) : 0;
      metrics.advancePaid = Math.max(0, credit - debit);

      const consumedSum = await prisma.financialLedger.aggregate({
        where: {
          accountId: advanceAccount.id,
          debit: { gt: 0 },
          transaction: companyId ? { reference: companyId } : {
            reference: { in: companiesList.map((c) => c.id) }
          },
        },
        _sum: { debit: true },
      });
      const consumedAdvances = consumedSum._sum.debit ? Number(consumedSum._sum.debit) : 0;

      metrics.remaining = Math.max(0, (metrics.totalBilled - metrics.totalPaid) - consumedAdvances);
    } else {
      metrics.remaining = Math.max(0, metrics.totalBilled - metrics.totalPaid);
    }

    const paged = paginateArray(allCards, page, DEFAULT_PAGE_SIZE);
    transactionCards = paged.items;
    pagination = paged.meta;
  } catch (error: any) {
    console.error('Failed to load company ledger:', error);
    errorMsg = error.message || 'Unknown database error';
  }

  return (
    <div className="p-8 space-y-8">
      {/* Header Banner */}
      <div className="flex justify-between items-center border-b border-slate-200 pb-5">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">Companies (Party)</h2>
          <p className="text-sm text-slate-500 mt-1">
            Track garment export contracts, invoices generated, receipts recorded, and reconcile outstanding customer accounts receivable.
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

      {/* Company ledger table and filters */}
      <CompanyTable
        companies={companiesList}
        jobNumbers={uniqueJobNumbers}
        transactionCards={transactionCards}
        pagination={pagination}
        metrics={metrics}
        filters={{
          companyId,
          jwoNumber,
          status,
        }}
      />
    </div>
  );
}

