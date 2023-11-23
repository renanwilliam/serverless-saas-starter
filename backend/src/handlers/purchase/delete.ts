import { APIGatewayProxyWithCognitoAuthorizerHandler } from 'aws-lambda';
import { Purchase } from '../../models/purchase';
import createError from 'http-errors';
import commonMiddleware from '../../middlewares/commomMiddleware';
import { APIGatewayProxyResult, APIGatewayProxyWithCognitoAuthorizerEvent } from 'aws-lambda/trigger/api-gateway-proxy';
import { Cognito } from '../../lib/cognito';

const deletePurchase: APIGatewayProxyWithCognitoAuthorizerHandler = async (
  event: APIGatewayProxyWithCognitoAuthorizerEvent
): Promise<APIGatewayProxyResult> => {
  const { identityId, credentialsProvider } = await Cognito.getIdentityDetailsFromEventIdToken(event);
  const { purchaseId, userId } = <{ purchaseId: string; userId: string }>event.pathParameters;

  try {
    const purchaseModel = new Purchase(identityId, credentialsProvider);
    await purchaseModel.delete(purchaseId);

    return {
      statusCode: 204,
      body: ''
    };
  } catch (e) {
    throw new createError.BadRequest(e.message);
  }
};

export const handler: APIGatewayProxyWithCognitoAuthorizerHandler = commonMiddleware(deletePurchase);
