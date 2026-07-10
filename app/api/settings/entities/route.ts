import { createEntity } from '../../../../actions';
import { prisma } from '../../../../db';

export async function GET() {
  try {
    const entities = await prisma.entity.findMany({
      orderBy: { name: 'asc' },
    });
    return new Response(JSON.stringify(entities), {
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
    const result = await createEntity(payload);
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

export async function PUT(req: Request) {
  try {
    const payload = await req.json();
    const { id, name, type, ntnNumber, strnNumber, address } = payload;
    if (!id) {
      return new Response(JSON.stringify({ error: 'Entity ID is required' }), { status: 400 });
    }
    const result = await prisma.entity.update({
      where: { id },
      data: {
        name,
        type,
        ntnNumber: ntnNumber || null,
        strnNumber: strnNumber || null,
        address: address || null,
      },
    });
    return new Response(JSON.stringify(result), {
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

