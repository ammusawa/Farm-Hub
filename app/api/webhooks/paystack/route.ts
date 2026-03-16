import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

const secret = process.env.PAYSTACK_SECRET_KEY!;

export async function POST(req: NextRequest) {
  const body = await req.text();
  const hash = crypto.createHmac('sha512', secret).update(body).digest('hex');

  if (hash !== req.headers.get('x-paystack-signature')) {
    return new NextResponse('Invalid signature', { status: 400 });
  }

  const event = JSON.parse(body);

  // Handle important events
  if (event.event === 'charge.success') {
    const reference = event.data.reference;
    const subscription = event.data.metadata?.subscription;
    const customerEmail = event.data.customer.email;

    
    console.log(`Subscription activated for ${customerEmail} - ref: ${reference}`);
  }

  if (event.event === 'subscription.create') {
    // New subscription created
    console.log('New subscription:', event.data);
  }

  if (event.event === 'subscription.not_renew') {
    // Payment failed → deactivate access
  }

  return NextResponse.json({ status: 'success' });
}