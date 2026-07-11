import { z } from 'zod';
import { prisma } from './db';
import { LIST_QUERY_CAP } from './lib/pagination';

// Zod validation schemas
const MakerIdSchema = z.string().uuid();

/**
 * Calculates current lbs of yarn in Maker WIP, outstanding accounts payable balance,
 * and historical wastage percentage for a specific maker contractor.
 */
export async function getMakerReconciliation(makerIdInput: string) {
  const makerId = MakerIdSchema.parse(makerIdInput);

  // 1. Fetch Maker details
  const maker = await prisma.entity.findUnique({
    where: { id: makerId },
  });
  if (!maker || maker.type !== 'MAKER') {
    throw new Error(`Maker with ID ${makerId} not found or is not of type MAKER.`);
  }

  // 2. Fetch Maker WIP Location and current yarn balance in WIP
  const makerWip = await prisma.location.findUnique({
    where: {
      type_entityId: {
        type: 'MAKER_WIP',
        entityId: makerId,
      },
    },
  });

  let currentYarnInWipLbs = 0;
  if (makerWip) {
    const incoming = await prisma.inventoryLedger.aggregate({
      where: {
        toLocationId: makerWip.id,
        item: { type: 'RAW_MATERIAL' }, // Yarn
      },
      _sum: { quantity: true },
    });

    const outgoing = await prisma.inventoryLedger.aggregate({
      where: {
        fromLocationId: makerWip.id,
        item: { type: 'RAW_MATERIAL' },
      },
      _sum: { quantity: true },
    });

    const incomingQty = incoming._sum.quantity ? Number(incoming._sum.quantity) : 0;
    const outgoingQty = outgoing._sum.quantity ? Number(outgoing._sum.quantity) : 0;
    currentYarnInWipLbs = incomingQty - outgoingQty;
  }

  // 3. Outstanding Accounts Payable balance for this maker
  const apAccount = await prisma.chartOfAccounts.findUnique({
    where: { code: '2100' },
  });

  let outstandingApBalance = 0;
  if (apAccount) {
    const apLines = await prisma.financialLedger.aggregate({
      where: {
        accountId: apAccount.id,
        transaction: {
          reference: makerId,
        },
      },
      _sum: {
        debit: true,
        credit: true,
      },
    });

    const totalDebits = apLines._sum.debit ? Number(apLines._sum.debit) : 0;
    const totalCredits = apLines._sum.credit ? Number(apLines._sum.credit) : 0;
    
    // Liability is credit-normal
    outstandingApBalance = totalCredits - totalDebits;
  }

  const advanceAccount = await prisma.chartOfAccounts.findUnique({
    where: { code: '1300' },
  });
  if (advanceAccount) {
    const advSum = await prisma.financialLedger.aggregate({
      where: {
        accountId: advanceAccount.id,
        transaction: { reference: makerId },
      },
      _sum: { debit: true, credit: true },
    });
    const totalAdvDebits = advSum._sum.debit ? Number(advSum._sum.debit) : 0;
    const totalAdvCredits = advSum._sum.credit ? Number(advSum._sum.credit) : 0;
    const advanceBalance = totalAdvDebits - totalAdvCredits; // Asset is debit-normal
    outstandingApBalance = outstandingApBalance - advanceBalance;
  }

  // 4. Historical wastage percentage from WastageLog is removed
  const historicalWastagePercentage = 0;

  return {
    makerId: maker.id,
    makerName: maker.name,
    currentYarnInWipLbs,
    outstandingApBalance,
    historicalWastagePercentage,
  };
}

/**
 * Returns a grouped stock inventory balance sheet for the Main Warehouse,
 * separating Raw Materials (lbs) and Finished Goods (pcs).
 */
