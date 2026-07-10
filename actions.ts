import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { fireWebhook } from './webhooks';
import { generateInvoicePdfBuffer } from './invoicePdf';
import { prisma, basePrisma, PRISMA_TRANSACTION_OPTIONS } from './db';

// ==========================================
// Zod Validation Schemas
// ==========================================

const ProcureRawMaterialSchema = z.object({
  supplierId: z.string().uuid(),
  itemId: z.string().uuid(),
  quantityInKg: z.number().positive("Quantity must be a positive number"),
  totalAmount: z.number().positive("Total amount must be a positive number"),
  invoiceNumber: z.string().min(1, "Invoice number is required"),
  invoiceDate: z.coerce.date(),
});

const TransferToMakerSchema = z.object({
  makerId: z.string().uuid(),
  itemId: z.string().uuid(),
  quantity: z.number().positive("Quantity must be a positive number"),
  orderNumber: z.string().optional().nullable(),
});

const ReceiveFinishedGoodsSchema = z.object({
  makerId: z.string().uuid(),
  rawMaterialItemId: z.string().uuid(),
  rawMaterialQuantityConsumed: z.number().positive("Raw material quantity consumed must be positive"),
  finishedGoodsItemId: z.string().uuid(),
  finishedGoodsQuantityReceived: z.number().positive("Finished goods quantity received must be positive"),
  serviceCost: z.number().nonnegative("Service cost/fee cannot be negative"),
  orderNumber: z.string().optional().nullable(),
});

const GenerateDeliveryInvoiceSchema = z.object({
  companyId: z.string().uuid(),
  finishedGoodId: z.string().uuid(),
  quantity: z.number().positive("Quantity must be a positive number"),
  unitPrice: z.number().positive("Unit price must be a positive number"),
  poNumber: z.string().optional().nullable(),
  jobNumber: z.string().optional().nullable(),
  paymentTerms: z.string().optional().nullable(),
  shippingMethod: z.string().optional().nullable(),
});

// ==========================================
// Transaction Actions
// ==========================================

/**
 * Action 1: Procure Raw Material (Yarn in lbs)
 * Adds yarn to the Inventory Ledger (Main Warehouse),
 * debits Inventory Asset, and credits Accounts Payable (Supplier).
 */
