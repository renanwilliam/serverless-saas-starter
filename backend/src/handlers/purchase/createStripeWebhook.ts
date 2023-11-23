import { APIGatewayEvent, APIGatewayProxyHandler } from 'aws-lambda';
import { APIGatewayProxyResult } from 'aws-lambda/trigger/api-gateway-proxy';
import Stripe from 'stripe';
import { Purchase } from '../../models/purchase';
import middy from '@middy/core';
import httpHeaderNormalizer from '@middy/http-header-normalizer';
import httpEventNormalizer from '@middy/http-event-normalizer';
import { DateTime } from 'luxon';
import { SendMessageCommand, SQSClient } from '@aws-sdk/client-sqs';

const STRIPE_API_KEY: string = process.env.STRIPE_API_KEY || '';
const STRIPE_INTEGRATION_WEBHOOK_SECRET: string = process.env.STRIPE_INTEGRATION_WEBHOOK_SECRET || '';

const createStripeWebhook: APIGatewayProxyHandler = async (event: APIGatewayEvent): Promise<APIGatewayProxyResult> => {
  if (!event.headers.hasOwnProperty('Stripe-Signature')) {
    return {
      statusCode: 403,
      body: 'Stripe signature header not found'
    };
  }

  const stripe = new Stripe(STRIPE_API_KEY);

  let stripeEvent: Stripe.Event;
  try {
    stripeEvent = stripe.webhooks.constructEvent(
      event.body as string,
      event.headers['Stripe-Signature'] as string,
      STRIPE_INTEGRATION_WEBHOOK_SECRET
    );
  } catch (err) {
    return {
      statusCode: 403,
      body: 'Invalid stripe signature'
    };
  }

  // Handle the event
  switch (stripeEvent.type) {
    case 'checkout.session.completed':
    case 'checkout.session.async_payment_succeeded':
      const checkoutSessionAsyncPaymentSucceeded = stripeEvent.data.object as any;
      const { client_reference_id, metadata } = checkoutSessionAsyncPaymentSucceeded;

      if (checkoutSessionAsyncPaymentSucceeded.payment_status !== 'paid') {
        return {
          statusCode: 200,
          body: 'Skipping, the value is not paid'
        };
      }

      const purchaseModel = new Purchase(metadata.CUSTOMER_ID);
      const purchase = await purchaseModel.findOne(client_reference_id);
      if (purchase) {
        await purchaseModel.update(client_reference_id, {
          status: 'PAID',
          amount: checkoutSessionAsyncPaymentSucceeded.amount_total,
          currency: checkoutSessionAsyncPaymentSucceeded.currency.toUpperCase(),
          updatedAt: DateTime.now().toString()
        });
        await purchaseModel.removeTimeToLive(client_reference_id);

        const sqsClient = new SQSClient({});
        await sqsClient.send(
          new SendMessageCommand({
            QueueUrl: process.env.QUEUE_URL,
            MessageBody: JSON.stringify({})
          })
        );
      }
      break;
    // ... handle other event types
    default:
      console.log(`Unhandled event type ${stripeEvent.type}`);
  }

  return {
    statusCode: 200,
    body: ''
  };
};

export const handler: APIGatewayProxyHandler = middy(createStripeWebhook).use([
  httpHeaderNormalizer({
    canonical: true
  }),
  httpEventNormalizer()
]);
