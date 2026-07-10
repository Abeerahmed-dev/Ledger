import { createServer, Server } from 'http';
import { PrismaClient } from '@prisma/client';
import { prisma } from './db.js';
import {
  procureRawMaterial,
  transferToMaker,
  receiveFinishedGoods,
  generateDeliveryInvoice,
  recordPayment
} from './actions.js';

// Fresh base PrismaClient to bypass client-level delete restrictions during seed resets
const seedPrisma = new PrismaClient();

let serverInstance: Server | null = null;

export function startServer(port: number): Promise<void> {
  return new Promise((resolve, reject) => {
    serverInstance = createServer((req, res) => {
      // Set response headers
      res.setHeader('Content-Type', 'application/json');

      let body = '';
      req.on('data', (chunk) => {
        body += chunk;
      });

      req.on('end', async () => {
        try {
          const payload = body ? JSON.parse(body) : {};

          // Seed Router
          if (req.url === '/api/seed' && req.method === 'POST') {
            // 1. Reset Database in correct order of dependency
            await seedPrisma.financialLedger.deleteMany();
            await seedPrisma.financialTransaction.deleteMany();
            await seedPrisma.inventoryLedger.deleteMany();
            await seedPrisma.purchaseLine.deleteMany();
            await seedPrisma.purchaseInvoice.deleteMany();
            await seedPrisma.salesLine.deleteMany();
            await seedPrisma.salesInvoice.deleteMany();
            await seedPrisma.activityLog.deleteMany();
            await seedPrisma.location.deleteMany();
            await seedPrisma.inventoryItem.deleteMany();
            await seedPrisma.entity.deleteMany();
            await seedPrisma.chartOfAccounts.deleteMany();

            // 2. Seed Chart of Accounts
            const accountsList = [
              { code: '1000', name: 'Cash', type: 'ASSET' },
              { code: '1100', name: 'Inventory Asset', type: 'ASSET' },
              { code: '1200', name: 'Accounts Receivable', type: 'ASSET' },
              { code: '2100', name: 'Accounts Payable', type: 'LIABILITY' },
              { code: '4100', name: 'Sales Revenue', type: 'REVENUE' },
              { code: '5100', name: 'COGS - Labor', type: 'EXPENSE' },
            ] as const;
            for (const acc of accountsList) {
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

            res.writeHead(200);
            res.end(
              JSON.stringify({
                message: 'Seeded successfully',
                supplierId: supplier.id,
                makerId: maker.id,
                companyId: company.id,
                rawYarnId: rawYarn.id,
                finishedShirtId: finishedShirt.id,
              })
            );
            return;
          }

          // Procure Router
          if (req.url === '/api/procure' && req.method === 'POST') {
            const result = await procureRawMaterial(payload);
            res.writeHead(200);
            res.end(JSON.stringify(result));
            return;
          }

          // Transfer Router
          if (req.url === '/api/transfer' && req.method === 'POST') {
            const result = await transferToMaker(payload);
            res.writeHead(200);
            res.end(JSON.stringify(result));
            return;
          }

          // Receive Router
          if (req.url === '/api/receive' && req.method === 'POST') {
            const result = await receiveFinishedGoods(payload);
            res.writeHead(200);
            res.end(JSON.stringify(result));
            return;
          }

          // Payment Router
          if (req.url === '/api/payment' && req.method === 'POST') {
            const result = await recordPayment(payload);
            res.writeHead(200);
            res.end(JSON.stringify(result));
            return;
          }

          // Invoice Router
          if (req.url === '/api/invoice' && req.method === 'POST') {
            const result = await generateDeliveryInvoice(payload);
            res.writeHead(200);
            res.end(JSON.stringify(result));
            return;
          }

          // Not Found Route
          res.writeHead(404);
          res.end(JSON.stringify({ error: 'Endpoint not found' }));
        } catch (error: any) {
          console.error(`[API Server Error] Request to ${req.url} failed:`, error.message);
          res.writeHead(500);
          res.end(JSON.stringify({ error: error.message || 'Internal Server Error' }));
        }
      });
    });

    serverInstance.listen(port, () => {
      console.log(`[API Server] Running local testing server on port ${port}`);
      resolve();
    });

    serverInstance.on('error', (err) => {
      reject(err);
    });
  });
}

export function stopServer(): Promise<void> {
  return new Promise((resolve) => {
    if (serverInstance) {
      serverInstance.close(() => {
        console.log('[API Server] Stopped testing server.');
        resolve();
      });
    } else {
      resolve();
    }
  });
}
