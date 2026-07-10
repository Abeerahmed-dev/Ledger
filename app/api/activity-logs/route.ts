import { NextResponse } from 'next/server';
import { prisma } from '../../../db';
import {
  buildPaginationMeta,
  getSkip,
  parsePageParam,
  parsePageSizeParam,
} from '../../../lib/pagination';
import { Prisma } from '@prisma/client';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const page = parsePageParam(searchParams.get('page') || undefined);
    const pageSize = parsePageSizeParam(searchParams.get('pageSize') || undefined);

    const month = searchParams.get('month');
    const year = searchParams.get('year');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const actionType = searchParams.get('type');

    const now = new Date();
    const currentMonth = month ? parseInt(month, 10) : now.getMonth() + 1;
    const currentYear = year ? parseInt(year, 10) : now.getFullYear();

    let start: Date;
    let end: Date;

    if (startDate && endDate) {
      start = new Date(startDate);
      end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
    } else {
      start = new Date(currentYear, currentMonth - 1, 1);
      end = new Date(currentYear, currentMonth, 0, 23, 59, 59, 999);
    }

    const where: Prisma.ActivityLogWhereInput = {
      timestamp: { gte: start, lte: end },
      ...(actionType && actionType !== 'ALL' ? { actionType: actionType as any } : {}),
    };

    const [logs, total] = await Promise.all([
      prisma.activityLog.findMany({
        where,
        orderBy: { timestamp: 'desc' },
        take: pageSize,
        skip: getSkip(page, pageSize),
      }),
      prisma.activityLog.count({ where }),
    ]);

    return NextResponse.json({
      logs: logs.map((log) => ({
        id: log.id,
        timestamp: log.timestamp.toISOString(),
        actionType: log.actionType,
        description: log.description,
        orderNumber: log.orderNumber || null,
      })),
      pagination: buildPaginationMeta(page, pageSize, total),
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