export async function procureRawMaterial(input: unknown) {
  const validated = ProcureRawMaterialSchema.parse(input);
  const totalPrice = validated.totalAmount;
  const unitPrice = validated.totalAmount / validated.quantityInKg;

  return await basePrisma.$transaction(async (tx) => {
    // 1. Verify supplier entity exists and is correct type
    const supplier = await tx.entity.findUnique({
      where: { id: validated.supplierId },
    });
    if (!supplier || supplier.type !== 'SUPPLIER') {
      throw new Error(`Supplier with ID ${validated.supplierId} not found or is not of type SUPPLIER.`);
    }

    // 2. Verify item exists and is correct type
    const item = await tx.inventoryItem.findUnique({
      where: { id: validated.itemId },
    });
    if (!item || item.type !== 'RAW_MATERIAL') {
      throw new Error(`Item with ID ${validated.itemId} not found or is not of type RAW_MATERIAL.`);
    }

    // 3. Find or create MAIN_WAREHOUSE location
    let mainWarehouse = await tx.location.findFirst({
      where: { type: 'MAIN_WAREHOUSE' },
    });
    if (!mainWarehouse) {
      mainWarehouse = await tx.location.create({
        data: {
          name: 'Main Warehouse',
          type: 'MAIN_WAREHOUSE',
        },
      });
    }

    // 4. Find GL accounts
    const inventoryAssetAccount = await tx.chartOfAccounts.findUnique({
      where: { code: '1100' },
    });
    if (!inventoryAssetAccount) {
      throw new Error("Chart of Accounts missing 'Inventory Asset' (code '1100'). Please seed accounts first.");
    }
    const accountsPayableAccount = await tx.chartOfAccounts.findUnique({
      where: { code: '2100' },
    });
    if (!accountsPayableAccount) {
      throw new Error("Chart of Accounts missing 'Accounts Payable' (code '2100'). Please seed accounts first.");
    }

    // 5. Create Purchase Invoice and Line
    const invoice = await tx.purchaseInvoice.create({
      data: {
        invoiceNumber: validated.invoiceNumber,
        supplierId: validated.supplierId,
        invoiceDate: validated.invoiceDate,
        lines: {
          create: {
            itemId: validated.itemId,
            quantity: validated.quantityInKg,
            unitPrice: unitPrice,
            totalPrice: totalPrice,
          },
        },
      },
      include: {
        lines: true,
      },
    });

    const purchaseLine = invoice.lines[0];

    // 6. Record physical movement to InventoryLedger
    await tx.inventoryLedger.create({
      data: {
        itemId: validated.itemId,
        fromLocationId: null, // Sourced externally
        toLocationId: mainWarehouse.id,
        quantity: validated.quantityInKg,
        purchaseLineId: purchaseLine.id,
      },
    });

    // 7. Record financial double-entry transaction
    const finTx = await tx.financialTransaction.create({
      data: {
        description: `Procure Yarn - Supplier Invoice ${validated.invoiceNumber}`,
        reference: invoice.id,
        purchaseInvoiceId: invoice.id,
        lines: {
          create: [
            {
              accountId: inventoryAssetAccount.id,
              debit: totalPrice,
              credit: 0,
            },
            {
              accountId: accountsPayableAccount.id,
              debit: 0,
              credit: totalPrice,
            },
          ],
        },
      },
    });

    // 8. Log activity
    await tx.activityLog.create({
      data: {
        actionType: 'PROCUREMENT',
        description: 'Purchased ' + (validated.quantityInKg / 45.34) + ' sacks (' + validated.quantityInKg + ' kg) for Rs. ' + totalPrice,
      },
    });

    return {
      invoiceId: invoice.id,
      financialTransactionId: finTx.id,
    };
  }, PRISMA_TRANSACTION_OPTIONS);
}

/**
 * Action 2: Transfer Raw Material to Maker
 * Transfers yarn from the Main Warehouse to a Maker's Work-in-Progress (WIP) storage location.
 * No financial journal entry is recorded.
 */
