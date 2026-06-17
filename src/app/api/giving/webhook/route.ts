import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { getPayloadClient } from '@/lib/payload'
import { sendDonationConfirmation } from '@/lib/resend'
import type Stripe from 'stripe'

export async function POST(request: NextRequest): Promise<NextResponse> {
  const body = await request.text()
  const signature = request.headers.get('stripe-signature')

  if (!signature) {
    return NextResponse.json({ error: 'Missing stripe-signature header' }, { status: 400 })
  }

  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 })
  }

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET)
  } catch (err) {
    console.error('Webhook signature verification failed:', err)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        const { fundId, fundName, donorName } = session.metadata ?? {}
        const customerEmail = session.customer_email
        const amountTotal = session.amount_total ?? 0

        // Update fund raised amount in Payload
        if (fundId) {
          try {
            const payload = await getPayloadClient()
            const fund = await payload.findByID({ collection: 'giving', id: fundId })
            if (fund) {
              const currentRaised = (fund as { raised?: number }).raised ?? 0
              await payload.update({
                collection: 'giving',
                id: fundId,
                data: { raised: currentRaised + amountTotal / 100 },
              })
            }
          } catch (err) {
            console.error('Failed to update fund raised amount:', err)
          }
        }

        // Send confirmation email
        if (customerEmail && donorName && fundName) {
          try {
            await sendDonationConfirmation({
              to: customerEmail,
              name: donorName,
              amount: amountTotal / 100,
              fund: fundName,
            })
          } catch (err) {
            console.error('Failed to send confirmation email:', err)
          }
        }

        break
      }

      case 'customer.subscription.deleted': {
        // Handle subscription cancellation if needed
        const subscription = event.data.object as Stripe.Subscription
        console.log('Subscription cancelled:', subscription.id)
        break
      }

      case 'payment_intent.payment_failed': {
        const intent = event.data.object as Stripe.PaymentIntent
        console.error('Payment failed:', intent.id)
        break
      }

      default:
        // Unhandled event type — log and continue
        console.log(`Unhandled webhook event: ${event.type}`)
    }
  } catch (err) {
    console.error('Webhook handler error:', err)
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}
