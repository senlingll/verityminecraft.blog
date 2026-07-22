import { Hono } from 'hono'
import { cors } from 'hono/cors'
import type { Env } from '../db'
import { createDb } from '../db'
import { orders, users } from '../schema'
import { eq, and, desc } from 'drizzle-orm'
import { CreditsService } from '../credits'
import { createHmac, createHash } from 'node:crypto'
import { jsonError, jsonSuccess, REDIRECT_REASONS } from '../payment-errors'
import { getCorsOrigins, getFrontendUrl } from '../domain-config'

const payments = new Hono<{ Bindings: Env }>()

// CORS for this router if needed (align with global CORS in index.ts)
payments.use('/*', cors({
  origin: [
    'http://127.0.0.1:5173',
    'http://127.0.0.1:3000',
    'https://playpokechill.blog',  // 添加这个域名
    'https://playpokechill.blog',
    'http://localhost:5000',
    'http://localhost:5173',
    'http://localhost:3000',
    'https://playpokechill.blog',
    'https://api.playpokechill.blog',
    'https://yourdomain.com'
  ],
  allowHeaders: ['Content-Type', 'Authorization', 'creem-signature'],
  allowMethods: ['GET', 'POST', 'OPTIONS'],
  credentials: true,
}))

function creemApiBase(env: Env) {
  // @ts-ignore - optional binding
  return (env as any).CREEM_API_BASE_URL
}

function generateOrderNo() {
  const ts = Date.now().toString(36)
  const rnd = Math.random().toString(36).slice(2, 8)
  return `ord_${ts}_${rnd}`
}