export async function getInventoryPosition() {
  // 1. Fetch Main Warehouse location
  const mainWarehouse = await prisma.location.findFirst({
    where: { type: 'MAIN_WAREHOUSE' },
  });
  if (!mainWarehouse) {
    return {
      rawMaterials: [],
      finishedGoods: [],
    };
  }

  // 2. Aggregate incoming quantities grouped by itemId
  const incomingGroup = await prisma.inventoryLedger.groupBy({
    by: ['itemId'],
    where: { toLocationId: mainWarehouse.id },
    _sum: { quantity: true },
  });

  // 3. Aggregate outgoing quantities grouped by itemId
  const outgoingGroup = await prisma.inventoryLedger.groupBy({
    by: ['itemId'],
    where: { fromLocationId: mainWarehouse.id },
    _sum: { quantity: true },
  });

  // 4. Calculate net balances
  const balanceMap = new Map<string, number>();

  for (const group of incomingGroup) {
    const qty = group._sum.quantity ? Number(group._sum.quantity) : 0;
    balanceMap.set(group.itemId, qty);
  }

  for (const group of outgoingGroup) {
    const qty = group._sum.quantity ? Number(group._sum.quantity) : 0;
    const current = balanceMap.get(group.itemId) || 0;
    balanceMap.set(group.itemId, current - qty);
  }

  // 5. Query item definitions
  const itemIds = Array.from(balanceMap.keys());
  const items = await prisma.inventoryItem.findMany({
    where: { id: { in: itemIds } },
  });

  const rawMaterials: { itemId: string; name: string; sku: string; balanceLbs: number }[] = [];
  const finishedGoods: { itemId: string; name: string; sku: string; balancePcs: number }[] = [];

  for (const item of items) {
    const balance = balanceMap.get(item.id) || 0;
    if (balance === 0) continue;

    if (item.type === 'RAW_MATERIAL') {
      rawMaterials.push({
        itemId: item.id,
        name: item.name,
        sku: item.sku,
        balanceLbs: balance,
      });
    } else if (item.type === 'FINISHED_GOOD') {
      finishedGoods.push({
        itemId: item.id,
        name: item.name,
        sku: item.sku,
        balancePcs: balance,
      });
    }
  }

  return {
    rawMaterials,
    finishedGoods,
  };
}

/**
 * Calculates financial reporting metrics: Total AR, Total AP,
 * and current month's Sales Revenue and COGS (Labor).
 */
export async function getFinancialSummary() {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

  // Account codes:
  // 1200: Accounts Receivable (Asset, debit-normal)
  // 2100: Accounts Payable (Liability, credit-normal)
  // 4100: Sales Revenue (Revenue, credit-normal)
  // 5100: COGS - Labor (Expense, debit-normal)

  // 1. Total Accounts Receivable
  const arAccount = await prisma.chartOfAccounts.findUnique({
    where: { code: '1200' },
  });
  let totalAccountsReceivable = 0;
  if (arAccount) {
    const arSum = await prisma.financialLedger.aggregate({
      where: { accountId: arAccount.id },
      _sum: { debit: true, credit: true },
    });
    const debit = arSum._sum.debit ? Number(arSum._sum.debit) : 0;
    const credit = arSum._sum.credit ? Number(arSum._sum.credit) : 0;
    totalAccountsReceivable = debit - credit;
  }

  // 2. Total Accounts Payable
  const apAccount = await prisma.chartOfAccounts.findUnique({
    where: { code: '2100' },
  });
  let totalAccountsPayable = 0;
  if (apAccount) {
    const apSum = await prisma.financialLedger.aggregate({
      where: { accountId: apAccount.id },
      _sum: { debit: true, credit: true },
    });
    const debit = apSum._sum.debit ? Number(apSum._sum.debit) : 0;
    const credit = apSum._sum.credit ? Number(apSum._sum.credit) : 0;
    totalAccountsPayable = credit - debit;
  }

  // 3. Total Sales Revenue for the current month
  const salesAccount = await prisma.chartOfAccounts.findUnique({
    where: { code: '4100' },
  });
  let totalSalesRevenueCurrentMonth = 0;
  if (salesAccount) {
    const salesSum = await prisma.financialLedger.aggregate({
      where: {
        accountId: salesAccount.id,
        createdAt: {
          gte: startOfMonth,
          lte: endOfMonth,
        },
      },
      _sum: { debit: true, credit: true },
    });
    const debit = salesSum._sum.debit ? Number(salesSum._sum.debit) : 0;
    const credit = salesSum._sum.credit ? Number(salesSum._sum.credit) : 0;
    totalSalesRevenueCurrentMonth = credit - debit;
  }

  // 4. Total COGS - Labor for the current month
  const cogsAccount = await prisma.chartOfAccounts.findUnique({
    where: { code: '5100' },
  });
  let totalCOGSCurrentMonth = 0;
  if (cogsAccount) {
    const cogsSum = await prisma.financialLedger.aggregate({
      where: {
        accountId: cogsAccount.id,
        createdAt: {
          gte: startOfMonth,
          lte: endOfMonth,
        },
      },
      _sum: { debit: true, credit: true },
    });
    const debit = cogsSum._sum.debit ? Number(cogsSum._sum.debit) : 0;
    const credit = cogsSum._sum.credit ? Number(cogsSum._sum.credit) : 0;
    totalCOGSCurrentMonth = debit - credit;
  }

  return {
    totalAccountsReceivable,
    totalAccountsPayable,
    totalSalesRevenueCurrentMonth,
    totalCOGSCurrentMonth,
  };
}

