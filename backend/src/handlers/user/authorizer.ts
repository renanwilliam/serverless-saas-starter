import {
  APIGatewayAuthorizerResult,
  APIGatewayRequestAuthorizerEvent,
  APIGatewayTokenAuthorizerEvent,
  PolicyDocument,
  Statement
} from 'aws-lambda';
import jwt from 'jsonwebtoken';
import jwtToPem from 'jwk-to-pem';
import got from 'got';
import { Cognito } from '../../lib/cognito';

export const handler = async (event: APIGatewayRequestAuthorizerEvent): Promise<APIGatewayAuthorizerResult> => {
  let modifiedEvent: any;
  if (event.queryStringParameters && event.queryStringParameters.Auth) {
    modifiedEvent = {
      ...event,
      authorizationToken: event.queryStringParameters.Auth
    };
  } else {
    modifiedEvent = {
      ...event
    };
  }

  try {
    return await verifyJwtToken(modifiedEvent);
  } catch (e) {
    return generatePolicy({ sub: 'nobody' }, 'Deny', event.methodArn);
  }
};

const generatePolicy = (
  jwtToken: Record<string, any>,
  effect: string,
  resource: string | string[],
  context: any = null
): APIGatewayAuthorizerResult => {
  let authResponse: APIGatewayAuthorizerResult = <APIGatewayAuthorizerResult>{};

  authResponse.principalId = jwtToken.sub;
  if (effect && resource) {
    let policyDocument: PolicyDocument = <PolicyDocument>{};

    policyDocument.Version = '2012-10-17';
    policyDocument.Statement = [];

    let statementOne: any = <Statement>{};
    statementOne.Action = 'execute-api:Invoke';
    statementOne.Effect = effect;
    statementOne.Resource = resource;

    policyDocument.Statement[0] = statementOne;
    authResponse.policyDocument = policyDocument;
  }

  if (typeof context !== 'undefined') {
    authResponse.context = context;
  }

  return authResponse;
};

async function verifyJwtToken(event: APIGatewayTokenAuthorizerEvent) {
  const strToken = event.authorizationToken;
  if (!strToken) {
    return generatePolicy({ sub: 'nobody' }, 'Deny', event.methodArn);
  }
  const jwtToken: any = jwt.decode(strToken);
  const { iss } = jwtToken;

  const response = await got(`${iss}/.well-known/jwks.json`);

  if (response.statusCode !== 200) {
    return generatePolicy(jwtToken, 'Deny', event.methodArn);
  }

  const cognitoUserPoolKey = JSON.parse(response.body).keys[0];
  const jwkArray = {
    kty: cognitoUserPoolKey.kty,
    n: cognitoUserPoolKey.n,
    e: cognitoUserPoolKey.e
  };
  const pem = jwtToPem(jwkArray);

  try {
    jwt.verify(strToken, pem, { algorithms: ['RS256'] });

    const cognito = new Cognito();
    const identityId = await cognito.getUserIdentityId(iss.replace('https://', ''), strToken);

    return generatePolicy(jwtToken, 'Allow', event.methodArn, {
      jwtToken: strToken,
      identityId
    });
  } catch (e) {
    return generatePolicy(jwtToken, 'Deny', event.methodArn);
  }
}

export default handler;