export async function transferToMaker(input: unknown) {
  const validated = TransferToMakerSchema.parse(input);

  return await basePrisma.$transaction(async (tx) => {
    // 1. Verify maker entity exists and is correct type
    const maker = await tx.entity.findUnique({
      where: { id: validated.makerId },
    });
    if (!maker || maker.type !== 'MAKER') {
      throw new Error(`Maker with ID ${validated.makerId} not found or is not of type MAKER.`);
    }

    // 2. Verify item exists and is correct type
    const item = await tx.inventoryItem.findUnique({
      where: { id: validated.itemId },
    });
    if (!item || item.type !== 'RAW_MATERIAL') {
      throw new Error(`Item with ID ${validated.itemId} not found or is not of type RAW_MATERIAL.`);
    }

    // 3. Find or create Locations
    let mainWarehouse = await tx.location.findFirst({
      where: { type: 'MAIN_WAREHOUSE' },
    });
    if (!mainWarehouse) {
      mainWarehouse = await tx.location.create({
        data: {
          name: 'Main Warehouse',
          type: 'MAIN_WAREHOUSE',
        },
      });
    }

    let makerWip = await tx.location.findUnique({
      where: {
        type_entityId: {
          type: 'MAKER_WIP',
          entityId: validated.makerId,
        },
      },
    });
    if (!makerWip) {
      makerWip = await tx.location.create({
        data: {
          name: `Maker WIP - ${maker.name}`,
          type: 'MAKER_WIP',
          entityId: validated.makerId,
        },
      });
    }

    // 4. Verify Main Warehouse has enough stock of raw material (Yarn)
    const incomingSum = await tx.inventoryLedger.aggregate({
      where: {
        itemId: validated.itemId,
        toLocationId: mainWarehouse.id,
      },
      _sum: {
        quantity: true,
      },
    });

    const outgoingSum = await tx.inventoryLedger.aggregate({
      where: {
        itemId: validated.itemId,
        fromLocationId: mainWarehouse.id,
      },
      _sum: {
        quantity: true,
      },
    });

    const incoming = incomingSum._sum.quantity ? Number(incomingSum._sum.quantity) : 0;
    const outgoing = outgoingSum._sum.quantity ? Number(outgoingSum._sum.quantity) : 0;
    const currentStock = incoming - outgoing;

    if (currentStock < validated.quantity) {
      throw new Error(
        `Insufficient stock in Main Warehouse for raw material ${validated.itemId}. ` +
        `Available: ${currentStock} lbs, Requested: ${validated.quantity} lbs.`
      );
    }

    // 5. Record physical movement to InventoryLedger
    const ledgerEntry = await tx.inventoryLedger.create({
      data: {
        itemId: validated.itemId,
        fromLocationId: mainWarehouse.id,
        toLocationId: makerWip.id,
        quantity: validated.quantity,
      },
    });

    // 6. Log activity
    await tx.activityLog.create({
      data: {
        actionType: 'MAKER_TRANSFER',
        description: `Issued ${validated.quantity} lbs of ${item.name} to Maker ${maker.name} (Order: ${validated.orderNumber || 'N/A'})`,
        orderNumber: validated.orderNumber || null,
      },
    });

    return {
      issueLineId: ledgerEntry.id,
    };
  }, PRISMA_TRANSACTION_OPTIONS);
}

/**
 * Action 3: Receive Finished Goods from Maker
 * Deducts yarn from Maker WIP, adds shirts to Main Warehouse,
 * and records making labor costs: Debits COGS - Labor, credits Accounts Payable (Maker).
 */
