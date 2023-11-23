import { APIGatewayProxyWithCognitoAuthorizerHandler } from 'aws-lambda';
import { Purchase } from '../../models/purchase';
import createError from 'http-errors';
import commonMiddleware from '../../middlewares/commomMiddleware';
import { APIGatewayProxyResult, APIGatewayProxyWithCognitoAuthorizerEvent } from 'aws-lambda/trigger/api-gateway-proxy';
import { Cognito } from '../../lib/cognito';

const findOnePurchase: APIGatewayProxyWithCognitoAuthorizerHandler = async (
  event: APIGatewayProxyWithCognitoAuthorizerEvent
): Promise<APIGatewayProxyResult> => {
  const { identityId, credentialsProvider } = await Cognito.getIdentityDetailsFromEventIdToken(event);
  const { purchaseId } = <{ purchaseId: string }>event.pathParameters;

  try {
    const purchaseModel = new Purchase(identityId, credentialsProvider);
    const purchase = await purchaseModel.findOne(purchaseId);

    if (purchase) {
      return {
        statusCode: 200,
        body: JSON.stringify(purchase)
      };
    }
    return {
      statusCode: 404,
      body: ''
    };
  } catch (e) {
    throw new createError.BadRequest(e.message);
  }
};

export const handler: APIGatewayProxyWithCognitoAuthorizerHandler = commonMiddleware(findOnePurchase);
