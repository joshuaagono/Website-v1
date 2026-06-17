import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { Resend } from 'resend'

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) throw new Error('STRIPE_SECRET_KEY is not set')
  return new Stripe(key, { apiVersion: '2024-12-18.acacia', typescript: true })
}

const FROM_EMAIL = process.env.RESEND_FROM_EMAIL ?? 'noreply@gracestream.church'

async function sendDonationConfirmation(to: string, name: string, amount: number, fund: string) {
  const resend = new Resend(process.env.RESEND_API_KEY ?? '')
  await resend.emails.send({
    from: FROM_EMAIL,
    to,
    subject: `Thank you for your donation to ${fund}`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
        <h1 style="color:#7c6af7;">Thank You, ${name}!</h1>
        <p>Your donation of <strong>$${amount.toFixed(2)}</strong> to <strong>${fund}</strong> has been received.</p>
        <p>Your contribution makes a real difference in our community and ministry.</p>
        <p>With gratitude,<br/><strong>GraceStream Church</strong></p>
      </div>
    `,
  })
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const body = await request.text()
  const signature = request.headers.get('stripe-signature')

  if (!signature) {
    return NextResponse.json({ error: 'Missing stripe-signature header' }, { status: 400 })
  }
  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 })
  }

  const stripe = getStripe()
  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET)
  } catch (err) {
    console.error('Webhook signature verification failed:', err)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  try {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session
      const { fundName, donorName } = session.metadata ?? {}
      const customerEmail = session.customer_email
      const amountTotal = session.amount_total ?? 0

      if (customerEmail && donorName && fundName) {
        await sendDonationConfirmation(
          customerEmail,
          donorName,
          amountTotal / 100,
          fundName
        ).catch((err) => console.error('Email send failed:', err))
      }
    }
  } catch (err) {
    console.error('Webhook handler error:', err)
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}
