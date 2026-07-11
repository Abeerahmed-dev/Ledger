"use server";

import { prisma } from '../../db';

export async function getActiveMakerOrders(makerId: string): Promise<string[]> {
  if (!makerId) return [];

  try {
    const maker = await prisma.entity.findUnique({
      where: { id: makerId },
    });
    if (!maker || maker.type !== 'MAKER') {
      return [];
    }

    // Query activity logs for transfer logs to this maker
    const transferLogs = await prisma.activityLog.findMany({
      where: {
        actionType: 'MAKER_TRANSFER',
        AND: [
          { orderNumber: { not: null } },
          { orderNumber: { not: '' } }
        ],
        description: { contains: `to Maker ${maker.name}` },
      },
      select: { orderNumber: true },
    });
    const candidateOrderNumbers = [...new Set(transferLogs.map(l => l.orderNumber as string))];

    // Query activity logs for finished goods received and transfer logs for candidates
    const logs = await prisma.activityLog.findMany({
      where: {
        orderNumber: { in: candidateOrderNumbers },
        actionType: { in: ['MAKER_TRANSFER', 'GOODS_RECEIVED'] },
      },
    });

    const yarnBalance = new Map<string, number>();
    for (const log of logs) {
      const orderNum = log.orderNumber as string;
      let currentVal = yarnBalance.get(orderNum) || 0;
      if (log.actionType === 'MAKER_TRANSFER') {
        const qtyMatch = log.description.match(/Issued (\d+(?:\.\d+)*) lbs/i);
        if (qtyMatch) {
          currentVal += parseFloat(qtyMatch[1]);
        }
      } else if (log.actionType === 'GOODS_RECEIVED') {
        const qtyMatch = log.description.match(/Consumed (\d+(?:\.\d+)*) lbs/i);
        if (qtyMatch) {
          currentVal -= parseFloat(qtyMatch[1]);
        } else {
          // Fallback: if there's a receipt log without a Consumed tag, treat it as closed
          currentVal = 0;
        }
      }
      yarnBalance.set(orderNum, currentVal);
    }

    return candidateOrderNumbers.filter(o => (yarnBalance.get(o) || 0) > 0.0001);
  } catch (error) {
    console.error('Error fetching active maker orders:', error);
    return [];
  }
}
