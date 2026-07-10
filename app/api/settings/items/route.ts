import { createInventoryItem } from '../../../../actions';
import { prisma } from '../../../../db';

export async function GET() {
  try {
    const items = await prisma.inventoryItem.findMany({
      orderBy: { name: 'asc' },
    });
    return new Response(JSON.stringify(items), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

export async function POST(req: Request) {
  try {
    const payload = await req.json();
    const result = await createInventoryItem(payload);
    return new Response(JSON.stringify(result), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
