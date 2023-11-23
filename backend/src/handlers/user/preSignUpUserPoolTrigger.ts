/**
 * Source: https://bobbyhadz.com/blog/aws-cognito-link-user-accounts
 */
import { Callback, Context, PreSignUpTriggerEvent } from 'aws-lambda';
import { adminCreateUser, adminLinkUserAccounts, adminSetUserPassword, listUsersByEmail } from '../../lib/preSignUp';

export async function handler(event: PreSignUpTriggerEvent, _context: Context, callback: Callback): Promise<void> {
  try {
    const {
      triggerSource,
      userPoolId,
      userName,
      request: {
        // You won't have given_name and family_name attributes
        // if you haven't specified them as required when the user registers
        userAttributes: { email, name }
      }
    } = event;

    const EXTERNAL_AUTHENTICATION_PROVIDER = 'PreSignUp_ExternalProvider';

    if (triggerSource === EXTERNAL_AUTHENTICATION_PROVIDER) {
      // --> User has registered with Google/Facebook external providers
      const usersFilteredByEmail = await listUsersByEmail({
        userPoolId,
        email
      });

      // userName example: "Facebook_12324325436" or "Google_1237823478"
      const [providerNameValue, providerUserId] = userName.split('_');
      // Uppercase the first letter because the event sometimes
      // has it as google_1234 or facebook_1234. In the call to `adminLinkProviderForUser`
      // the provider name has to be Google or Facebook (first letter capitalized)
      const providerName = providerNameValue.charAt(0).toUpperCase() + providerNameValue.slice(1);

      if (usersFilteredByEmail.Users && usersFilteredByEmail.Users.length > 0) {
        // user already has cognito account
        const cognitoUsername = usersFilteredByEmail.Users[0].Username || 'username-not-found';

        // if they have access to the Google / Facebook account of email X, verify their email.
        // even if their cognito native account is not verified
        await adminLinkUserAccounts({
          username: cognitoUsername,
          userPoolId,
          providerName,
          providerUserId
        });
      } else {
        /* --> user does not have a cognito native account ->
            1. create a native cognito account
            2. change the password, to change status from FORCE_CHANGE_PASSWORD to CONFIRMED
            3. merge the social and the native accounts
            4. add the user to a group - OPTIONAL
        */

        const createdCognitoUser = await adminCreateUser({
          userPoolId,
          email,
          // these are attributes that you require upon registration
          name
        });

        await adminSetUserPassword({ userPoolId, email });

        const cognitoNativeUsername = createdCognitoUser.User?.Username || 'username-not-found';

        await adminLinkUserAccounts({
          username: cognitoNativeUsername,
          userPoolId,
          providerName,
          providerUserId
        });

        // // OPTIONALLY add the user to a group
        // await adminAddUserToGroup({
        //     userPoolId,
        //     username: cognitoNativeUsername,
        //     groupName: 'Users',
        // });

        event.response.autoVerifyEmail = true;
        event.response.autoConfirmUser = true;
      }
    }
    return callback(null, event);
  } catch (err) {
    return callback(err, event);
  }
}
