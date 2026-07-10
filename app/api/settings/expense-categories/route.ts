import { prisma } from '../../../../db';

export async function POST(req: Request) {
  try {
    const { name } = await req.json();
    if (!name || name.trim() === '') {
      return new Response(JSON.stringify({ error: 'Category name is required.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const category = await prisma.expenseCategory.create({
      data: { name: name.trim() },
    });

    return new Response(JSON.stringify(category), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    if (error.code === 'P2002') {
      return new Response(JSON.stringify({ error: 'Category name must be unique.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

export async function PUT(req: Request) {
  try {
    const { id, name } = await req.json();
    if (!id || !name || name.trim() === '') {
      return new Response(JSON.stringify({ error: 'Id and Category name are required.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const category = await prisma.expenseCategory.update({
      where: { id },
      data: { name: name.trim() },
    });

    return new Response(JSON.stringify(category), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    if (error.code === 'P2002') {
      return new Response(JSON.stringify({ error: 'Category name must be unique.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return new Response(JSON.stringify({ error: 'Category ID is required.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const category = await prisma.expenseCategory.delete({
      where: { id },
    });

    return new Response(JSON.stringify(category), {
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
