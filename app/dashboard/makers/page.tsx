import React from 'react';
import { prisma } from '../../../db';
import { MakerTable } from './MakerTable';
import {
  DEFAULT_PAGE_SIZE,
  LIST_QUERY_CAP,
  paginateArray,
  parsePageParam,
} from '../../../lib/pagination';

export const revalidate = 0; // Dynamic server component

interface PageProps {
  searchParams: Promise<{
    makerId?: string;
    jwoId?: string;
    status?: string;
    page?: string;
  }>;
}

export default async function MakerLedgerPage({ searchParams }: PageProps) {
  const resolvedParams = await searchParams;
  const makerId = resolvedParams.makerId || '';
  const jwoId = resolvedParams.jwoId || '';
  const status = resolvedParams.status || '';
  const page = parsePageParam(resolvedParams.page);

  let errorMsg: string | null = null;
  let makersList: any[] = [];
  let jwoOptions: any[] = [];
  let jobWorkOrders: any[] = [];
  let pagination = paginateArray([], page, DEFAULT_PAGE_SIZE).meta;
  let metrics = {
    totalBilled: 0,
    totalPaid: 0,
    advancePaid: 0,
    remaining: 0,
  };

  try {
    // 1. Fetch makers for dropdown
    makersList = await prisma.entity.findMany({
      where: { type: 'MAKER' },
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    });

    // 2. Fetch unique order numbers for dropdown
    const orderLogs = await prisma.activityLog.findMany({
      where: {
        AND: [
          { orderNumber: { not: null } },
          { orderNumber: { not: '' } }
        ]
      },
      select: {
        orderNumber: true,
      },
      distinct: ['orderNumber'],
      orderBy: { timestamp: 'desc' },
      take: LIST_QUERY_CAP,
    });

    jwoOptions = orderLogs.map((log) => ({
      id: log.orderNumber as string,
      orderNumber: log.orderNumber as string,
      makerId: '',
    }));

    // 3. Fetch Maker Activity Logs & construct Job Cards dynamically
    const selectedMaker = makerId ? makersList.find(m => m.id === makerId) : null;
    const logs = await prisma.activityLog.findMany({
      where: {
        actionType: { in: ['MAKER_TRANSFER', 'GOODS_RECEIVED'] },
        AND: [
          { orderNumber: { not: null } },
          { orderNumber: { not: '' } },
          selectedMaker ? { description: { contains: selectedMaker.name } } : {}
        ]
      },
      orderBy: { timestamp: 'desc' },
      take: LIST_QUERY_CAP,
    });

    // Group logs by orderNumber
    const groupedJobs: { [key: string]: typeof logs } = {};
    for (const log of logs) {
      const oNum = log.orderNumber as string;
      if (!groupedJobs[oNum]) {
        groupedJobs[oNum] = [];
      }
      groupedJobs[oNum].push(log);
    }

    const cardsList = [];

    for (const [orderNumber, jobLogs] of Object.entries(groupedJobs)) {
      // Find maker details from logs
      // transfer log example: Issued 100 lbs of Yarn to Maker Adam Maker (Order: JWO-123)
      // receive log example: Received 100 shirts from Adam Maker (Order: JWO-123)
      let makerName = 'Maker';
      const receiveLog = jobLogs.find(l => l.actionType === 'GOODS_RECEIVED');
      const transferLog = jobLogs.find(l => l.actionType === 'MAKER_TRANSFER');

      if (receiveLog) {
        const mMatch = receiveLog.description.match(/from (.+?)(?:\s\(|$)/i);
        if (mMatch) makerName = mMatch[1].trim();
      } else if (transferLog) {
        const mMatch = transferLog.description.match(/to Maker (.+?)(?:\s\(|$)/i);
        if (mMatch) makerName = mMatch[1].trim();
      }

      // Find the makerId from our makersList matching makerName
      const matchingMaker = makersList.find(m => m.name.toLowerCase() === makerName.toLowerCase());
      const currentMakerId = matchingMaker ? matchingMaker.id : '';

      // Quantities
      let yarnIssuedLbs = 0;
      let yarnConsumedLbs = 0;
      let shirtsReceivedPcs = 0;
      const receivedItems: { itemName: string; quantity: number }[] = [];

      for (const log of jobLogs) {
        if (log.actionType === 'MAKER_TRANSFER') {
          const qtyMatch = log.description.match(/Issued (\d+(?:\.\d+)*) lbs/i);
          if (qtyMatch) yarnIssuedLbs += parseFloat(qtyMatch[1]);
        } else if (log.actionType === 'GOODS_RECEIVED') {
          const qtyMatch = log.description.match(/Received (\d+(?:\.\d+)*) (?:pcs of (.+?)|shirts) from/i);
          if (qtyMatch) {
            const qty = parseFloat(qtyMatch[1]);
            const itemName = qtyMatch[2] ? qtyMatch[2].trim() : 'Finished Shirts';
            shirtsReceivedPcs += qty;

            const existing = receivedItems.find(i => i.itemName === itemName);
            if (existing) {
              existing.quantity += qty;
            } else {
              receivedItems.push({ itemName, quantity: qty });
            }
          }

          const consumedMatch = log.description.match(/Consumed (\d+(?:\.\d+)*) lbs/i);
          if (consumedMatch) {
            yarnConsumedLbs += parseFloat(consumedMatch[1]);
          } else {
            // Fallback: if there's a receipt log without a Consumed tag, assume full consumption
            yarnConsumedLbs = yarnIssuedLbs;
          }
        }
      }

      // Fetch labor cost from FinancialLedger entries tagged with this orderNumber
      const ledgerLines = await prisma.financialLedger.findMany({
        where: {
          orderNumber: orderNumber,
          account: { code: '2100' },
        },
        select: {
          credit: true,
        },
        take: 50,
      });

      const laborCost = ledgerLines.reduce((sum, l) => sum + Number(l.credit), 0);

      // Determine statuses based on yarn balance remaining
      const yarnRemaining = Math.max(0, yarnIssuedLbs - yarnConsumedLbs);
      const isClosed = yarnRemaining <= 0.0001 && jobLogs.some(l => l.actionType === 'GOODS_RECEIVED');
      const status = isClosed ? 'COMPLETED' : 'OPEN';
      const materialStatus = isClosed ? 'Returned' : 'Pending Shirts';
      const jobDate = jobLogs[jobLogs.length - 1].timestamp.toISOString().split('T')[0];

      cardsList.push({
        id: orderNumber, // Use orderNumber as local key
        orderNumber: orderNumber,
        makerId: currentMakerId,
        makerName: makerName,
        date: jobDate,
        status: status,
        materialStatus: materialStatus,
        yarnIssuedLbs: yarnIssuedLbs,
        shirtsReceivedPcs: shirtsReceivedPcs,
        laborCost: laborCost,
        receivedItems,
      });
    }

    // Calculate the 4 metrics via Prisma aggregations
    const apAccount = await prisma.chartOfAccounts.findUnique({
      where: { code: '2100' },
    });
    const advanceAccount = await prisma.chartOfAccounts.findUnique({
      where: { code: '1300' },
    });

    metrics = {
      totalBilled: 0,
      totalPaid: 0,
      advancePaid: 0,
      remaining: 0,
    };

    if (apAccount) {
      const billedSum = await prisma.financialLedger.aggregate({
        where: {
          accountId: apAccount.id,
          credit: { gt: 0 },
          transaction: makerId ? { reference: makerId } : {
            reference: { in: makersList.map((m) => m.id) }
          },
        },
        _sum: { credit: true },
      });
      metrics.totalBilled = billedSum._sum.credit ? Number(billedSum._sum.credit) : 0;

      const paidSum = await prisma.financialLedger.aggregate({
        where: {
          accountId: apAccount.id,
          debit: { gt: 0 },
          transaction: {
            reference: makerId ? makerId : { in: makersList.map((m) => m.id) },
            description: { startsWith: 'Outbound Payment' },
          },
        },
        _sum: { debit: true },
      });
      metrics.totalPaid = paidSum._sum.debit ? Number(paidSum._sum.debit) : 0;
    }

    if (advanceAccount) {
      const advSum = await prisma.financialLedger.aggregate({
        where: {
          accountId: advanceAccount.id,
          transaction: makerId ? { reference: makerId } : {
            reference: { in: makersList.map((m) => m.id) }
          },
        },
        _sum: { debit: true, credit: true },
      });
      const debit = advSum._sum.debit ? Number(advSum._sum.debit) : 0;
      const credit = advSum._sum.credit ? Number(advSum._sum.credit) : 0;
      metrics.advancePaid = Math.max(0, debit - credit);

      const consumedSum = await prisma.financialLedger.aggregate({
        where: {
          accountId: advanceAccount.id,
          credit: { gt: 0 },
          transaction: makerId ? { reference: makerId } : {
            reference: { in: makersList.map((m) => m.id) }
          },
        },
        _sum: { credit: true },
      });
      const consumedAdvances = consumedSum._sum.credit ? Number(consumedSum._sum.credit) : 0;

      metrics.remaining = Math.max(0, (metrics.totalBilled - metrics.totalPaid) - consumedAdvances);
    } else {
      metrics.remaining = Math.max(0, metrics.totalBilled - metrics.totalPaid);
    }

    // Filter jobs
    let filteredJobs = cardsList;
    if (makerId) {
      filteredJobs = filteredJobs.filter(j => j.makerId === makerId);
    }
    if (jwoId) {
      filteredJobs = filteredJobs.filter(j => j.orderNumber === jwoId);
    }
    if (status) {
      filteredJobs = filteredJobs.filter(j => j.materialStatus === status);
    }

    const paged = paginateArray(filteredJobs, page, DEFAULT_PAGE_SIZE);
    jobWorkOrders = paged.items;
    pagination = paged.meta;

  } catch (error: any) {
    console.error('Failed to load dynamic maker ledger page:', error);
    errorMsg = error.message || 'Unknown database connection error';
  }

  return (
    <div className="p-4 sm:p-8 space-y-8 max-w-4xl mx-auto">
      {/* Header Banner */}
      <div className="flex justify-between items-center border-b border-slate-200 pb-5">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">Makers (Karkhana / Thekedar)</h2>
          <p className="text-sm text-slate-500 mt-1">
            Track Maker WIP yarn balances, completed fabrication yield, charges billed, paid, and operations.
          </p>
        </div>
      </div>

      {errorMsg && (
        <div className="rounded-xl bg-amber-50 p-4 border border-amber-250 text-xs text-amber-800 font-semibold">
          {errorMsg}
        </div>
      )}

      <div className="mt-6">
        <MakerTable
          makers={makersList}
          jwoOptions={jwoOptions}
          jobWorkOrders={jobWorkOrders}
          pagination={pagination}
          metrics={metrics}
          filters={{
            makerId,
            jwoId,
            status,
          }}
        />
      </div>
    </div>
  );
}
