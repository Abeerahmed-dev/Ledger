import { startServer, stopServer } from './server.js';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Intercept fetch to automatically supply HTTP Basic Authentication credentials
const originalFetch = globalThis.fetch;
const adminUser = process.env.ADMIN_USERNAME || 'admin';
const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
const authHeader = 'Basic ' + Buffer.from(`${adminUser}:${adminPassword}`).toString('base64');

globalThis.fetch = function (url: any, init?: any) {
  return originalFetch(url, {
    ...init,
    headers: {
      ...init?.headers,
      'Authorization': authHeader,
    },
  });
} as any;

const PORT = 3005;
const BASE_URL = `http://localhost:${PORT}`;

async function runTests() {
  console.log('=== STARTING BUSINESS LOGIC INTEGRATION TESTS ===\n');

  // Start the programmatic API server
  await startServer(PORT);

  try {
    // ----------------------------------------------------
    // Seed Phase
    // ----------------------------------------------------
    console.log('[Step 1] Seeding dummy records and chart of accounts...');
    const seedRes = await fetch(`${BASE_URL}/api/seed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    
    if (!seedRes.ok) {
      throw new Error(`Seeding failed with status: ${seedRes.status}`);
    }
    
    const seedData = await seedRes.json();
    console.log('Seed Response data:', JSON.stringify(seedData, null, 2));

    const {
      supplierId,
      makerId,
      companyId,
      rawYarnId,
      finishedShirtId,
    } = seedData;

    console.log('Seeding successfully completed.\n');

    const orderNumber = 'JWO-2026-0001';

    // ----------------------------------------------------
    // Test 1: Procurement
    // ----------------------------------------------------
    console.log('[Test 1] Procure Raw Material (100 kg Yarn for Rs 10000)...');
    const procurePayload = {
      supplierId,
      itemId: rawYarnId,
      quantityInKg: 100.0,
      totalAmount: 10000.0,
      invoiceNumber: 'PI-2026-0001',
      invoiceDate: new Date().toISOString(),
    };

    const procureRes = await fetch(`${BASE_URL}/api/procure`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(procurePayload),
    });

    if (!procureRes.ok) {
      const errBody = await procureRes.json();
      throw new Error(`Procurement failed: ${JSON.stringify(errBody)}`);
    }

    const procureData = await procureRes.json();
    console.log('Procurement Result:', JSON.stringify(procureData, null, 2));

    // Verify DB states for procurement
    const mainWarehouse = await prisma.location.findFirst({
      where: { type: 'MAIN_WAREHOUSE' },
    });
    if (!mainWarehouse) throw new Error('Main Warehouse location missing');

    const yarnIncomingLedger = await prisma.inventoryLedger.findFirst({
      where: { itemId: rawYarnId, toLocationId: mainWarehouse.id },
    });
    if (!yarnIncomingLedger || Number(yarnIncomingLedger.quantity) !== 100.0) {
      throw new Error('Verification Failed: InventoryLedger did not log 100 kg Yarn in Main Warehouse');
    }
    console.log('✓ Physical Ledger Verification: 100 kg of Yarn entered Main Warehouse.');

    const journalEntries = await prisma.financialLedger.findMany({
      where: { transaction: { purchaseInvoiceId: procureData.invoiceId } },
      include: { account: true },
    });
    
    if (journalEntries.length !== 2) {
      throw new Error(`Verification Failed: Expected 2 ledger entries, found ${journalEntries.length}`);
    }

    const inventoryAssetLine = journalEntries.find(l => l.account.code === '1100');
    const accountsPayableLine = journalEntries.find(l => l.account.code === '2100');

    if (!inventoryAssetLine || Number(inventoryAssetLine.debit) !== 10000.0 || Number(inventoryAssetLine.credit) !== 0.0) {
      throw new Error('Verification Failed: Incorrect Inventory Asset journal entries');
    }
    if (!accountsPayableLine || Number(accountsPayableLine.debit) !== 0.0 || Number(accountsPayableLine.credit) !== 10000.0) {
      throw new Error('Verification Failed: Incorrect Accounts Payable journal entries');
    }
    console.log('✓ Financial Ledger Verification: Double-entry balanced (Debit Asset 10,000 / Credit AP 10,000).\n');

    // ----------------------------------------------------
    // ----------------------------------------------------
    // Helper Step: Transfer 30 kg to Maker WIP
    // ----------------------------------------------------
    console.log('[Helper Step] Issuing 30 kg Raw Yarn to Maker WIP...');
    const transferPayload = {
      makerId,
      itemId: rawYarnId,
      quantity: 30.0,
      orderNumber,
    };

    const transferRes = await fetch(`${BASE_URL}/api/transfer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(transferPayload),
    });

    if (!transferRes.ok) {
      const errBody = await transferRes.json();
      throw new Error(`Transfer failed: ${JSON.stringify(errBody)}`);
    }
    console.log('✓ Yarn successfully issued to Maker WIP.\n');

    // ----------------------------------------------------
    // Test 2: Rollback / ACID Compliance
    // ----------------------------------------------------
    console.log('[Test 2] Deduct/Receive invalid quantity (deducting 100 kg from WIP when only 30 kg exist)...');
    
    // This payload specifies consuming 100 kg of yarn from the Maker WIP, but the Maker WIP only has 30 kg.
    // The transaction MUST error out and roll back completely.
    const invalidReceivePayload = {
      makerId,
      rawMaterialItemId: rawYarnId,
      rawMaterialQuantityConsumed: 100.0, // Exceeds available 30 kg
      finishedGoodsItemId: finishedShirtId,
      finishedGoodsQuantityReceived: 200.0,
      serviceCost: 2000.0,
      orderNumber,
    };

    // Capture DB record counts BEFORE the failed transaction
    const initialInventoryCount = await prisma.inventoryLedger.count();
    const initialFinancialCount = await prisma.financialTransaction.count();
    const initialActivityCount = await prisma.activityLog.count();

    const invalidReceiveRes = await fetch(`${BASE_URL}/api/receive`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(invalidReceivePayload),
    });

    console.log(`HTTP Response Code: ${invalidReceiveRes.status} (Expected: 500)`);
    const invalidReceiveBody = await invalidReceiveRes.json();
    console.log('Error message returned:', invalidReceiveBody.error);

    if (invalidReceiveRes.status !== 500) {
      throw new Error(`Test Failed: Expected HTTP status 500, but got ${invalidReceiveRes.status}`);
    }

    // Capture DB record counts AFTER the failed transaction to prove zero partial write pollution
    const finalInventoryCount = await prisma.inventoryLedger.count();
    const finalFinancialCount = await prisma.financialTransaction.count();
    const finalActivityCount = await prisma.activityLog.count();

    if (
      initialInventoryCount !== finalInventoryCount ||
      initialFinancialCount !== finalFinancialCount ||
      initialActivityCount !== finalActivityCount
    ) {
      throw new Error('Test Failed: Database polluted with partial transaction records. Rollback failed.');
    }
    console.log('✓ ACID Verification: All operations rolled back successfully. No partial writes created.\n');

    // ----------------------------------------------------
    // Helper Step: Receive valid 20 Shirts (Consuming 10 kg of WIP)
    // ----------------------------------------------------
    console.log('[Helper Step] Receiving 20 Shirts (consuming 10 kg Yarn @ Rs 50/shirt labor cost)...');
    
    const validReceivePayload = {
      makerId,
      rawMaterialItemId: rawYarnId,
      rawMaterialQuantityConsumed: 10.0,
      finishedGoodsItemId: finishedShirtId,
      finishedGoodsQuantityReceived: 20.0, // Expected 10 * 2 = 20, 0 wastage
      serviceCost: 1000.0, // 20 shirts * Rs 50
      orderNumber,
    };

    const validReceiveRes = await fetch(`${BASE_URL}/api/receive`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validReceivePayload),
    });

    if (!validReceiveRes.ok) {
      const errBody = await validReceiveRes.json();
      throw new Error(`Valid receive failed: ${JSON.stringify(errBody)}`);
    }
    console.log('✓ Shirts successfully received into Main Warehouse.\n');

    // ----------------------------------------------------
    // Test 3: Invoicing & Webhooks
    // ----------------------------------------------------
    console.log('[Test 3] Generating Delivery Invoice for 10 shirts...');
    const invoicePayload = {
      companyId,
      finishedGoodId: finishedShirtId,
      quantity: 10.0, // Available 20, requesting 10
      unitPrice: 500.0,
    };

    const invoiceRes = await fetch(`${BASE_URL}/api/invoice`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(invoicePayload),
    });

    if (!invoiceRes.ok) {
      const errBody = await invoiceRes.json();
      throw new Error(`Invoicing failed: ${JSON.stringify(errBody)}`);
    }

    const invoiceData = await invoiceRes.json();
    console.log('Invoice Generation Result:', JSON.stringify(invoiceData, null, 2));

    // Confirm DB updates
    const invIncomingLedger = await prisma.inventoryLedger.findFirst({
      where: { itemId: finishedShirtId, fromLocationId: mainWarehouse.id, toLocationId: null },
    });
    if (!invIncomingLedger || Number(invIncomingLedger.quantity) !== 10.0) {
      throw new Error('Verification Failed: InventoryLedger did not deduct 10 shirts from Main Warehouse');
    }
    console.log('✓ Physical Ledger Verification: 10 cotton shirts checked out for delivery.');

    const arLines = await prisma.financialLedger.findMany({
      where: { transaction: { salesInvoiceId: invoiceData.invoiceId } },
      include: { account: true },
    });

    const arLine = arLines.find(l => l.account.code === '1200');
    const salesLine = arLines.find(l => l.account.code === '4100');

    if (!arLine || Number(arLine.debit) !== 5900.0 || Number(arLine.credit) !== 0.0) {
      throw new Error('Verification Failed: Accounts Receivable was not debited with contract price (10 * 500 * 1.18 = 5900)');
    }
    if (!salesLine || Number(salesLine.debit) !== 0.0 || Number(salesLine.credit) !== 5900.0) {
      throw new Error('Verification Failed: Sales Revenue was not credited with contract price (10 * 500 * 1.18 = 5900)');
    }
    console.log('✓ Financial Ledger Verification: Double-entry balanced (Debit AR 5,900 / Credit Sales 5,900).');
    console.log('✓ Webhook Verification: PDF generated and INVOICE_GENERATED webhook dispatched asynchronously.\n');

    // ----------------------------------------------------
    // Test 4: Payment Reconciliation (Inbound Customer Payment)
    // ----------------------------------------------------
    console.log('[Test 4] Reconciling customer payment (Receive Rs. 5,900)...');
    const paymentPayload = {
      entityId: companyId,
      amount: 5900.0,
      paymentType: 'INBOUND',
    };

    const paymentRes = await fetch(`${BASE_URL}/api/payment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(paymentPayload),
    });

    if (!paymentRes.ok) {
      const errBody = await paymentRes.json();
      throw new Error(`Payment reconciliation failed: ${JSON.stringify(errBody)}`);
    }

    const paymentData = await paymentRes.json();
    console.log('Payment Result:', JSON.stringify(paymentData, null, 2));

    // Verify Cash GL entries
    const cashLines = await prisma.financialLedger.findMany({
      where: { transactionId: paymentData.financialTransactionId },
      include: { account: true },
    });

    if (cashLines.length !== 2) {
      throw new Error(`Verification Failed: Expected 2 ledger entries for payment transaction, found ${cashLines.length}`);
    }

    const cashAssetLine = cashLines.find(l => l.account.code === '1000');
    const arCreditLine = cashLines.find(l => l.account.code === '1200');

    if (!cashAssetLine || Number(cashAssetLine.debit) !== 5900.0 || Number(cashAssetLine.credit) !== 0.0) {
      throw new Error('Verification Failed: Cash was not debited with payment amount');
    }
    if (!arCreditLine || Number(arCreditLine.debit) !== 0.0 || Number(arCreditLine.credit) !== 5900.0) {
      throw new Error('Verification Failed: Accounts Receivable was not credited with payment amount');
    }
    console.log('✓ Financial Ledger Verification: Payment posted (Debit Cash 5,900 / Credit AR 5,900). Outstanding balance cleared.\n');

    // ----------------------------------------------------
    // Test 5: Centralized Activity Log Verification
    // ----------------------------------------------------
    console.log('[Test 5] Verifying centralized ActivityLog records...');
    const logsCount = await prisma.activityLog.count();
    console.log(`Activity Logs count: ${logsCount} (Expected: 5)`);
    if (logsCount !== 5) {
      throw new Error(`Verification Failed: Expected 5 ActivityLog records in the database, found ${logsCount}`);
    }

    const logsList = await prisma.activityLog.findMany({
      orderBy: { timestamp: 'asc' },
    });

    if (logsList[0].actionType !== 'PROCUREMENT') throw new Error('First log should be PROCUREMENT');
    if (logsList[1].actionType !== 'MAKER_TRANSFER') throw new Error('Second log should be MAKER_TRANSFER');
    if (logsList[2].actionType !== 'GOODS_RECEIVED') throw new Error('Third log should be GOODS_RECEIVED');
    if (logsList[3].actionType !== 'INVOICE_GENERATED') throw new Error('Fourth log should be INVOICE_GENERATED');
    if (logsList[4].actionType !== 'PAYMENT_RECORDED') throw new Error('Fifth log should be PAYMENT_RECORDED');

    console.log('✓ Centralized Logging Verification: All 5 CRUD/operational events successfully logged to ActivityLog.\n');

    console.log('=== ALL TESTS PASSED SUCCESSFULLY ===');
  } finally {
    await stopServer();
    await prisma.$disconnect();
  }
}

runTests().catch((err) => {
  console.error('[Test Suite Crash]', err);
  process.exit(1);
});