export async function receiveFinishedGoods(input: unknown) {
  const validated = ReceiveFinishedGoodsSchema.parse(input);

  // 1. Verify maker entity exists and is correct type
  const maker = await basePrisma.entity.findUnique({
    where: { id: validated.makerId },
  });
  if (!maker || maker.type !== 'MAKER') {
    throw new Error(`Maker with ID ${validated.makerId} not found or is not of type MAKER.`);
  }

  // 2. Verify Item types
  const rawMaterialItem = await basePrisma.inventoryItem.findUnique({
    where: { id: validated.rawMaterialItemId },
  });
  if (!rawMaterialItem || rawMaterialItem.type !== 'RAW_MATERIAL') {
    throw new Error(`Raw material item with ID ${validated.rawMaterialItemId} not found or is not of type RAW_MATERIAL.`);
  }

  const finishedGoodsItem = await basePrisma.inventoryItem.findUnique({
    where: { id: validated.finishedGoodsItemId },
  });
  if (!finishedGoodsItem || finishedGoodsItem.type !== 'FINISHED_GOOD') {
    throw new Error(`Finished goods item with ID ${validated.finishedGoodsItemId} not found or is not of type FINISHED_GOOD.`);
  }

  // 3. Retrieve Locations
  let mainWarehouse = await basePrisma.location.findFirst({
    where: { type: 'MAIN_WAREHOUSE' },
  });

  let makerWip = await basePrisma.location.findUnique({
    where: {
      type_entityId: {
        type: 'MAKER_WIP',
        entityId: validated.makerId,
      },
    },
  });

  // 4. Verify Maker WIP has enough stock of the raw material (Yarn)
  let currentWipStock = 0;
  if (makerWip) {
    const incomingWipSum = await basePrisma.inventoryLedger.aggregate({
      where: {
        itemId: validated.rawMaterialItemId,
        toLocationId: makerWip.id,
      },
      _sum: {
        quantity: true,
      },
    });

    const outgoingWipSum = await basePrisma.inventoryLedger.aggregate({
      where: {
        itemId: validated.rawMaterialItemId,
        fromLocationId: makerWip.id,
      },
      _sum: {
        quantity: true,
      },
    });

    const incomingWip = incomingWipSum._sum.quantity ? Number(incomingWipSum._sum.quantity) : 0;
    const outgoingWip = outgoingWipSum._sum.quantity ? Number(outgoingWipSum._sum.quantity) : 0;
    currentWipStock = incomingWip - outgoingWip;
  }

  if (currentWipStock < validated.rawMaterialQuantityConsumed) {
    throw new Error(
      `Insufficient stock in Maker WIP for raw material. ` +
      `Available: ${currentWipStock} kg, Requested to consume: ${validated.rawMaterialQuantityConsumed} kg. ` +
      `Please transfer/issue raw yarn to the Maker first.`
    );
  }

  // 5. Find GL accounts
  const cogsLaborAccount = await basePrisma.chartOfAccounts.findUnique({
    where: { code: '5100' },
  });
  if (!cogsLaborAccount) {
    throw new Error("Chart of Accounts missing 'COGS - Labor' (code '5100'). Please seed accounts first.");
  }
  const accountsPayableAccount = await basePrisma.chartOfAccounts.findUnique({
    where: { code: '2100' },
  });
  if (!accountsPayableAccount) {
    throw new Error("Chart of Accounts missing 'Accounts Payable' (code '2100'). Please seed accounts first.");
  }

  const receiptResult = await basePrisma.$transaction(async (tx) => {
    // Re-verify/create locations inside transaction to ensure safety
    let txMainWarehouse = mainWarehouse;
    if (!txMainWarehouse) {
      txMainWarehouse = await tx.location.create({
        data: {
          name: 'Main Warehouse',
          type: 'MAIN_WAREHOUSE',
        },
      });
    }

    let txMakerWip = makerWip;
    if (!txMakerWip) {
      txMakerWip = await tx.location.create({
        data: {
          name: `Maker WIP - ${maker.name}`,
          type: 'MAKER_WIP',
          entityId: validated.makerId,
        },
      });
    }

    // 6. Record physical movements to InventoryLedger
    // Consumption of raw Yarn from WIP
    const rawLedger = await tx.inventoryLedger.create({
      data: {
        itemId: validated.rawMaterialItemId,
        fromLocationId: txMakerWip.id,
        toLocationId: null, // Consumed
        quantity: validated.rawMaterialQuantityConsumed,
      },
    });

    // Receipt of finished Shirts into Main Warehouse
    await tx.inventoryLedger.create({
      data: {
        itemId: validated.finishedGoodsItemId,
        fromLocationId: null, // Produced
        toLocationId: txMainWarehouse.id,
        quantity: validated.finishedGoodsQuantityReceived,
      },
    });

    // 7. Record financial double-entry transaction
    const finTx = await tx.financialTransaction.create({
      data: {
        description: `Receive Finished Shirts - Order ${validated.orderNumber || 'N/A'}`,
        reference: validated.makerId,
        lines: {
          create: [
            {
              accountId: cogsLaborAccount.id,
              debit: validated.serviceCost,
              credit: 0,
              orderNumber: validated.orderNumber || null,
            },
            {
              accountId: accountsPayableAccount.id,
              debit: 0,
              credit: validated.serviceCost,
              orderNumber: validated.orderNumber || null,
            },
          ],
        },
      },
    });

    // 8. Log activity
    await tx.activityLog.create({
      data: {
        actionType: 'GOODS_RECEIVED',
        description: `Received ${validated.finishedGoodsQuantityReceived} shirts from ${maker.name} (Order: ${validated.orderNumber || 'N/A'})`,
        orderNumber: validated.orderNumber || null,
      },
    });

    return {
      receiptLineId: rawLedger.id,
      actualQuantity: validated.finishedGoodsQuantityReceived,
      financialTransactionId: finTx.id,
      makerName: maker.name,
    };
  }, PRISMA_TRANSACTION_OPTIONS);

  return {
    receiptLineId: receiptResult.receiptLineId,
    actualQuantity: receiptResult.actualQuantity,
    financialTransactionId: receiptResult.financialTransactionId,
  };
}

