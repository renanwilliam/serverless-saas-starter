import { APIGatewayProxyWithCognitoAuthorizerHandler } from 'aws-lambda';
import { Purchase, PurchaseType } from '../../models/purchase';
import { DateTime } from 'luxon';
import commonMiddleware from '../../middlewares/commomMiddleware';
import createError from 'http-errors';
import { Cognito } from '../../lib/cognito';
import { APIGatewayProxyResult, APIGatewayProxyWithCognitoAuthorizerEvent } from 'aws-lambda/trigger/api-gateway-proxy';

const updatePurchase: APIGatewayProxyWithCognitoAuthorizerHandler = async (
  event: APIGatewayProxyWithCognitoAuthorizerEvent
): Promise<APIGatewayProxyResult> => {
  const { identityId, credentialsProvider } = await Cognito.getIdentityDetailsFromEventIdToken(event);

  const { purchaseId } = <{ purchaseId: string }>event.pathParameters;
  const body = event.body as Partial<PurchaseType>;

  body.updatedAt = DateTime.now().toString();

  try {
    const purchaseModel = new Purchase(identityId, credentialsProvider);
    const updatedPurchase = await purchaseModel.update(purchaseId, body);

    return {
      statusCode: 200,
      body: JSON.stringify(updatedPurchase)
    };
  } catch (e) {
    throw new createError.BadRequest(e.message);
  }
};

export const handler: APIGatewayProxyWithCognitoAuthorizerHandler = commonMiddleware(updatePurchase);
