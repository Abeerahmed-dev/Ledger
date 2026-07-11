import { PrismaClient } from '@prisma/client';

const seedPrisma = new PrismaClient();

export async function POST() {
  try {
    // 1. Reset Database in correct order of dependency
    await seedPrisma.financialLedger.deleteMany();
    await seedPrisma.financialTransaction.deleteMany();
    await seedPrisma.inventoryLedger.deleteMany();
    await seedPrisma.purchaseLine.deleteMany();
    await seedPrisma.purchaseInvoice.deleteMany();
    await seedPrisma.salesLine.deleteMany();
    await seedPrisma.salesInvoice.deleteMany();
    await seedPrisma.location.deleteMany();
    await seedPrisma.inventoryItem.deleteMany();
    await seedPrisma.entity.deleteMany();
    await seedPrisma.chartOfAccounts.deleteMany();

    // 2. Seed Chart of Accounts
    const accounts = [
      { code: '1000', name: 'Cash', type: 'ASSET' },
      { code: '1100', name: 'Inventory Asset', type: 'ASSET' },
      { code: '1200', name: 'Accounts Receivable', type: 'ASSET' },
      { code: '1300', name: 'Advance Paid to Maker/Supplier', type: 'ASSET' },
      { code: '2100', name: 'Accounts Payable', type: 'LIABILITY' },
      { code: '2200', name: 'Advance Received from Company', type: 'LIABILITY' },
      { code: '4100', name: 'Sales Revenue', type: 'REVENUE' },
      { code: '5100', name: 'COGS - Labor', type: 'EXPENSE' },
    ] as const;
    for (const acc of accounts) {
      await seedPrisma.chartOfAccounts.create({ data: acc });
    }

    // 3. Seed Entities
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

    // 4. Seed Inventory Items
    const rawYarn = await seedPrisma.inventoryItem.create({
      data: { sku: 'YARN-RAW-001', name: 'Fine Cotton Yarn 30s', type: 'RAW_MATERIAL', unit: 'LBS' },
    });
    const finishedShirt = await seedPrisma.inventoryItem.create({
      data: { sku: 'SHIRT-COTTON-001', name: 'Premium Cotton Polo Shirt', type: 'FINISHED_GOOD', unit: 'PCS' },
    });

    const result = {
      message: 'Seeded successfully',
      supplierId: supplier.id,
      makerId: maker.id,
      companyId: company.id,
      rawYarnId: rawYarn.id,
      finishedShirtId: finishedShirt.id,
    };

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  } finally {
    await seedPrisma.$disconnect();
  }
}
