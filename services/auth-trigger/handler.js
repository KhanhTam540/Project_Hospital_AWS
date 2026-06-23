const {
  AdminAddUserToGroupCommand,
  CognitoIdentityProviderClient,
} = require('@aws-sdk/client-cognito-identity-provider');

const client = new CognitoIdentityProviderClient({});

exports.handler = async (event) => {
  const groupName = process.env.DEFAULT_GROUP || 'BENHNHAN';

  if (!event?.userPoolId || !event?.userName) {
    throw new Error('Post-confirmation event is missing userPoolId or userName');
  }

  await client.send(
    new AdminAddUserToGroupCommand({
      UserPoolId: event.userPoolId,
      Username: event.userName,
      GroupName: groupName,
    }),
  );

  return event;
};