/**
 * Returns macro overview metrics (cash, sales, cogs, P/L).
 */
export async function getMacroOverview() {
  const summary = await getFinancialSummary();

  const cashAccount = await prisma.chartOfAccounts.findUnique({
    where: { code: '1000' },
  });
  let currentCashBalance = 0;
  if (cashAccount) {
    const cashSum = await prisma.financialLedger.aggregate({
      where: { accountId: cashAccount.id },
      _sum: { debit: true, credit: true },
    });
    const debit = cashSum._sum.debit ? Number(cashSum._sum.debit) : 0;
    const credit = cashSum._sum.credit ? Number(cashSum._sum.credit) : 0;
    currentCashBalance = debit - credit; // Debit normal Asset
  }

  const profitLoss = summary.totalSalesRevenueCurrentMonth - summary.totalCOGSCurrentMonth;

  return {
    sales: summary.totalSalesRevenueCurrentMonth,
    cogs: summary.totalCOGSCurrentMonth,
    cash: currentCashBalance,
    profit: profitLoss,
  };
}

/**
 * Returns supplier ledger purchase and AP balances list.
 */
export async function getSupplierLedger() {
  const suppliers = await prisma.entity.findMany({
    where: { type: 'SUPPLIER' },
    orderBy: { name: 'asc' },
  });
  const ledger = [];
  const apAccount = await prisma.chartOfAccounts.findUnique({
    where: { code: '2100' },
  });

  const advanceAccount = await prisma.chartOfAccounts.findUnique({
    where: { code: '1300' },
  });

  for (const s of suppliers) {
    const qtySum = await prisma.purchaseLine.aggregate({
      where: { purchaseInvoice: { supplierId: s.id } },
      _sum: { quantity: true, totalPrice: true },
    });
    const totalLbs = qtySum._sum.quantity ? Number(qtySum._sum.quantity) : 0;
    const totalBilled = qtySum._sum.totalPrice ? Number(qtySum._sum.totalPrice) : 0;

    let totalPaid = 0;
    if (apAccount) {
      const paidSum = await prisma.financialLedger.aggregate({
        where: {
          accountId: apAccount.id,
          debit: { gt: 0 },
          transaction: {
            reference: s.id,
            description: { startsWith: 'Outbound Payment' },
          },
        },
        _sum: { debit: true },
      });
      totalPaid = paidSum._sum.debit ? Number(paidSum._sum.debit) : 0;
    }

    let apBalance = 0;
    if (apAccount) {
      const apSum = await prisma.financialLedger.aggregate({
        where: {
          accountId: apAccount.id,
          transaction: { reference: s.id },
        },
        _sum: { debit: true, credit: true },
      });
      const debit = apSum._sum.debit ? Number(apSum._sum.debit) : 0;
      const credit = apSum._sum.credit ? Number(apSum._sum.credit) : 0;
      apBalance = credit - debit;
    }

    let advanceBalance = 0;
    if (advanceAccount) {
      const advSum = await prisma.financialLedger.aggregate({
        where: {
          accountId: advanceAccount.id,
          transaction: { reference: s.id },
        },
        _sum: { debit: true, credit: true },
      });
      const debit = advSum._sum.debit ? Number(advSum._sum.debit) : 0;
      const credit = advSum._sum.credit ? Number(advSum._sum.credit) : 0;
      advanceBalance = debit - credit;
    }

    ledger.push({
      id: s.id,
      name: s.name,
      totalLbs,
      totalBilled,
      totalPaid,
      balance: apBalance - advanceBalance,
    });
  }
  return ledger;
}

