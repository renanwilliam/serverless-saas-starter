import { APIGatewayProxyWithCognitoAuthorizerHandler } from 'aws-lambda';
import { Purchase } from '../../models/purchase';
import createError from 'http-errors';
import commonMiddleware from '../../middlewares/commomMiddleware';
import { APIGatewayProxyResult, APIGatewayProxyWithCognitoAuthorizerEvent } from 'aws-lambda/trigger/api-gateway-proxy';
import { Cognito } from '../../lib/cognito';
import { getFilterAndSortersFromEvent } from '../../lib/utils';

const findAllPurchases: APIGatewayProxyWithCognitoAuthorizerHandler = async (
  event: APIGatewayProxyWithCognitoAuthorizerEvent
): Promise<APIGatewayProxyResult> => {
  const { identityId, credentialsProvider } = await Cognito.getIdentityDetailsFromEventIdToken(event);

  try {
    const { filters, sorters } = getFilterAndSortersFromEvent(event);

    const purchaseModel = new Purchase(identityId, credentialsProvider);
    const purchases = await purchaseModel.queryAll(filters, sorters, event.queryStringParameters?.lastEvaluatedKey);

    return {
      statusCode: 200,
      body: JSON.stringify(purchases)
    };
  } catch (e) {
    throw new createError.BadRequest(e.message);
  }
};

export const handler: APIGatewayProxyWithCognitoAuthorizerHandler = commonMiddleware(findAllPurchases);
