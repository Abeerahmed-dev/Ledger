import { NextResponse } from 'next/server';
import { prisma, PRISMA_TRANSACTION_OPTIONS } from '../../../db';
import { revalidatePath } from 'next/cache';
import {
  buildPaginationMeta,
  DEFAULT_PAGE_SIZE,
  getSkip,
  parsePageParam,
  parsePageSizeParam,
} from '../../../lib/pagination';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const page = parsePageParam(searchParams.get('page') || undefined);
    const pageSize = parsePageSizeParam(searchParams.get('pageSize') || undefined);

    const [expenses, total] = await Promise.all([
      prisma.expense.findMany({
        take: pageSize,
        skip: getSkip(page, pageSize),
        orderBy: { expenseDate: 'desc' },
        include: { category: true },
      }),
      prisma.expense.count(),
    ]);

    return NextResponse.json({
      expenses,
      pagination: buildPaginationMeta(page, pageSize, total),
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { categoryId, amount, description, date } = body;

    if (!categoryId || !amount || Number(amount) <= 0) {
      return NextResponse.json({ error: 'Category ID and positive Amount are required.' }, { status: 400 });
    }

    const expenseDate = date ? new Date(date) : new Date();

    const result = await prisma.$transaction(async (tx) => {
      const category = await tx.expenseCategory.findUnique({
        where: { id: categoryId },
      });
      if (!category) {
        throw new Error('Expense category not found.');
      }

      let cashAccount = await tx.chartOfAccounts.findFirst({
        where: { OR: [{ code: '1000' }, { name: 'Cash on Hand' }, { name: 'Cash' }] },
      });
      if (!cashAccount) {
        cashAccount = await tx.chartOfAccounts.create({
          data: { code: '1000', name: 'Cash on Hand', type: 'ASSET' },
        });
      }

      let factoryExpensesAccount = await tx.chartOfAccounts.findFirst({
        where: { OR: [{ code: '5200' }, { name: 'Factory Expenses' }] },
      });
      if (!factoryExpensesAccount) {
        factoryExpensesAccount = await tx.chartOfAccounts.create({
          data: { code: '5200', name: 'Factory Expenses', type: 'EXPENSE' },
        });
      }

      const logDesc = `Spent Rs. ${amount} on ${category.name}${description ? ' (' + description + ')' : ''}`;

      const ft = await tx.financialTransaction.create({
        data: {
          description: logDesc,
          reference: 'Daily Expense',
          postedAt: expenseDate,
        },
      });

      await tx.financialLedger.create({
        data: {
          transactionId: ft.id,
          accountId: factoryExpensesAccount.id,
          debit: Number(amount),
          credit: 0,
        },
      });

      await tx.financialLedger.create({
        data: {
          transactionId: ft.id,
          accountId: cashAccount.id,
          debit: 0,
          credit: Number(amount),
        },
      });

      const expense = await tx.expense.create({
        data: {
          categoryId,
          amount: Number(amount),
          description: description || null,
          expenseDate,
          financialTransactionId: ft.id,
        },
        include: {
          category: true,
        },
      });

      return expense;
    }, PRISMA_TRANSACTION_OPTIONS);

    revalidatePath('/dashboard/expenses');

    return NextResponse.json(result);
  } catch (error: any) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