/**
 * Returns maker ledger WIP and payable metrics list.
 */
export async function getMakerLedger() {
  const makers = await prisma.entity.findMany({
    where: { type: 'MAKER' },
    orderBy: { name: 'asc' },
  });
  const ledger = [];
  const apAccount = await prisma.chartOfAccounts.findUnique({
    where: { code: '2100' },
  });

  const advanceAccount = await prisma.chartOfAccounts.findUnique({
    where: { code: '1300' },
  });

  for (const m of makers) {
    const recon = await getMakerReconciliation(m.id);

    // Bounded recent logs for per-maker shirt totals (master data stays small)
    const makerLogs = await prisma.activityLog.findMany({
      where: {
        actionType: 'GOODS_RECEIVED',
        description: { contains: m.name },
      },
      select: { description: true },
      orderBy: { timestamp: 'desc' },
      take: LIST_QUERY_CAP,
    });
    let totalShirts = 0;
    for (const log of makerLogs) {
      const match = log.description.match(/Received (\d+(?:\.\d+)*) shirts/i);
      if (match) {
        totalShirts += parseFloat(match[1]);
      }
    }

    // Dynamic total billed (credits to AP) calculation
    let totalBilled = 0;
    if (apAccount) {
      const billedSum = await prisma.financialLedger.aggregate({
        where: {
          accountId: apAccount.id,
          credit: { gt: 0 },
          transaction: { reference: m.id },
        },
        _sum: { credit: true },
      });
      totalBilled = billedSum._sum.credit ? Number(billedSum._sum.credit) : 0;
    }

    let totalPaid = 0;
    if (apAccount) {
      const paidSum = await prisma.financialLedger.aggregate({
        where: {
          accountId: apAccount.id,
          debit: { gt: 0 },
          transaction: {
            reference: m.id,
            description: { startsWith: 'Outbound Payment' },
          },
        },
        _sum: { debit: true },
      });
      totalPaid = paidSum._sum.debit ? Number(paidSum._sum.debit) : 0;
    }

    let apBalance = 0;
    if (apAccount) {
      const apSum = await prisma.financialLedger.aggregate({
        where: {
          accountId: apAccount.id,
          transaction: { reference: m.id },
        },
        _sum: { debit: true, credit: true },
      });
      const debit = apSum._sum.debit ? Number(apSum._sum.debit) : 0;
      const credit = apSum._sum.credit ? Number(apSum._sum.credit) : 0;
      apBalance = credit - debit;
    }

    let advanceBalance = 0;
    if (advanceAccount) {
      const advSum = await prisma.financialLedger.aggregate({
        where: {
          accountId: advanceAccount.id,
          transaction: { reference: m.id },
        },
        _sum: { debit: true, credit: true },
      });
      const debit = advSum._sum.debit ? Number(advSum._sum.debit) : 0;
      const credit = advSum._sum.credit ? Number(advSum._sum.credit) : 0;
      advanceBalance = debit - credit;
    }

    ledger.push({
      id: m.id,
      name: m.name,
      wipYarnLbs: recon.currentYarnInWipLbs,
      totalShirts,
      totalBilled,
      totalPaid,
      balance: apBalance - advanceBalance,
      wastagePercentage: recon.historicalWastagePercentage,
    });
  }
  return ledger;
}

