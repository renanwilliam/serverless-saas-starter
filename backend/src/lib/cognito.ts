import { AdminCreateUserCommand, CognitoIdentityProviderClient } from '@aws-sdk/client-cognito-identity-provider';
import { UserType } from '../models/user';
import { CognitoIdentityClient, GetIdCommand } from '@aws-sdk/client-cognito-identity';
import { APIGatewayProxyWithCognitoAuthorizerEvent } from 'aws-lambda/trigger/api-gateway-proxy';
import jwt from 'jsonwebtoken';
import { CognitoIdentityCredentialProvider, fromCognitoIdentity } from '@aws-sdk/credential-providers';

export class Cognito {
  public static async getEmailFromEventIdToken(
    event: APIGatewayProxyWithCognitoAuthorizerEvent
  ): Promise<string | undefined> {
    const authorization = event.headers.Authorization as string;
    const jwtIdToken = authorization.replace('Bearer ', '');

    let email = undefined;
    if (jwtIdToken) {
      const decodedIdToken: any = jwt.decode(jwtIdToken);
      if (decodedIdToken) {
        email = decodedIdToken['email'];
      }
    }
    return email;
  }

  public static async getIdentityDetailsFromEventIdToken(event: APIGatewayProxyWithCognitoAuthorizerEvent): Promise<{
    identityId: string;
    credentialsProvider: CognitoIdentityCredentialProvider;
  }> {
    const issClaim = event.requestContext.authorizer.claims.iss as string;
    const authorization = event.headers.Authorization as string;

    const iss = issClaim.replace('https://', '');
    const jwt = authorization.replace('Bearer ', '');

    const cognito = new Cognito();
    const identityId = await cognito.getUserIdentityId(iss, jwt);
    const credentialsProvider = await cognito.getCredentialsForIdentity(identityId, iss, jwt);

    return { identityId, credentialsProvider };
  }

  async createUser(user: UserType) {
    const client = new CognitoIdentityProviderClient({});
    const cognitoCommand = new AdminCreateUserCommand({
      UserPoolId: process.env.COGNITO_USER_POOL_ID,
      Username: user.email,
      UserAttributes: [
        {
          Name: 'name',
          Value: user.name
        },
        {
          Name: 'email',
          Value: user.email
        },
        {
          Name: 'custom:channel',
          Value: user.channel
        }
      ],
      ForceAliasCreation: true,
      DesiredDeliveryMediums: ['EMAIL']
    });
    const cognitoResponse = await client.send(cognitoCommand);

    return cognitoResponse.User;
  }

  async getUserIdentityId(provider: string, jwt: string) {
    const client = new CognitoIdentityClient({});
    const getIdInput = {
      IdentityPoolId: `${process.env.COGNITO_IDENTITY_POOL_ID}`,
      Logins: {
        [provider]: jwt
      }
    };
    const getIdCommand = new GetIdCommand(getIdInput);
    const getIdResponse = await client.send(getIdCommand);

    return getIdResponse.IdentityId as string;
  }

  async getCredentialsForIdentity(identityId: string, provider: string, jwt: string) {
    return fromCognitoIdentity({
      identityId: identityId,
      logins: {
        [provider]: jwt
      }
    });
  }
}
