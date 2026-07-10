import { NextResponse } from 'next/server';
import { prisma } from '../../../../db';
import { ActivityType } from '@prisma/client';

export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    // Check token matches CRON_SECRET environment variable
    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Determine current calendar day in Pakistan Standard Time (PKT, UTC+5)
    const now = new Date();
    const pktOffset = 5 * 60 * 60 * 1000;
    const pktTime = new Date(now.getTime() + pktOffset);
    const pktDateString = pktTime.toISOString().split('T')[0]; // 'YYYY-MM-DD'

    // Compute UTC timestamps for start and end of that PKT calendar day
    const startOfToday = new Date(`${pktDateString}T00:00:00.000Z`);
    startOfToday.setHours(startOfToday.getHours() - 5);

    const endOfToday = new Date(`${pktDateString}T23:59:59.999Z`);
    endOfToday.setHours(endOfToday.getHours() - 5);

    // Fetch the Factory Expenses account
    const factoryExpensesAccount = await prisma.chartOfAccounts.findFirst({
      where: { OR: [{ code: '5200' }, { name: 'Factory Expenses' }] },
    });

    let totalSum = 0;
    if (factoryExpensesAccount) {
      // Query the FinancialLedger for all debit entries posted to Factory Expenses today
      const expenseSummary = await prisma.financialLedger.aggregate({
        where: {
          accountId: factoryExpensesAccount.id,
          debit: { gt: 0 },
          createdAt: {
            gte: startOfToday,
            lte: endOfToday,
          },
        },
        _sum: {
          debit: true,
        },
      });
      totalSum = expenseSummary._sum.debit ? Number(expenseSummary._sum.debit) : 0;
    }

    // If there were expenses logged, insert a single aggregated ActivityLog entry
    if (totalSum > 0) {
      const description = `Total Factory Expenses for ${pktDateString}: Rs. ${totalSum}`;
      await prisma.activityLog.create({
        data: {
          actionType: ActivityType.EXPENSE_RECORDED,
          description: description,
          timestamp: new Date(),
        },
      });
      return NextResponse.json({ success: true, logged: true, totalSum, date: pktDateString });
    }

    return NextResponse.json({ success: true, logged: false, totalSum: 0, date: pktDateString });
  } catch (error: any) {
    console.error('Error executing daily expense summary cron:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