/**
 * Returns customer ledger sales and AR outstanding balances list.
 */
export async function getCustomerLedger() {
  const companies = await prisma.entity.findMany({
    where: { type: 'COMPANY' },
    orderBy: { name: 'asc' },
  });
  const ledger = [];
  const arAccount = await prisma.chartOfAccounts.findUnique({
    where: { code: '1200' },
  });

  const advanceAccount = await prisma.chartOfAccounts.findUnique({
    where: { code: '2200' },
  });

  for (const c of companies) {
    const sales = await prisma.salesLine.aggregate({
      where: { salesInvoice: { customerId: c.id } },
      _sum: { quantity: true, totalPrice: true },
    });
    const totalShirts = sales._sum.quantity ? Number(sales._sum.quantity) : 0;
    const totalRevenue = sales._sum.totalPrice ? Number(sales._sum.totalPrice) : 0;

    let totalReceived = 0;
    if (arAccount) {
      const receivedSum = await prisma.financialLedger.aggregate({
        where: {
          accountId: arAccount.id,
          credit: { gt: 0 },
          transaction: {
            reference: c.id,
            description: { startsWith: 'Inbound Payment' },
          },
        },
        _sum: { credit: true },
      });
      totalReceived = receivedSum._sum.credit ? Number(receivedSum._sum.credit) : 0;
    }

    let arBalance = 0;
    if (arAccount) {
      const arSum = await prisma.financialLedger.aggregate({
        where: {
          accountId: arAccount.id,
          transaction: { reference: c.id },
        },
        _sum: { debit: true, credit: true },
      });
      const debit = arSum._sum.debit ? Number(arSum._sum.debit) : 0;
      const credit = arSum._sum.credit ? Number(arSum._sum.credit) : 0;
      arBalance = debit - credit;
    }

    let advanceBalance = 0;
    if (advanceAccount) {
      const advSum = await prisma.financialLedger.aggregate({
        where: {
          accountId: advanceAccount.id,
          transaction: { reference: c.id },
        },
        _sum: { debit: true, credit: true },
      });
      const debit = advSum._sum.debit ? Number(advSum._sum.debit) : 0;
      const credit = advSum._sum.credit ? Number(advSum._sum.credit) : 0;
      advanceBalance = credit - debit; // Liability is credit normal
    }

    ledger.push({
      id: c.id,
      name: c.name,
      totalShirts,
      totalRevenue,
      totalReceived,
      balance: arBalance - advanceBalance,
    });
  }
  return ledger;
}

/**
 * Computes business truth and owner capital efficiency valuations.
 */