/**
 * Action 4: Generate Delivery Invoice (Sales)
 * Queries agreed selling price for customer (Company) and finished good,
 * creates a Sales Invoice, deducts finished goods from Main Warehouse,
 * and records: Debits Accounts Receivable (1200), Credits Sales Revenue (4100).
 */
export async function generateDeliveryInvoice(input: unknown) {
  const validated = GenerateDeliveryInvoiceSchema.parse(input);

  const invoiceResult = await basePrisma.$transaction(async (tx) => {
    // 1. Verify company entity exists and is correct type
    const company = await tx.entity.findUnique({
      where: { id: validated.companyId },
    });
    if (!company || company.type !== 'COMPANY') {
      throw new Error(`Customer/Company with ID ${validated.companyId} not found or is not of type COMPANY.`);
    }

    // 2. Verify finishedGood exists and is correct type
    const item = await tx.inventoryItem.findUnique({
      where: { id: validated.finishedGoodId },
    });
    if (!item || item.type !== 'FINISHED_GOOD') {
      throw new Error(`Finished good item with ID ${validated.finishedGoodId} not found or is not of type FINISHED_GOOD.`);
    }

    // 3. Pricing calculations: GST 18% inclusive
    const unitPrice = validated.unitPrice;
    const subtotal = validated.quantity * unitPrice;
    const gst = subtotal * 0.18;
    const totalPrice = subtotal + gst;

    // 4. Find or create MAIN_WAREHOUSE location
    let mainWarehouse = await tx.location.findFirst({
      where: { type: 'MAIN_WAREHOUSE' },
    });
    if (!mainWarehouse) {
      mainWarehouse = await tx.location.create({
        data: {
          name: 'Main Warehouse',
          type: 'MAIN_WAREHOUSE',
        },
      });
    }

    // 5. Verify Main Warehouse has enough stock of the finished good (Shirts)
    const incomingSum = await tx.inventoryLedger.aggregate({
      where: {
        itemId: validated.finishedGoodId,
        toLocationId: mainWarehouse.id,
      },
      _sum: {
        quantity: true,
      },
    });

    const outgoingSum = await tx.inventoryLedger.aggregate({
      where: {
        itemId: validated.finishedGoodId,
        fromLocationId: mainWarehouse.id,
      },
      _sum: {
        quantity: true,
      },
    });

    const incoming = incomingSum._sum.quantity ? Number(incomingSum._sum.quantity) : 0;
    const outgoing = outgoingSum._sum.quantity ? Number(outgoingSum._sum.quantity) : 0;
    const currentStock = incoming - outgoing;

    if (currentStock < validated.quantity) {
      throw new Error(
        `Insufficient stock in Main Warehouse for finished good ${item.name}. ` +
        `Available: ${currentStock} pcs, Requested: ${validated.quantity} pcs.`
      );
    }

    // 6. Find GL accounts: Accounts Receivable (1200) and Sales Revenue (4100)
    const accountsReceivableAccount = await tx.chartOfAccounts.findUnique({
      where: { code: '1200' },
    });
    if (!accountsReceivableAccount) {
      throw new Error("Chart of Accounts missing 'Accounts Receivable' (code '1200'). Please seed accounts first.");
    }

    const salesRevenueAccount = await tx.chartOfAccounts.findUnique({
      where: { code: '4100' },
    });
    if (!salesRevenueAccount) {
      throw new Error("Chart of Accounts missing 'Sales Revenue' (code '4100'). Please seed accounts first.");
    }

    // 7. Generate a unique Invoice Number
    const timestamp = Date.now();
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const invoiceNumber = `INV-${timestamp}-${randomSuffix}`;

    // 8. Create SalesInvoice and SalesLine records with poNumber, jobNumber, paymentTerms, shippingMethod
    const invoice = await tx.salesInvoice.create({
      data: {
        invoiceNumber: invoiceNumber,
        customerId: validated.companyId,
        invoiceDate: new Date(),
        poNumber: validated.poNumber || null,
        jobNumber: validated.jobNumber || null,
        paymentTerms: validated.paymentTerms || null,
        shippingMethod: validated.shippingMethod || null,
        lines: {
          create: {
            itemId: validated.finishedGoodId,
            quantity: validated.quantity,
            unitPrice: unitPrice,
            totalPrice: totalPrice,
          },
        },
      },
      include: {
        lines: true,
      },
    });

    const salesLine = invoice.lines[0];

    // 9. Record physical shipment in InventoryLedger (Main Warehouse -> null/Delivered)
    await tx.inventoryLedger.create({
      data: {
        itemId: validated.finishedGoodId,
        fromLocationId: mainWarehouse.id,
        toLocationId: null, // Delivered out of ERP inventory system
        quantity: validated.quantity,
        salesLineId: salesLine.id,
      },
    });

    // 10. Record financial double-entry transaction using GST-inclusive total
    const finTx = await tx.financialTransaction.create({
      data: {
        description: `Ship Finished Goods - Invoice ${invoiceNumber}`,
        reference: invoice.id,
        salesInvoiceId: invoice.id,
        lines: {
          create: [
            {
              accountId: accountsReceivableAccount.id,
              debit: totalPrice,
              credit: 0,
              orderNumber: validated.jobNumber || null,
            },
            {
              accountId: salesRevenueAccount.id,
              debit: 0,
              credit: totalPrice,
              orderNumber: validated.jobNumber || null,
            },
          ],
        },
      },
    });

    // 11. Log activity
    await tx.activityLog.create({
      data: {
        actionType: 'INVOICE_GENERATED',
        description: `Generated Invoice #${invoiceNumber} for Customer ${company.name}: Delivered ${validated.quantity} pcs of ${item.name} @ Rs. ${unitPrice}/pc (Total: Rs. ${totalPrice.toLocaleString()})`,
        orderNumber: validated.jobNumber || null,
      },
    });

    return {
      invoiceId: invoice.id,
      invoiceNumber: invoiceNumber,
      invoiceDate: invoice.invoiceDate.toISOString(),
      companyName: company.name,
      companyAddress: company.address || '',
      companyPhone: company.phone || '',
      companyEmail: company.email || '',
      ntnNumber: company.ntnNumber || '',
      strnNumber: company.strnNumber || '',
      poNumber: invoice.poNumber || '',
      jobNumber: invoice.jobNumber || '',
      paymentTerms: invoice.paymentTerms || '',
      shippingMethod: invoice.shippingMethod || '',
      itemName: item.name,
      itemSku: item.sku,
      unit: item.unit,
      quantity: validated.quantity,
      unitPrice: unitPrice,
      subtotal: subtotal,
      gst: gst,
      totalPrice: totalPrice,
      financialTransactionId: finTx.id,
    };
  }, PRISMA_TRANSACTION_OPTIONS);

  let pdfBase64 = '';
  try {
    const pdfBuffer = await generateInvoicePdfBuffer(invoiceResult);
    pdfBase64 = pdfBuffer.toString('base64');
    
    // Dispatch webhook asynchronously
    fireWebhook('INVOICE_GENERATED', {
      invoiceNumber: invoiceResult.invoiceNumber,
      companyName: invoiceResult.companyName,
      pdfBase64: pdfBase64,
    }).catch((err) => {
      console.error('Failed to dispatch INVOICE_GENERATED webhook:', err);
    });
  } catch (err) {
    console.error('Failed to generate PDF buffer:', err);
  }

  return {
    ...invoiceResult,
    pdfBase64,
  };
}

