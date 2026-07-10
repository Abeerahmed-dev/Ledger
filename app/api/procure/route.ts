import { procureRawMaterial } from '../../../actions';

export async function POST(req: Request) {
  try {
    const payload = await req.json();
    const result = await procureRawMaterial(payload);
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
