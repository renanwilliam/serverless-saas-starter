import { APIGatewayProxyWebsocketHandlerV2 } from 'aws-lambda';
import { Cognito } from '../../lib/cognito';
import jwt from 'jsonwebtoken';
import middy from '@middy/core';
import httpHeaderNormalizer from '@middy/http-header-normalizer';
import { User } from '../../models/user';
import { CognitoIdentityCredentialProvider } from '@aws-sdk/credential-providers';

const userWebsocket: APIGatewayProxyWebsocketHandlerV2 = async (event, context) => {
  const { requestContext } = event;
  const { identityId, credentialsProvider } = await getIdentityDetailsFromEventIdToken(
    requestContext as unknown as RequestContext
  );

  const {
    body,
    requestContext: { connectionId, routeKey, domainName }
  } = event;

  const userModel = new User(credentialsProvider);
  switch (routeKey) {
    case '$connect':
      await userModel.saveWebsocketConnection(identityId, connectionId, domainName);
      break;
    case '$disconnect':
      await userModel.deleteWebsocketConnection(identityId, connectionId);
      break;
    case '$default':
    default:
      console.log('$default', JSON.stringify(event, null, 2));
  }

  return {
    statusCode: 200
  };
};

type RequestContext = {
  authorizer: {
    identityId: string;
    principalId: string;
    jwtToken: string;
  };
};

const getIdentityDetailsFromEventIdToken: (requestContext: RequestContext) => Promise<{
  identityId: string;
  credentialsProvider: CognitoIdentityCredentialProvider;
}> = async (requestContext: RequestContext) => {
  const jwtStrToken = requestContext.authorizer.jwtToken;

  const jwtToken: any = jwt.decode(jwtStrToken);
  let { iss } = jwtToken;

  iss = iss.replace('https://', '');

  const cognito = new Cognito();
  const { identityId } = requestContext.authorizer;
  const credentialsProvider = await cognito.getCredentialsForIdentity(identityId, iss, jwtStrToken);

  return { identityId, credentialsProvider };
};

export const handler = middy(userWebsocket).use([
  httpHeaderNormalizer({
    canonical: true
  })
]);