/**
 * Action 5: Reverse Transaction
 * Queries the original transaction, swaps the Debits and Credits,
 * swaps the inventory directions, and logs a distinct correction transaction.
 */
export async function reverseTransaction(originalTransactionId: string) {
  const originalTxId = z.string().uuid().parse(originalTransactionId);

  return await basePrisma.$transaction(async (tx) => {
    // 1. Fetch original transaction details
    const originalTx = await tx.financialTransaction.findUnique({
      where: { id: originalTxId },
      include: {
        lines: true,
      },
    });

    if (!originalTx) {
      throw new Error(`Original transaction with ID ${originalTxId} not found.`);
    }

    // Check if this transaction is already a reversal
    if (originalTx.description.startsWith('REVERSAL OF:')) {
      throw new Error(`Transaction with ID ${originalTxId} is already a reversal transaction.`);
    }

    // Prevent duplicate reversals
    const existingReversal = await tx.financialTransaction.findFirst({
      where: {
        description: {
          startsWith: `REVERSAL OF: ${originalTx.id}`,
        },
      },
    });
    if (existingReversal) {
      throw new Error(`Transaction with ID ${originalTxId} has already been reversed by Transaction ${existingReversal.id}.`);
    }

    // 2. Fetch all inventory ledger entries linked to this transaction's document anchors
    const docFilters: Prisma.InventoryLedgerWhereInput[] = [];
    if (originalTx.purchaseInvoiceId) {
      docFilters.push({ purchaseLine: { purchaseInvoiceId: originalTx.purchaseInvoiceId } });
    }
    if (originalTx.salesInvoiceId) {
      docFilters.push({ salesLine: { salesInvoiceId: originalTx.salesInvoiceId } });
    }

    let inventoryEntries: any[] = [];
    if (docFilters.length > 0) {
      inventoryEntries = await tx.inventoryLedger.findMany({
        where: {
          OR: docFilters,
        },
      });
    }

    // 3. Create a new correction FinancialTransaction
    const correctionTx = await tx.financialTransaction.create({
      data: {
        description: `REVERSAL OF: ${originalTx.id} - ${originalTx.description}`,
        reference: originalTx.id,
        purchaseInvoiceId: originalTx.purchaseInvoiceId,
        salesInvoiceId: originalTx.salesInvoiceId,
        lines: {
          create: originalTx.lines.map((line) => ({
            accountId: line.accountId,
            // Swap debit and credit to reverse the financial balance
            debit: line.credit,
            credit: line.debit,
          })),
        },
      },
      include: {
        lines: true,
      },
    });

    // 4. Create inverse physical movement entries in InventoryLedger
    for (const entry of inventoryEntries) {
      await tx.inventoryLedger.create({
        data: {
          itemId: entry.itemId,
          // Swap locations to reverse physical direction
          fromLocationId: entry.toLocationId,
          toLocationId: entry.fromLocationId,
          quantity: entry.quantity,
          purchaseLineId: entry.purchaseLineId,
          jobWorkIssueLineId: entry.jobWorkIssueLineId,
          jobWorkReceiptLineId: entry.jobWorkReceiptLineId,
          salesLineId: entry.salesLineId,
        },
      });
    }

    return {
      correctionTransactionId: correctionTx.id,
      reversedLinesCount: originalTx.lines.length,
      reversedInventoryCount: inventoryEntries.length,
    };
  }, PRISMA_TRANSACTION_OPTIONS);
}

