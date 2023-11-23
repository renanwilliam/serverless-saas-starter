import { APIGatewayProxyWithCognitoAuthorizerHandler } from 'aws-lambda';
import commonMiddleware from '../../middlewares/commomMiddleware';
import createError from 'http-errors';
import { Cognito } from '../../lib/cognito';
import { User } from '../../models/user';
import { APIGatewayProxyResult, APIGatewayProxyWithCognitoAuthorizerEvent } from 'aws-lambda/trigger/api-gateway-proxy';

const createUser: APIGatewayProxyWithCognitoAuthorizerHandler = async (
  event: APIGatewayProxyWithCognitoAuthorizerEvent
): Promise<APIGatewayProxyResult> => {
  const { identityId, credentialsProvider } = await Cognito.getIdentityDetailsFromEventIdToken(event);

  try {
    const userModel = new User(credentialsProvider);
    const stats = await userModel.getStats(identityId);

    return {
      statusCode: 200,
      body: JSON.stringify(stats)
    };
  } catch (e) {
    throw new createError.BadRequest(e.message);
  }
};

export const handler: APIGatewayProxyWithCognitoAuthorizerHandler = commonMiddleware(createUser);
