/**
 * Utility function to asynchronously dispatch third-party webhooks.
 * Wraps execution in try/catch to protect caller flows from network failures.
 */
export async function fireWebhook(eventType: string, payload: unknown): Promise<void> {
  console.log(`[Webhook Dispatcher] Event: ${eventType} at ${new Date().toISOString()}`);
  
  const webhookUrl = process.env.WEBHOOK_URL || 'https://api.example.com/webhooks';

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        event: eventType,
        timestamp: new Date().toISOString(),
        data: payload,
      }),
    });

    if (!response.ok) {
      console.error(`[Webhook Dispatcher Error] Failed with status ${response.status}: ${response.statusText}`);
    } else {
      console.log(`[Webhook Dispatcher Success] Successfully dispatched event: ${eventType}`);
    }
  } catch (error) {
    console.error(`[Webhook Dispatcher Error] Failed to connect to webhook URL:`, error);
  }
}