// ==========================================
// Zod Schema for Payment Validation
// ==========================================

export const RecordPaymentSchema = z.object({
  entityId: z.string().uuid("Invalid entity ID format."),
  amount: z.number().positive("Payment amount must be greater than zero."),
  paymentType: z.enum(['INBOUND', 'OUTBOUND']),
});

/**
 * Action 6: Record Payment (Cash Reconciliation)
 * If OUTBOUND: Credit Cash (1000), Debit AP (2100)
 * If INBOUND: Debit Cash (1000), Credit AR (1200)
 */
export async function recordPayment(input: unknown) {
  const validated = RecordPaymentSchema.parse(input);

  return await basePrisma.$transaction(async (tx) => {
    // 1. Verify entity exists. Note: Payments are allowed even if the current entity's
    // outstanding balance is 0, or if the payment amount exceeds the current balance,
    // which naturally results in negative ledger balances (advances).
    const entity = await tx.entity.findUnique({
      where: { id: validated.entityId },
    });
    if (!entity) {
      throw new Error(`Entity with ID ${validated.entityId} not found.`);
    }

    // 2. Retrieve GL Accounts
    const cashAccount = await tx.chartOfAccounts.findUnique({
      where: { code: '1000' },
    });
    if (!cashAccount) {
      throw new Error("Chart of Accounts missing 'Cash' (code '1000'). Please seed accounts first.");
    }

    const offsetCode = validated.paymentType === 'OUTBOUND' ? '2100' : '1200';
    const offsetAccount = await tx.chartOfAccounts.findUnique({
      where: { code: offsetCode },
    });
    if (!offsetAccount) {
      throw new Error(`Chart of Accounts missing offset account code '${offsetCode}'. Please seed accounts first.`);
    }

    // 3. Create double-entry bookkeeping journal entries
    const description = validated.paymentType === 'OUTBOUND'
      ? `Outbound Payment to ${entity.name} (${entity.type})`
      : `Inbound Payment from ${entity.name} (${entity.type})`;

    const finTx = await tx.financialTransaction.create({
      data: {
        description,
        reference: entity.id,
        lines: {
          create: [
            {
              accountId: cashAccount.id,
              debit: validated.paymentType === 'INBOUND' ? validated.amount : 0,
              credit: validated.paymentType === 'OUTBOUND' ? validated.amount : 0,
            },
            {
              accountId: offsetAccount.id,
              debit: validated.paymentType === 'OUTBOUND' ? validated.amount : 0,
              credit: validated.paymentType === 'INBOUND' ? validated.amount : 0,
            },
          ],
        },
      },
    });

    // 4. Log activity
    await tx.activityLog.create({
      data: {
        actionType: 'PAYMENT_RECORDED',
        description: `Recorded ${validated.paymentType} payment of Rs. ${validated.amount.toLocaleString()} ${validated.paymentType === 'OUTBOUND' ? 'to' : 'from'} Partner ${entity.name} (${entity.type})`,
      },
    });

    return {
      financialTransactionId: finTx.id,
      entityId: entity.id,
      entityName: entity.name,
      amount: validated.amount,
      paymentType: validated.paymentType,
    };
  }, PRISMA_TRANSACTION_OPTIONS);
}

// ==========================================
// settings CRUD Actions
// ==========================================

export const CreateEntitySchema = z.object({
  name: z.string().min(1, "Name is required."),
  type: z.enum(['COMPANY', 'SUPPLIER', 'MAKER']),
  ntnNumber: z.string().optional().nullable(),
  strnNumber: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
});

export const CreateInventoryItemSchema = z.object({
  sku: z.string().min(1, "SKU is required."),
  name: z.string().min(1, "Name is required."),
  type: z.enum(['RAW_MATERIAL', 'FINISHED_GOOD']),
  unit: z.enum(['LBS', 'PCS']),
});

export async function createEntity(input: unknown) {
  const validated = CreateEntitySchema.parse(input);
  return await basePrisma.entity.create({
    data: {
      name: validated.name,
      type: validated.type,
      ntnNumber: validated.ntnNumber || null,
      strnNumber: validated.strnNumber || null,
      address: validated.address || null,
    },
  });
}

export async function createInventoryItem(input: unknown) {
  const validated = CreateInventoryItemSchema.parse(input);
  return await basePrisma.inventoryItem.create({
    data: {
      sku: validated.sku,
      name: validated.name,
      type: validated.type,
      unit: validated.unit,
    },
  });
}



