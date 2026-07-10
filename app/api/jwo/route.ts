export async function POST(req: Request) {
  return new Response(
    JSON.stringify({
      message: 'JobWorkOrder model is deprecated. Please tag transactions with orderNumber manually.',
    }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }
  );
}
