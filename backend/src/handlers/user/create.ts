import { APIGatewayProxyWithCognitoAuthorizerHandler } from 'aws-lambda';
import { User, UserType } from '../../models/user';
import { DateTime } from 'luxon';
import commonMiddleware from '../../middlewares/commomMiddleware';
import createError from 'http-errors';
import { APIGatewayProxyResult, APIGatewayProxyWithCognitoAuthorizerEvent } from 'aws-lambda/trigger/api-gateway-proxy';

const createUser: APIGatewayProxyWithCognitoAuthorizerHandler = async (
  event: APIGatewayProxyWithCognitoAuthorizerEvent
): Promise<APIGatewayProxyResult> => {
  const body = event.body as Partial<UserType>;

  body.createdAt = DateTime.now().toString();
  body.updatedAt = DateTime.now().toString();

  try {
    const userModel = new User();
    const createdUser = await userModel.create(body as UserType);

    return {
      statusCode: 201,
      body: JSON.stringify(createdUser)
    };
  } catch (e) {
    throw new createError.BadRequest(e.message);
  }
};

export const handler: APIGatewayProxyWithCognitoAuthorizerHandler = commonMiddleware(createUser);
