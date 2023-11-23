/**
 * Source: https://bobbyhadz.com/blog/aws-cognito-link-user-accounts
 */
import {
  AdminAddUserToGroupCommandOutput,
  AdminCreateUserCommandOutput,
  AdminLinkProviderForUserCommandOutput,
  AdminSetUserPasswordCommandOutput,
  CognitoIdentityProvider,
  ListUsersCommandOutput
} from '@aws-sdk/client-cognito-identity-provider';

import { generator } from 'ts-password-generator';

export const listUsersByEmail = async ({
  userPoolId,
  email
}: {
  userPoolId: string;
  email: string;
}): Promise<ListUsersCommandOutput> => {
  const params = {
    UserPoolId: userPoolId,
    Filter: `email = "${email}"`
  };

  const cognitoIdp = new CognitoIdentityProvider();
  return cognitoIdp.listUsers(params);
};

export const adminLinkUserAccounts = async ({
  username,
  userPoolId,
  providerName,
  providerUserId
}: {
  username: string;
  userPoolId: string;
  providerName: string;
  providerUserId: string;
}): Promise<AdminLinkProviderForUserCommandOutput> => {
  const params = {
    DestinationUser: {
      ProviderAttributeValue: username,
      ProviderName: 'Cognito'
    },
    SourceUser: {
      ProviderAttributeName: 'Cognito_Subject',
      ProviderAttributeValue: providerUserId,
      ProviderName: providerName
    },
    UserPoolId: userPoolId
  };

  const cognitoIdp = new CognitoIdentityProvider();
  return new Promise((resolve, reject) => {
    cognitoIdp.adminLinkProviderForUser(params, (err, data) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(data);
    });
  });
};

export const adminCreateUser = async ({
  userPoolId,
  email,
  name
}: {
  userPoolId: string;
  email: string;
  name: string;
}): Promise<AdminCreateUserCommandOutput> => {
  const cognitoIdp = new CognitoIdentityProvider();
  return cognitoIdp.adminCreateUser({
    UserPoolId: userPoolId,
    // SUPRESS prevents sending an email with the temporary password
    // to the user on account creation
    MessageAction: 'SUPPRESS',
    Username: email,
    UserAttributes: [
      {
        Name: 'name',
        Value: name
      },
      {
        Name: 'email',
        Value: email
      },
      {
        Name: 'email_verified',
        Value: 'true'
      }
    ]
  });
};

export const adminSetUserPassword = async ({
  userPoolId,
  email
}: {
  userPoolId: string;
  email: string;
}): Promise<AdminSetUserPasswordCommandOutput> => {
  const params = {
    Password: generatePassword(),
    UserPoolId: userPoolId,
    Username: email,
    Permanent: true
  };

  const cognitoIdp = new CognitoIdentityProvider();
  return cognitoIdp.adminSetUserPassword(params);
};

function capitalized(word: string) {
  return `${word.charAt(0).toUpperCase()}${word.slice(1)}`;
}

function generatePassword() {
  return generator({
    haveNumbers: true,
    haveSymbols: true,
    isUppercase: true
  });
}

export function adminAddUserToGroup({
  userPoolId,
  username,
  groupName
}: {
  userPoolId: string;
  username: string;
  groupName: string;
}): Promise<AdminAddUserToGroupCommandOutput> {
  const params = {
    GroupName: groupName,
    UserPoolId: userPoolId,
    Username: username
  };

  const cognitoIdp = new CognitoIdentityProvider();
  return cognitoIdp.adminAddUserToGroup(params);
}
