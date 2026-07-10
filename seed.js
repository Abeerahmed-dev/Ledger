import { PrismaClient } from '@prisma/client';

const seedPrisma = new PrismaClient();

async function main() {
  console.log('--- Reseting database tables ---');
  await seedPrisma.wastageLog.deleteMany();
  await seedPrisma.financialLedger.deleteMany();
  await seedPrisma.financialTransaction.deleteMany();
  await seedPrisma.inventoryLedger.deleteMany();
  await seedPrisma.purchaseLine.deleteMany();
  await seedPrisma.purchaseInvoice.deleteMany();
  await seedPrisma.jobWorkIssueLine.deleteMany();
  await seedPrisma.jobWorkReceiptLine.deleteMany();
  await seedPrisma.jobWorkOrder.deleteMany();
  await seedPrisma.salesLine.deleteMany();
  await seedPrisma.salesInvoice.deleteMany();
  await seedPrisma.activityLog.deleteMany();
  await seedPrisma.location.deleteMany();
  await seedPrisma.inventoryItem.deleteMany();
  await seedPrisma.entity.deleteMany();
  await seedPrisma.chartOfAccounts.deleteMany();

  const accounts = [
    { code: '1000', name: 'Cash on Hand', type: 'ASSET' },
    { code: '1100', name: 'Inventory Asset', type: 'ASSET' },
    { code: '1200', name: 'Accounts Receivable', type: 'ASSET' },
    { code: '2100', name: 'Accounts Payable', type: 'LIABILITY' },
    { code: '4100', name: 'Sales Revenue', type: 'REVENUE' },
    { code: '5100', name: 'COGS - Labor', type: 'EXPENSE' },
    { code: '5200', name: 'Factory Expenses', type: 'EXPENSE' },
  ];
  for (const acc of accounts) {
    await seedPrisma.chartOfAccounts.create({ data: acc });
  }

  console.log('--- Seeding Entities (Supplier, Maker, Company) ---');
  const supplier = await seedPrisma.entity.create({ data: { name: 'Karachi Thread Supplier Ltd', type: 'SUPPLIER' } });
  const maker = await seedPrisma.entity.create({ data: { name: 'Master Stitchers Maker A', type: 'MAKER' } });
  const company = await seedPrisma.entity.create({
    data: {
      name: 'Karachi Apparel Export Company',
      type: 'COMPANY',
      address: 'Plot 45, Korangi Industrial Area, Karachi',
      email: 'billing@karachiapparel.com',
      phone: '+92-21-35550199',
    },
  });

  console.log('--- Seeding Stock Items ---');
  const rawYarn = await seedPrisma.inventoryItem.create({
    data: { sku: 'YARN-RAW-001', name: 'Fine Cotton Yarn 30s', type: 'RAW_MATERIAL', unit: 'LBS' },
  });
  const finishedShirt = await seedPrisma.inventoryItem.create({
    data: { sku: 'SHIRT-COTTON-001', name: 'Premium Cotton Polo Shirt', type: 'FINISHED_GOOD', unit: 'PCS' },
  });



  console.log('--- Seeding Job Work Order ---');
  await seedPrisma.jobWorkOrder.create({
    data: {
      orderNumber: 'JWO-2026-0001',
      makerId: maker.id,
      orderDate: new Date(),
      status: 'OPEN',
    },
  });

  console.log('\n=========================================');
  console.log('DATABASE SUCCESSFULLY SEEDED FOR TEXTILE ERP');
  console.log('=========================================');
}

main()
  .catch((error) => {
    console.error('Seeding failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await seedPrisma.$disconnect();
  });
