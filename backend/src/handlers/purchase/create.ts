import { APIGatewayProxyWithCognitoAuthorizerHandler } from 'aws-lambda';
import { Purchase, PurchaseType } from '../../models/purchase';
import { ulid } from 'ulid';
import { DateTime } from 'luxon';
import commonMiddleware from '../../middlewares/commomMiddleware';
import createError from 'http-errors';
import { APIGatewayProxyResult, APIGatewayProxyWithCognitoAuthorizerEvent } from 'aws-lambda/trigger/api-gateway-proxy';
import { Cognito } from '../../lib/cognito';

const createPurchase: APIGatewayProxyWithCognitoAuthorizerHandler = async (
  event: APIGatewayProxyWithCognitoAuthorizerEvent
): Promise<APIGatewayProxyResult> => {
  const { identityId, credentialsProvider } = await Cognito.getIdentityDetailsFromEventIdToken(event);
  const email = await Cognito.getEmailFromEventIdToken(event);

  const body = event.body as Partial<PurchaseType>;
  body.id = ulid();
  body.userId = identityId;
  body.createdAt = DateTime.now().toString();
  body.updatedAt = DateTime.now().toString();

  try {
    const purchaseModel = new Purchase(identityId, credentialsProvider);
    const createdPurchase = await purchaseModel.createUsingStripe(body as PurchaseType, email);

    return {
      statusCode: 201,
      body: JSON.stringify(createdPurchase)
    };
  } catch (e) {
    throw new createError.BadRequest(e.message);
  }
};

export const handler: APIGatewayProxyWithCognitoAuthorizerHandler = commonMiddleware(createPurchase);
