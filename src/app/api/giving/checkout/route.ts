import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { stripe, formatAmountForStripe } from '@/lib/stripe'
import { getPayloadClient } from '@/lib/payload'

const checkoutSchema = z.object({
  amount: z.number().min(1).max(100000),
  fundId: z.string().min(1),
  name: z.string().min(2),
  email: z.string().email(),
  recurring: z.boolean().default(false),
  message: z.string().optional(),
})

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json()
    const parsed = checkoutSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: parsed.error.errors },
        { status: 400 }
      )
    }

    const { amount, fundId, name, email, recurring, message } = parsed.data

    // Fetch fund from Payload
    let fundName = 'General Fund'
    try {
      const payload = await getPayloadClient()
      const fund = await payload.findByID({ collection: 'giving', id: fundId })
      if (fund) fundName = (fund as { name: string }).name
    } catch {
      // Fund lookup failed — proceed with default name
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

    if (recurring) {
      // Create a recurring subscription
      const product = await stripe.products.create({
        name: `Monthly Donation — ${fundName}`,
        metadata: { fundId, donorName: name, donorEmail: email },
      })

      const price = await stripe.prices.create({
        product: product.id,
        unit_amount: formatAmountForStripe(amount),
        currency: 'usd',
        recurring: { interval: 'month' },
      })

      const session = await stripe.checkout.sessions.create({
        mode: 'subscription',
        payment_method_types: ['card'],
        customer_email: email,
        line_items: [{ price: price.id, quantity: 1 }],
        metadata: {
          fundId,
          fundName,
          donorName: name,
          message: message ?? '',
          type: 'recurring',
        },
        success_url: `${appUrl}/giving?success=true&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${appUrl}/giving?cancelled=true`,
      })

      return NextResponse.json({ url: session.url })
    } else {
      // One-time payment
      const session = await stripe.checkout.sessions.create({
        mode: 'payment',
        payment_method_types: ['card'],
        customer_email: email,
        line_items: [
          {
            price_data: {
              currency: 'usd',
              unit_amount: formatAmountForStripe(amount),
              product_data: {
                name: `Donation — ${fundName}`,
                description: message,
              },
            },
            quantity: 1,
          },
        ],
        metadata: {
          fundId,
          fundName,
          donorName: name,
          message: message ?? '',
          type: 'one_time',
        },
        success_url: `${appUrl}/giving?success=true&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${appUrl}/giving?cancelled=true`,
      })

      return NextResponse.json({ url: session.url })
    }
  } catch (err) {
    console.error('Stripe checkout error:', err)
    return NextResponse.json({ error: 'Checkout session creation failed' }, { status: 500 })
  }
}