export async function getOwnerTruth() {
  // 1. Calculate Average Yarn Cost
  const yarnPurchases = await prisma.purchaseLine.aggregate({
    _sum: { quantity: true, totalPrice: true },
  });
  const totalYarnQty = yarnPurchases._sum.quantity ? Number(yarnPurchases._sum.quantity) : 0;
  const totalYarnCost = yarnPurchases._sum.totalPrice ? Number(yarnPurchases._sum.totalPrice) : 0;
  const avgYarnCostPerLb = totalYarnQty > 0 ? totalYarnCost / totalYarnQty : 0;

  // 2. Calculate Average Making Cost per Shirt from inventory + ledger aggregates
  const shirtsDeliveredAgg = await prisma.inventoryLedger.aggregate({
    where: {
      item: { type: 'FINISHED_GOOD' },
      toLocation: { type: 'MAIN_WAREHOUSE' },
      fromLocationId: null,
    },
    _sum: { quantity: true },
  });
  const totalShirtsDelivered = shirtsDeliveredAgg._sum.quantity
    ? Number(shirtsDeliveredAgg._sum.quantity)
    : 0;

  const apAccountObj = await prisma.chartOfAccounts.findUnique({
    where: { code: '2100' },
  });
  let totalMakingCost = 0;
  if (apAccountObj) {
    const billingSum = await prisma.financialLedger.aggregate({
      where: {
        accountId: apAccountObj.id,
        credit: { gt: 0 },
      },
      _sum: { credit: true },
    });
    totalMakingCost = billingSum._sum.credit ? Number(billingSum._sum.credit) : 0;
  }
  const avgMakingCostPerShirt = totalShirtsDelivered > 0 ? totalMakingCost / totalShirtsDelivered : 0;

  // 3. Dynamic yield from inventory ledger (raw issued to makers vs shirts received)
  const rawConsumedAgg = await prisma.inventoryLedger.aggregate({
    where: {
      item: { type: 'RAW_MATERIAL' },
      fromLocation: { type: 'MAKER_WIP' },
      toLocationId: null,
    },
    _sum: { quantity: true },
  });
  const totalRawConsumed = rawConsumedAgg._sum.quantity
    ? Number(rawConsumedAgg._sum.quantity)
    : 0;

  const totalActualShirts = totalShirtsDelivered;
  const yieldPerLb = totalRawConsumed > 0 ? totalActualShirts / totalRawConsumed : 2.0;

  // Average cost of finished shirt = (avgYarnCostPerLb / yieldPerLb) + avgMakingCostPerShirt
  const avgFinishedShirtCost = (avgYarnCostPerLb / yieldPerLb) + avgMakingCostPerShirt;

  // 4. Get Current Physical Stocks in Main Warehouse
  const inv = await getInventoryPosition();
  let rawYarnStock = 0;
  for (const rm of inv.rawMaterials) {
    rawYarnStock += rm.balanceLbs;
  }
  let finishedShirtStock = 0;
  for (const fg of inv.finishedGoods) {
    finishedShirtStock += fg.balancePcs;
  }

  // Current inventory value = (rawYarnStock * avgYarnCostPerLb) + (finishedShirtStock * avgFinishedShirtCost)
  const moneyLockedInProduct = (rawYarnStock * avgYarnCostPerLb) + (finishedShirtStock * avgFinishedShirtCost);

  // 5. Total Debt (Sum of AP)
  const suppliers = await getSupplierLedger();
  const makers = await getMakerLedger();
  
  let supplierDebt = 0;
  const supplierDebtsList: { name: string; balance: number }[] = [];
  for (const s of suppliers) {
    supplierDebt += s.balance;
    if (s.balance !== 0) {
      supplierDebtsList.push({ name: s.name, balance: s.balance });
    }
  }

  let makerDebt = 0;
  const makerDebtsList: { name: string; balance: number }[] = [];
  for (const m of makers) {
    makerDebt += m.balance;
    if (m.balance !== 0) {
      makerDebtsList.push({ name: m.name, balance: m.balance });
    }
  }

  const totalDebt = supplierDebt + makerDebt;

  // 6. Total Owed (Sum of AR)
  const customers = await getCustomerLedger();
  let totalOwed = 0;
  const customerOwedList: { name: string; balance: number }[] = [];
  for (const c of customers) {
    totalOwed += c.balance;
    if (c.balance !== 0) {
      customerOwedList.push({ name: c.name, balance: c.balance });
    }
  }

  // 7. Cash Balance
  const macro = await getMacroOverview();

  // Net Business Value = Cash + Inventory Value + AR - AP
  const netBusinessValue = macro.cash + moneyLockedInProduct + totalOwed - totalDebt;

  return {
    cashOnHand: macro.cash,
    moneyLockedInProduct,
    lockedInYarn: rawYarnStock * avgYarnCostPerLb,
    lockedInShirts: finishedShirtStock * avgFinishedShirtCost,
    rawYarnStock,
    avgYarnCostPerLb,
    finishedShirtStock,
    avgFinishedShirtCost,
    totalDebt,
    supplierDebt,
    makerDebt,
    supplierDebts: supplierDebtsList,
    makerDebts: makerDebtsList,
    totalOwedToYou: totalOwed,
    customerOwed: customerOwedList,
    netBusinessValue,
  };
}
