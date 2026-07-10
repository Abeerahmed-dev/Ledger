import { Prisma, PrismaClient } from '@prisma/client';

/** Generous limits so slow remote DB (e.g. Neon) never hits default 5s transaction timeout. */
export const PRISMA_TRANSACTION_OPTIONS: {
  maxWait: number;
  timeout: number;
  isolationLevel?: Prisma.TransactionIsolationLevel;
} = {
  maxWait: 600_000,
  timeout: 600_000,
};

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const basePrisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = basePrisma;
}

/**
 * Extended Prisma Client instance enforcing immutability on ledgers.
 * Intercepts write operations on FinancialLedger and InventoryLedger,
 * raising runtime errors to block DELETE, UPDATE, and UPSERT statements.
 */
export const prisma = basePrisma.$extends({
  query: {
    financialLedger: {
      async update() {
        throw new Error("FinancialLedger is immutable. UPDATE operations are structurally blocked.");
      },
      async updateMany() {
        throw new Error("FinancialLedger is immutable. UPDATE operations are structurally blocked.");
      },
      async delete() {
        throw new Error("FinancialLedger is immutable. DELETE operations are structurally blocked.");
      },
      async deleteMany() {
        throw new Error("FinancialLedger is immutable. DELETE operations are structurally blocked.");
      },
      async upsert() {
        throw new Error("FinancialLedger is immutable. UPSERT/UPDATE operations are structurally blocked.");
      }
    },
    inventoryLedger: {
      async update() {
        throw new Error("InventoryLedger is immutable. UPDATE operations are structurally blocked.");
      },
      async updateMany() {
        throw new Error("InventoryLedger is immutable. UPDATE operations are structurally blocked.");
      },
      async delete() {
        throw new Error("InventoryLedger is immutable. DELETE operations are structurally blocked.");
      },
      async deleteMany() {
        throw new Error("InventoryLedger is immutable. DELETE operations are structurally blocked.");
      },
      async upsert() {
        throw new Error("InventoryLedger is immutable. UPSERT/UPDATE operations are structurally blocked.");
      }
    }
  }
});