// Create a Creem checkout session
payments.post('/creem/checkout', async (c) => {
  try {
    const authHeader = c.req.header('Authorization') || ''
    const tokenMatch = authHeader.match(/^Bearer\s+(.+)$/)
    if (!tokenMatch) {
      return jsonError(c, 'UNAUTHORIZED', undefined, 401)
    }

    // We trust downstream /auth/me for token validation if needed; here only proceed
    const body = await c.req.json()
    const { product_id, units = 1, discount_code, success_url, metadata } = body || {}

    // Log incoming request params (no secrets)
    console.log('[Creem][Checkout] Incoming request', {
      product_id,
      units,
      discount_code,
      success_url,
      metadata,
    })

    if (!product_id) {
      return jsonError(c, 'MISSING_PRODUCT_ID')
    }

    // Create DB connection
    const db = createDb(c.env)

    // Try to get user via /auth/me is outside this router, so accept optional user_uuid/user_email in metadata
    let user_uuid: string | null = metadata?.user_uuid || null
    let user_email: string | null = metadata?.user_email || null

    // Build success URL (client first, then env, then fallback)
    // @ts-ignore - optional binding
    const defaultSuccess = (c.env as any).CREEM_SUCCESS_URL as string | undefined
    let finalSuccessUrl = success_url || defaultSuccess || 'https://yourdomain.com/my-orders'
    
    // If using env/fallback URL and we have language info, modify the 'to' parameter
    const frontendLanguage = metadata?.frontend_language || 'en'
    if (!success_url && defaultSuccess && frontendLanguage !== 'en') {
      try {
        const url = new URL(defaultSuccess)
        const currentTo = url.searchParams.get('to') || '/my-orders'
        const languageTo = currentTo.startsWith('/') ? `/${frontendLanguage}${currentTo}` : `/${frontendLanguage}/my-orders`
        url.searchParams.set('to', languageTo)
        finalSuccessUrl = url.toString()
        console.log('[Creem][Checkout] Modified success_url for language:', {
          original: defaultSuccess,
          language: frontendLanguage,
          modified: finalSuccessUrl
        })
      } catch (e) {
        console.warn('[Creem][Checkout] Failed to modify success_url for language:', e)
      }
    }
    
    // Validate success_url must be absolute URL
    const envMode = (c.env.ENVIRONMENT || 'development').toLowerCase()
    const devFallback = getFrontendUrl(c.env, '/my-orders')
    try {
      // throws if invalid
      new URL(finalSuccessUrl)
    } catch {
      console.warn('[Creem][Checkout] Invalid success_url provided, falling back', { finalSuccessUrl })
      finalSuccessUrl = envMode === 'development' ? (defaultSuccess || devFallback) : (defaultSuccess || getFrontendUrl(c.env, '/my-orders'))
    }
    console.log('[Creem][Checkout] success_url chosen', {
      finalSuccessUrl,
      source: success_url ? 'client' : (defaultSuccess ? 'env' : 'fallback')
    })

    // Prepare payload for Creem
    const request_id = generateOrderNo()
    const payload: any = {
      request_id,
      product_id,
      units,
      success_url: finalSuccessUrl,
      customer: {}
    }

    if (discount_code) payload.discount_code = discount_code

    // Log outbound payload to Creem (sanitized)
    console.log('[Creem][Checkout] Outbound payload', {
      endpoint: `${creemApiBase(c.env)}/v1/checkouts`,
      payload,
      // Do NOT log API keys
    })

    // If we have user info, attach as customer and metadata
    const internalMeta: Record<string, any> = {
      ...(metadata || {}),
    }
    if (user_uuid) internalMeta.internal_user_uuid = user_uuid

    if (Object.keys(internalMeta).length > 0) payload.metadata = internalMeta

    if (user_email) {
      payload.customer = { email: user_email }
    }

    // Call Creem API
    // @ts-ignore
    const apiKey = (c.env as any).CREEM_API_KEY as string | undefined
    if (!apiKey) {
      return jsonError(c, 'API_KEY_NOT_CONFIGURED', undefined, 500)
    }

    const res = await fetch(`${creemApiBase(c.env)}/v1/checkouts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
      },
      body: JSON.stringify(payload),
    })

    if (!res.ok) {
      const txt = await res.text()
      return jsonError(c, 'API_ERROR', `Creem API error: ${txt}`, 502)
    }

    const checkout = await res.json() as any

    // Create a local pending order record (best-effort)
    // IMPORTANT: Use the actual order_id from Creem response, not our request_id
    try {
      const orderObj = checkout.order || {}
      const creemOrderId = orderObj.id  // Creem's actual order ID
      
      // Only create local order if we have a real order_id from Creem
      if (creemOrderId) {
        const amount = orderObj.amount || 0
        const currency = orderObj.currency || checkout.order?.currency || null
        const productName = checkout.product?.name || null
        const productId = checkout.product?.id || product_id || null

        console.log('[Creem][Checkout] Creating pending order with Creem order_id:', {
          creem_order_id: creemOrderId,
          request_id,
          amount,
          productId
        })

        // Store language-aware success_url in paid_detail for later language detection
        const frontendLanguage = metadata?.frontend_language || 'en'
        const languageAwareSuccessUrl = frontendLanguage === 'en' 
          ? finalSuccessUrl.replace('?to=/my-orders', '?to=/my-orders')
          : finalSuccessUrl.replace('?to=/my-orders', `?to=/${frontendLanguage}/my-orders`)
        
        const orderDetail = JSON.stringify({
          original_success_url: languageAwareSuccessUrl,
          frontend_language: frontendLanguage,
          created_via: 'frontend_checkout',
          request_id: request_id
        })
        
        await db.insert(orders).values({
          order_no: creemOrderId,  // Use Creem's order_id, not our request_id
          created_at: new Date(),
          user_uuid: user_uuid || '',
          user_email: user_email || '',
          amount: amount || 0,
          status: 'pending',
          credits: 0,
          currency,
          product_id: productId,
          product_name: productName,
          paid_detail: orderDetail,
        })
        console.log('[Creem][Checkout] Created pending order:', creemOrderId)
      } else {
        console.warn('[Creem][Checkout] No order_id in Creem response, skipping local order creation')
      }
    } catch (e) {
      // Non-fatal if order insert fails; webhook will sync
      console.error('Local order insert failed:', e)
    }

    return jsonSuccess(c, {
      checkout_url: checkout.checkout_url,
      checkout_id: checkout.id,
      order: checkout.order || null,
    })
  } catch (err: any) {
    console.error('Create checkout error:', err)
    return jsonError(c, 'INTERNAL_ERROR', err?.message || String(err), 500)
  }
})

// Creem webhook endpoint
payments.post('/webhooks/creem', async (c) => {
  try {
    const signature = c.req.header('creem-signature') || ''
    // @ts-ignore
    const webhookSecret = (c.env as any).CREEM_WEBHOOK_SECRET as string | undefined
    if (!webhookSecret) {
      return jsonError(c, 'WEBHOOK_NOT_CONFIGURED', undefined, 500)
    }

    const rawBody = await c.req.text()
    const computed = createHmac('sha256', webhookSecret).update(rawBody).digest('hex')
    if (computed !== signature) {
      return jsonError(c, 'INVALID_SIGNATURE', undefined, 401)
    }

    const event = JSON.parse(rawBody)
    const eventType: string = event.eventType || event.type || ''

    console.log('[Creem][Webhook] Processing event:', { eventType, timestamp: new Date().toISOString() })

    // Handle different event types
    if (eventType === 'checkout.completed') {
      await handleCheckoutCompleted(event, c)
    } else if (['checkout.failed', 'checkout.cancelled', 'checkout.expired', 'payment.failed'].includes(eventType)) {
      await handleCheckoutFailed(event, c, eventType)
    } else if (eventType === 'subscription.active') {
      await handleSubscriptionActive(event, c)
    } else if (eventType === 'subscription.paid') {
      await handleSubscriptionPaid(event, c)
    } else if (eventType === 'subscription.canceled') {
      await handleSubscriptionCanceled(event, c)
    } else if (eventType === 'subscription.expired') {
      await handleSubscriptionExpired(event, c)
    } else if (eventType === 'subscription.paused') {
      await handleSubscriptionPaused(event, c)
    } else if (eventType === 'subscription.update') {
      await handleSubscriptionUpdate(event, c)
    } else if (eventType === 'subscription.trialing') {
      await handleSubscriptionTrialing(event, c)
    } else if (eventType === 'refund.created') {
      await handleRefundCreated(event, c)
    } else if (eventType === 'dispute.created') {
      await handleDisputeCreated(event, c)
    } else {
      console.log('[Creem][Webhook] Unhandled event type:', eventType)
    }

    // Acknowledge all events
    return c.json({ received: true })
  } catch (err: any) {
    console.error('Webhook handling error:', err)
    return jsonError(c, 'INTERNAL_ERROR', err?.message || String(err), 500)
  }
})

// Verify Creem return URL signature
payments.get('/creem/return/verify', async (c) => {
  try {
    // Collect expected params from query
    const request_id = c.req.query('request_id') || null
    const checkout_id = c.req.query('checkout_id') || null
    const order_id = c.req.query('order_id') || null
    const customer_id = c.req.query('customer_id') || null
    const subscription_id = c.req.query('subscription_id') || null
    const product_id = c.req.query('product_id') || null
    const signature = c.req.query('signature') || ''

    // @ts-ignore
    const apiKey = (c.env as any).CREEM_API_KEY as string | undefined
    if (!apiKey) {
      return c.json({ valid: false, error: 'CREEM_API_KEY not configured' }, 500)
    }

    // Build string in the same order as documentation example
    // Build the concatenation in documented order, include optional parameters only if present
    const parts: string[] = []
    if (request_id != null) parts.push(`request_id=${request_id}`)
    parts.push(`checkout_id=${checkout_id || ''}`)
    parts.push(`order_id=${order_id || ''}`)
    parts.push(`customer_id=${customer_id || ''}`)
    if (subscription_id != null) parts.push(`subscription_id=${subscription_id}`)
    parts.push(`product_id=${product_id || ''}`)
    parts.push(`salt=${apiKey}`)

    const data = parts.join('|')
    const computed = createHash('sha256').update(data).digest('hex')
    const valid = computed === signature

    return c.json({ valid, computed, data })
  } catch (err: any) {
    console.error('Return verification error:', err)
    return c.json({ valid: false, error: err?.message || String(err) }, 500)
  }
})

// Creem return endpoint that redirects user to frontend after verification
payments.get('/creem/return', async (c) => {
  try {
    // Log all incoming query parameters for debugging
    const allParams = Object.fromEntries(c.req.url.split('?')[1]?.split('&').map(param => param.split('=')) || [])
    console.log('[Creem][Return] Incoming request parameters:', allParams)

    const request_id = c.req.query('request_id') || null
    const checkout_id = c.req.query('checkout_id') || null
    const order_id = c.req.query('order_id') || null
    const customer_id = c.req.query('customer_id') || null
    const subscription_id = c.req.query('subscription_id') || null
    const product_id = c.req.query('product_id') || null
    const signature = c.req.query('signature') || ''
    const to = c.req.query('to') || c.req.query('next') || '/'

    console.log('[Creem][Return] Parsed parameters:', {
      request_id,
      checkout_id,
      order_id,
      customer_id,
      subscription_id,
      product_id,
      signature: signature ? `${signature.substring(0, 8)}...` : 'none',
      to
    })

    // @ts-ignore
    const frontendBase = ((c.env as any).FRONTEND_BASE_URL as string | undefined) || getFrontendUrl(c.env, '').replace(/\/$/, '')

    console.log('[Creem][Return] Environment config:', {
      frontendBase
    })

    // SECURITY: Verify signature first to prevent abuse
    // @ts-ignore
    const apiKey = (c.env as any).CREEM_API_KEY as string | undefined
    if (!apiKey) {
      console.error('[Creem][Return] CREEM_API_KEY not configured')
      const url = new URL(frontendBase)
      url.pathname = '/'
      url.searchParams.set('payment_success', 'false')
      url.searchParams.set('reason', 'server_config_error')
      return c.redirect(url.toString(), 302)
    }

    const params: Record<string, string> = {}
    
    // Only include parameters that Creem actually signs (exclude 'to' and other non-core params)
    if (request_id) params.request_id = request_id
    if (checkout_id) params.checkout_id = checkout_id
    if (order_id) params.order_id = order_id
    if (customer_id) params.customer_id = customer_id
    if (subscription_id) params.subscription_id = subscription_id  // Include subscription_id for subscription payments
    if (product_id) params.product_id = product_id
    // Note: 'to' parameter is excluded as it's not part of Creem's signature
    
    // Use the exact method from Creem documentation
    const data = Object.entries(params)
      .map(([key, value]) => `${key}=${value}`)
      .concat(`salt=${apiKey}`)
      .join('|')
    
    const computed = createHash('sha256').update(data).digest('hex')
    const isSignatureValid = computed === signature

    console.log('[Creem][Return] Signature verification:', {
      provided_signature: signature ? `${signature.substring(0, 8)}...` : 'none',
      computed_signature: computed ? `${computed.substring(0, 8)}...` : 'none',
      valid: isSignatureValid,
      data_string: data
    })

    // If signature is invalid, redirect to error page
    if (!isSignatureValid) {
      console.error('[Creem][Return] Invalid signature, potential security threat')
      const url = new URL(frontendBase)
      url.pathname = '/'
      url.searchParams.set('payment_success', 'false')
      url.searchParams.set('reason', 'invalid_signature')
      return c.redirect(url.toString(), 302)
    }

    // Verify order status from database since webhook is the source of truth
    let orderExists = false
    let orderStatus = ''
    let failureReason = ''
    let actualOrderId = order_id // May be updated if subscription_id fallback is used
    
    if (order_id) {
      try {
        const db = createDb(c.env)
        const existingOrder = await db.select().from(orders).where(eq(orders.order_no, order_id)).limit(1)
        
        if (existingOrder && existingOrder[0]) {
          orderExists = true
          orderStatus = existingOrder[0].status || 'unknown'
          
          // Extract failure reason from paid_detail if it's a failed order
          if (['failed', 'cancelled', 'expired'].includes(orderStatus) && existingOrder[0].paid_detail) {
            try {
              const detail = JSON.parse(existingOrder[0].paid_detail)
              failureReason = detail.failure_reason || detail.event_type || ''
            } catch (e) {
              console.log('[Creem][Return] Could not parse paid_detail:', e)
            }
          }
          
          console.log('[Creem][Return] Order verification:', {
            order_id,
            exists: orderExists,
            status: orderStatus,
            failure_reason: failureReason
          })
          
          // If order exists but not paid, check for subscription-id-based fallback
          if (orderStatus !== 'paid' && subscription_id) {
            console.log('[Creem][Return] Order not paid but subscription_id available, checking for paid subscription orders')
            
            try {
              // Find the most recent paid order for this subscription
              const subscriptionOrders = await db
                .select()
                .from(orders)
                .where(
                  and(
                    eq(orders.sub_id as any, subscription_id as any),
                    eq(orders.status, 'paid')
                  )
                )
                .orderBy(desc(orders.paid_at || orders.created_at))
                .limit(1)
              
              if (subscriptionOrders && subscriptionOrders[0]) {
                console.log('[Creem][Return] Found paid subscription order, using it instead:', {
                  original_order_id: order_id,
                  subscription_order_id: (subscriptionOrders[0] as any).order_no,
                  subscription_id
                })
                
                // Update variables to use the paid subscription order
                actualOrderId = (subscriptionOrders[0] as any).order_no
                orderExists = true
                orderStatus = 'paid'
                failureReason = ''
              } else {
                console.log('[Creem][Return] No paid subscription orders found yet, maintaining original order status')
              }
            } catch (e) {
              console.error('[Creem][Return] Subscription order lookup failed:', e)
            }
          }
        } else {
          console.log('[Creem][Return] Order not found in database:', { order_id })
        }
      } catch (e) {
        console.error('[Creem][Return] Order lookup failed:', e)
      }
    }

    // If order not found but we have subscription_id, try to resolve via subscription orders
    if (!orderExists && subscription_id) {
      try {
        const db = createDb(c.env)
        // Prefer a paid order for this subscription
        const paidSubOrders = await db
          .select()
          .from(orders)
          .where(
            and(
              eq(orders.sub_id as any, subscription_id as any),
              eq(orders.status, 'paid')
            )
          )
          .orderBy(desc(orders.paid_at || orders.created_at))
          .limit(1)

        if (paidSubOrders && paidSubOrders[0]) {
          actualOrderId = (paidSubOrders[0] as any).order_no
          orderExists = true
          orderStatus = 'paid'
          failureReason = ''
          console.log('[Creem][Return] Resolved paid order via subscription_id fallback:', {
            subscription_id,
            order_id: actualOrderId
          })
        } else {
          // If no paid order yet, see if there is any order for this subscription to mark as pending
          const anySubOrders = await db
            .select()
            .from(orders)
            .where(eq(orders.sub_id as any, subscription_id as any))
            .orderBy(desc(orders.created_at))
            .limit(1)

          if (anySubOrders && anySubOrders[0]) {
            actualOrderId = (anySubOrders[0] as any).order_no
            orderExists = true
            orderStatus = (anySubOrders[0] as any).status || 'pending'
            console.log('[Creem][Return] Found subscription order (not paid yet), treating as pending:', {
              subscription_id,
              order_id: actualOrderId,
              status: orderStatus
            })
          } else {
            console.log('[Creem][Return] No orders found for subscription_id fallback')
          }
        }
      } catch (e) {
        console.error('[Creem][Return] Subscription fallback lookup failed:', e)
      }
    }

    // Decide target path (default to homepage). Optionally accept a safe path from query
    const safePath = (to && to.startsWith('/')) ? to : '/'

    // Extract language prefix from the 'to' parameter OR try to detect from the user's original success_url
    let languagePrefix = ''
    let finalPath = '/my-orders'  // Default target after payment
    
    // First, try to get language from 'to' parameter
    if (safePath && safePath.startsWith('/')) {
      const pathParts = safePath.split('/')
      // Check if the first path segment is a language code (2 characters)
      if (pathParts.length > 1 && pathParts[1] && pathParts[1].length === 2 && /^[a-z]{2}$/.test(pathParts[1])) {
        languagePrefix = `/${pathParts[1]}`
        finalPath = `${languagePrefix}/my-orders`  // Preserve language in orders path
      }
    }
    
    // If no language detected from 'to' parameter, try to detect from the original success_url stored in our order
    if (!languagePrefix && order_id) {
      try {
        const db = createDb(c.env)
        const existingOrder = await db.select().from(orders).where(eq(orders.order_no, order_id)).limit(1)
        
        console.log('[Creem][Return] Order lookup for language detection:', {
          order_id,
          orderFound: !!(existingOrder && existingOrder[0]),
          hasPaidDetail: !!(existingOrder && existingOrder[0] && existingOrder[0].paid_detail)
        })
        
        if (existingOrder && existingOrder[0] && existingOrder[0].paid_detail) {
          console.log('[Creem][Return] Raw paid_detail:', existingOrder[0].paid_detail)
          try {
            const detail = JSON.parse(existingOrder[0].paid_detail)
            console.log('[Creem][Return] Parsed paid_detail:', detail)
            
            if (detail.original_success_url) {
              console.log('[Creem][Return] Found original_success_url:', detail.original_success_url)
              const successUrl = new URL(detail.original_success_url)
              const urlPathParts = successUrl.pathname.split('/')
              
              console.log('[Creem][Return] URL path parts:', {
                pathname: successUrl.pathname,
                pathParts: urlPathParts,
                firstSegment: urlPathParts[1]
              })
              
              if (urlPathParts.length > 1 && urlPathParts[1] && urlPathParts[1].length === 2 && /^[a-z]{2}$/.test(urlPathParts[1])) {
                languagePrefix = `/${urlPathParts[1]}`
                finalPath = `${languagePrefix}/my-orders`
                console.log('[Creem][Return] Language detected from stored success_url:', {
                  languagePrefix,
                  finalPath
                })
              } else {
                console.log('[Creem][Return] No language code detected in success_url pathname')
              }
            } else {
              console.log('[Creem][Return] No original_success_url found in paid_detail')
            }
          } catch (e) {
            console.log('[Creem][Return] Could not parse stored success_url:', e)
          }
        } else {
          console.log('[Creem][Return] No order found or no paid_detail available for language detection')
        }
      } catch (e) {
        console.log('[Creem][Return] Could not lookup order for language detection:', e)
      }
    } else if (!languagePrefix) {
      console.log('[Creem][Return] No order_id provided for language detection from database')
    } else {
      console.log('[Creem][Return] Language prefix already detected from to parameter:', languagePrefix)
    }
    
    // If safePath already contains 'my-orders', use it directly (this takes highest precedence)
    if (safePath.includes('/my-orders')) {
      finalPath = safePath
    }

    console.log('[Creem][Return] Language prefix detection:', {
      safePath,
      languagePrefix,
      finalPath,
      pathParts: safePath.split('/')
    })

    const url = new URL(frontendBase)
    url.pathname = finalPath

    // Determine payment result based on order status
    const isSuccess = orderStatus === 'paid'
    const isFailure = ['failed', 'cancelled', 'expired'].includes(orderStatus)
    
    if (orderExists && isSuccess) {
      console.log('[Creem][Return] Order is paid, redirecting to success page')
      url.searchParams.set('payment_success', 'true')
      url.searchParams.set('order_id', String(actualOrderId))
    } else if (orderExists && isFailure) {
      console.log('[Creem][Return] Order failed/cancelled/expired, redirecting to failure page')
      url.searchParams.set('payment_success', 'false')
      url.searchParams.set('order_id', String(actualOrderId))
      url.searchParams.set('status', orderStatus)
      if (failureReason) {
        url.searchParams.set('reason', failureReason)
      }
    } else if (orderExists && orderStatus === 'pending') {
      // For pending orders with subscription_id, check if we should wait or show error
      if (subscription_id) {
        console.log('[Creem][Return] Order pending for subscription, redirecting with pending status (webhook may still process)')
        url.searchParams.set('payment_success', 'pending')
        url.searchParams.set('order_id', String(actualOrderId))
      } else {
        console.log('[Creem][Return] Order still pending, redirecting with pending status')
        url.searchParams.set('payment_success', 'pending')
        url.searchParams.set('order_id', String(actualOrderId))
      }
    } else if (!order_id) {
      // No order_id provided, assume success (trust Creem redirect)
      console.log('[Creem][Return] No order_id provided, assuming success')
      url.searchParams.set('payment_success', 'true')
    } else {
      console.log('[Creem][Return] Order not found, redirecting to failure page')
      url.searchParams.set('payment_success', 'false')
      url.searchParams.set('reason', 'order_not_found')
    }

    const finalUrl = url.toString()
    console.log('[Creem][Return] Final redirect URL:', finalUrl)

    // Important note: do not perform DB writes here; webhook is the source of truth.
    // This endpoint is only for user redirection UX.

    return c.redirect(finalUrl, 302)
  } catch (err: any) {
    console.error('[Creem][Return] Redirect error:', err)
    // On error, still try to send user to the homepage with a failure flag
    const frontendBase = getFrontendUrl(c.env, '').replace(/\/$/, '')
    const url = new URL(frontendBase)
    url.pathname = '/'
    url.searchParams.set('payment_success', 'false')
    url.searchParams.set('reason', 'server_error')
    const errorUrl = url.toString()
    console.log('[Creem][Return] Error redirect URL:', errorUrl)
    return c.redirect(errorUrl, 302)
  }
})

// Helper function to handle successful checkout completion
async function handleCheckoutCompleted(event: any, c: any) {
  const obj = event.object || {}
  const orderObj = obj.order || {}
  const productObj = obj.product || {}
  const customerObj = obj.customer || {}

  const orderNo = orderObj.id || obj.id || generateOrderNo()
  const amount = orderObj.amount || 0
  const currency = orderObj.currency || productObj.currency || null
  const productId = typeof obj.product === 'string' ? obj.product : (productObj?.id || null)
  const productName = productObj?.name || null
  const customerEmail = customerObj?.email || ''

  console.log('[Creem][Webhook] Processing successful checkout:', {
    orderNo,
    amount,
    currency,
    productId,
    customerEmail,
    orderType: orderObj.type,
    hasSubscription: !!obj.subscription
  })

  // For subscription (recurring) checkouts, do not mark paid or award credits here.
  // subscription.paid will handle the authoritative payment event to avoid duplicates.
  if (orderObj?.type === 'recurring' || obj?.subscription) {
    console.log('[Creem][Webhook] checkout.completed for recurring detected, skipping order write. Handled by subscription.paid')
    return
  }

  const db = createDb(c.env)

  // Find or create user by email
  let userUuid: string = ''
  try {
    const userRows = await db.select().from(users).where(eq(users.email, customerEmail)).limit(1)
    if (userRows && userRows[0]) {
      // @ts-ignore
      userUuid = userRows[0].uuid || ''
    }
  } catch (e) {
    console.error('User lookup failed:', e)
  }

  // Upsert order
  try {
    // Try update existing
    const existing = await db.select().from(orders).where(eq(orders.order_no, orderNo)).limit(1)
    if (existing && existing[0]) {
      await db.update(orders).set({
        status: 'paid',
        amount,
        currency,
        product_id: productId,
        product_name: productName,
        paid_at: new Date(),
        paid_email: customerEmail,
      }).where(eq(orders.order_no, orderNo))
      console.log('[Creem][Webhook] Updated existing order to paid:', orderNo)
    } else {
      await db.insert(orders).values({
        order_no: orderNo,
        created_at: new Date(),
        user_uuid: userUuid || '',
        user_email: customerEmail || '',
        amount,
        status: 'paid',
        credits: 0,
        currency,
        product_id: productId,
        product_name: productName,
        paid_at: new Date(),
        paid_email: customerEmail || '',
      })
      console.log('[Creem][Webhook] Created new paid order:', orderNo)
    }
  } catch (e) {
    console.error('Order upsert failed:', e)
  }

  // Optional: award credits based on mapping
  try {
    // @ts-ignore
    const mapStr = (c.env as any).CREEM_PRODUCT_CREDIT_MAP as string | undefined
    if (mapStr && productId) {
      const mapping = JSON.parse(mapStr) as Record<string, number>
      const credits = mapping[productId]
      if (credits && userUuid) {
        const creditsService = new CreditsService(createDb(c.env))
        await creditsService.addCredits({
          user_uuid: userUuid,
          trans_type: 'purchase',
          credits,
          order_no: orderNo,
        })
        // Also update order credits
        await createDb(c.env).update(orders).set({ credits }).where(eq(orders.order_no, orderNo))
        console.log('[Creem][Webhook] Awarded credits:', { orderNo, credits, userUuid })
      }
    }
  } catch (e) {
    console.error('Credit award failed:', e)
  }
}

// Helper function to handle failed, cancelled, or expired checkouts
async function handleCheckoutFailed(event: any, c: any, eventType: string) {
  const obj = event.object || {}
  const orderObj = obj.order || {}
  const productObj = obj.product || {}
  const customerObj = obj.customer || {}

  const orderNo = orderObj.id || obj.id
  const customerEmail = customerObj?.email || ''
  const failureReason = obj.failure_reason || obj.cancellation_reason || eventType

  console.log('[Creem][Webhook] Processing failed checkout:', {
    eventType,
    orderNo,
    customerEmail,
    failureReason
  })

  if (!orderNo) {
    console.log('[Creem][Webhook] No order ID found in failed event, skipping database update')
    return
  }

  const db = createDb(c.env)

  // Update order status to failed/cancelled using existing fields
  try {
    const existing = await db.select().from(orders).where(eq(orders.order_no, orderNo)).limit(1)
    if (existing && existing[0]) {
      let status = 'failed'
      if (eventType === 'checkout.cancelled') {
        status = 'cancelled'
      } else if (eventType === 'checkout.expired') {
        status = 'expired'
      }

      // Use paid_detail to store failure information
      const failureDetail = JSON.stringify({
        failed_at: new Date().toISOString(),
        failure_reason: failureReason || eventType,
        event_type: eventType
      })

      await db.update(orders).set({
        status,
        paid_detail: failureDetail,
      }).where(eq(orders.order_no, orderNo))
      
      console.log('[Creem][Webhook] Updated order status to failed:', { orderNo, status, failureReason })
    } else {
      // Create failed order record if it doesn't exist
      const amount = orderObj.amount || 0
      const currency = orderObj.currency || productObj.currency || null
      const productId = typeof obj.product === 'string' ? obj.product : (productObj?.id || null)
      const productName = productObj?.name || null

      let status = 'failed'
      if (eventType === 'checkout.cancelled') {
        status = 'cancelled'
      } else if (eventType === 'checkout.expired') {
        status = 'expired'
      }

      // Use paid_detail to store failure information
      const failureDetail = JSON.stringify({
        failed_at: new Date().toISOString(),
        failure_reason: failureReason || eventType,
        event_type: eventType
      })

      await db.insert(orders).values({
        order_no: orderNo,
        created_at: new Date(),
        user_uuid: '',
        user_email: customerEmail || '',
        amount,
        status,
        credits: 0,
        currency,
        product_id: productId,
        product_name: productName,
        paid_detail: failureDetail,
      })
      
      console.log('[Creem][Webhook] Created new failed order:', { orderNo, status, failureReason })
    }
  } catch (e) {
    console.error('[Creem][Webhook] Failed order update failed:', e)
  }
}

// Helper function to handle subscription.active event
async function handleSubscriptionActive(event: any, c: any) {
  const obj = event.object || {}
  const subscriptionId = obj.id || ''
  const productObj = obj.product || {}
  const customerObj = obj.customer || {}
  
  console.log('[Creem][Webhook] Processing subscription.active:', {
    subscriptionId,
    status: obj.status,
    productId: productObj.id,
    customerEmail: customerObj.email
  })
  
  // For subscription.active, we typically just log it since subscription.paid is the main event
  // that triggers credit awards and access grants
}

// Helper function to handle subscription.paid event
async function handleSubscriptionPaid(event: any, c: any) {
  const obj = event.object || {}
  const subscriptionId = obj.id || ''
  const productObj = obj.product || {}
  const customerObj = obj.customer || {}
  const transactionId = obj.last_transaction_id || ''
  const amount = productObj.price || 0
  const currency = productObj.currency || null
  const productId = productObj.id || null
  const productName = productObj.name || null
  const customerEmail = customerObj.email || ''
  
  console.log('[Creem][Webhook] Processing subscription.paid:', {
    subscriptionId,
    transactionId,
    amount,
    currency,
    productId,
    customerEmail
  })
  
  const db = createDb(c.env)
  
  // Find or create user by email
  let userUuid: string = ''
  try {
    const userRows = await db.select().from(users).where(eq(users.email, customerEmail)).limit(1)
    if (userRows && userRows[0]) {
      // @ts-ignore
      userUuid = userRows[0].uuid || ''
    }
  } catch (e) {
    console.error('User lookup failed:', e)
  }
  
  // Try to find a pending order created at checkout stage (ord_...) to convert into paid
  // First, try to match using checkout metadata if available
  let pendingOrder = null
  try {
    // Check if we have metadata with request_id for exact correlation
    const eventMetadata = obj.metadata || {}
    const checkoutRequestId = eventMetadata.internal_request_id || eventMetadata.request_id
    
    console.log('[Creem][Webhook] Attempting pending order correlation:', {
      hasMetadata: !!eventMetadata,
      checkoutRequestId,
      customerEmail,
      productId
    })
    
    if (checkoutRequestId) {
      // Try exact match first using request_id stored in paid_detail
      const exactMatches = await db
        .select()
        .from(orders)
        .where(
          and(
            eq(orders.user_email, customerEmail || ''),
            eq(orders.status, 'pending')
          )
        )
        .orderBy(desc(orders.created_at))
        
      // Filter by request_id in paid_detail
      for (const order of exactMatches) {
        try {
          if ((order as any).paid_detail) {
            const detail = JSON.parse((order as any).paid_detail)
            if (detail.request_id === checkoutRequestId) {
              pendingOrder = order
              console.log('[Creem][Webhook] Found exact match via request_id:', {
                order_no: (order as any).order_no,
                request_id: detail.request_id
              })
              break
            }
          }
        } catch (e) {
          // Skip orders with invalid JSON
          continue
        }
      }
    }
    
    // Fallback to existing logic if no exact match found
    if (!pendingOrder) {
      console.log('[Creem][Webhook] No exact match found, using fallback logic')
      const pending = await db
        .select()
        .from(orders)
        .where(
          and(
            eq(orders.user_email, customerEmail || ''),
            eq(orders.product_id as any, productId as any),
            eq(orders.status, 'pending')
          )
        )
        .orderBy(desc(orders.created_at))
        .limit(1)
        
      if (pending && pending[0]) {
        pendingOrder = pending[0]
        console.log('[Creem][Webhook] Using fallback match:', {
          order_no: (pendingOrder as any).order_no,
          method: 'email_product_match'
        })
      }
    }

    if (pendingOrder) {
      const pendingOrderNo = (pendingOrder as any).order_no
      await db.update(orders).set({
        status: 'paid',
        amount,
        currency,
        product_id: productId || undefined,
        product_name: productName || undefined,
        paid_at: new Date(),
        paid_email: customerEmail || '',
        sub_id: subscriptionId || null,
        paid_detail: JSON.stringify({
          ...(pendingOrder as any).paid_detail ? (() => { try { return JSON.parse((pendingOrder as any).paid_detail) } catch { return {} } })() : {},
          subscription_id: subscriptionId,
          transaction_id: transactionId,
          event_type: 'subscription.paid',
          current_period_start: obj.current_period_start_date,
          current_period_end: obj.current_period_end_date,
          next_transaction_date: obj.next_transaction_date
        })
      }).where(eq(orders.order_no, pendingOrderNo))

      console.log('[Creem][Webhook] Matched pending checkout order and marked paid:', { pendingOrderNo, subscriptionId, transactionId })

      // Award credits based on product mapping for the matched order
      try {
        // @ts-ignore
        const mapStr = (c.env as any).CREEM_PRODUCT_CREDIT_MAP as string | undefined
        if (mapStr && productId && userUuid) {
          const mapping = JSON.parse(mapStr) as Record<string, number>
          const credits = mapping[productId]
          if (credits) {
            const creditsService = new CreditsService(createDb(c.env))
            await creditsService.addCredits({
              user_uuid: userUuid,
              trans_type: 'subscription',
              credits,
              order_no: pendingOrderNo,
            })
            // Update order credits
            await createDb(c.env).update(orders).set({ credits }).where(eq(orders.order_no, pendingOrderNo))
            console.log('[Creem][Webhook] Awarded subscription credits (matched pending):', { orderNo: pendingOrderNo, credits, userUuid })
          }
        }
      } catch (e) {
        console.error('Subscription credit award (matched pending) failed:', e)
      }

      // Done - we used the pending order, so skip creating a tran_ order
      return
    }
  } catch (e) {
    console.error('Lookup pending order failed:', e)
  }

  // No pending order found -> Create order record for this subscription payment using transaction_id
  const orderNo = transactionId || `sub_${subscriptionId}_${Date.now()}`
  
  try {
    // Check if we already processed this transaction
    const existing = await db.select().from(orders).where(eq(orders.order_no, orderNo)).limit(1)
    if (existing && existing[0]) {
      console.log('[Creem][Webhook] Subscription payment already processed:', orderNo)
      return
    }
    
    // Create new subscription payment order
    await db.insert(orders).values({
      order_no: orderNo,
      created_at: new Date(),
      user_uuid: userUuid || '',
      user_email: customerEmail || '',
      amount,
      status: 'paid',
      credits: 0, // Will be updated after credit award
      currency,
      product_id: productId,
      product_name: productName,
      paid_at: new Date(),
      paid_email: customerEmail || '',
      sub_id: subscriptionId || null,
      paid_detail: JSON.stringify({
        subscription_id: subscriptionId,
        transaction_id: transactionId,
        event_type: 'subscription.paid',
        current_period_start: obj.current_period_start_date,
        current_period_end: obj.current_period_end_date,
        next_transaction_date: obj.next_transaction_date
      })
    })
    console.log('[Creem][Webhook] Created subscription payment order:', orderNo)
  } catch (e) {
    console.error('Subscription payment order creation failed:', e)
  }
  
  // Award credits based on product mapping
  try {
    // @ts-ignore
    const mapStr = (c.env as any).CREEM_PRODUCT_CREDIT_MAP as string | undefined
    if (mapStr && productId) {
      const mapping = JSON.parse(mapStr) as Record<string, number>
      const credits = mapping[productId]
      if (credits && userUuid) {
        const creditsService = new CreditsService(createDb(c.env))
        await creditsService.addCredits({
          user_uuid: userUuid,
          trans_type: 'subscription',
          credits,
          order_no: orderNo,
        })
        // Update order credits
        await createDb(c.env).update(orders).set({ credits }).where(eq(orders.order_no, orderNo))
        console.log('[Creem][Webhook] Awarded subscription credits:', { orderNo, credits, userUuid })
      }
    }
  } catch (e) {
    console.error('Subscription credit award failed:', e)
  }
}

// Helper function to handle subscription.canceled event
async function handleSubscriptionCanceled(event: any, c: any) {
  const obj = event.object || {}
  const subscriptionId = obj.id || ''
  const customerObj = obj.customer || {}
  const customerEmail = customerObj.email || ''
  
  console.log('[Creem][Webhook] Processing subscription.canceled:', {
    subscriptionId,
    customerEmail,
    canceledAt: obj.canceled_at
  })
  
  // Here you might want to:
  // 1. Update user permissions/access
  // 2. Send cancellation email
  // 3. Log the cancellation for analytics
  // For now, just log it
}

// Helper function to handle subscription.expired event
async function handleSubscriptionExpired(event: any, c: any) {
  const obj = event.object || {}
  const subscriptionId = obj.id || ''
  const customerObj = obj.customer || {}
  const customerEmail = customerObj.email || ''
  
  console.log('[Creem][Webhook] Processing subscription.expired:', {
    subscriptionId,
    customerEmail,
    status: obj.status
  })
  
  // Handle expired subscription - might trigger payment retries
}

// Helper function to handle subscription.paused event
async function handleSubscriptionPaused(event: any, c: any) {
  const obj = event.object || {}
  const subscriptionId = obj.id || ''
  
  console.log('[Creem][Webhook] Processing subscription.paused:', {
    subscriptionId,
    status: obj.status
  })
}

// Helper function to handle subscription.update event
async function handleSubscriptionUpdate(event: any, c: any) {
  const obj = event.object || {}
  const subscriptionId = obj.id || ''
  
  console.log('[Creem][Webhook] Processing subscription.update:', {
    subscriptionId,
    status: obj.status
  })
}

// Helper function to handle subscription.trialing event
async function handleSubscriptionTrialing(event: any, c: any) {
  const obj = event.object || {}
  const subscriptionId = obj.id || ''
  
  console.log('[Creem][Webhook] Processing subscription.trialing:', {
    subscriptionId,
    status: obj.status
  })
}

// Helper function to handle refund.created event
async function handleRefundCreated(event: any, c: any) {
  const obj = event.object || {}
  const refundId = obj.id || ''
  const transactionObj = obj.transaction || {}
  const subscriptionObj = obj.subscription || {}
  
  console.log('[Creem][Webhook] Processing refund.created:', {
    refundId,
    refundAmount: obj.refund_amount,
    transactionId: transactionObj.id,
    subscriptionId: subscriptionObj.id,
    reason: obj.reason
  })
  
  // Handle refund - might need to deduct credits or update order status
}

// Helper function to handle dispute.created event
async function handleDisputeCreated(event: any, c: any) {
  const obj = event.object || {}
  const disputeId = obj.id || ''
  const transactionObj = obj.transaction || {}
  
  console.log('[Creem][Webhook] Processing dispute.created:', {
    disputeId,
    disputeAmount: obj.amount,
    transactionId: transactionObj.id,
    currency: obj.currency
  })
  
  // Handle dispute - might need to freeze account or investigate
}

export default payments

