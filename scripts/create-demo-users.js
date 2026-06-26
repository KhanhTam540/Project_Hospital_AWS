'use strict';

const {
  AdminAddUserToGroupCommand,
  AdminCreateUserCommand,
  AdminSetUserPasswordCommand,
  CognitoIdentityProviderClient,
} = require('@aws-sdk/client-cognito-identity-provider');
const {
  readOutputs,
  requireOutput,
} = require('./medical-script-utils');

const users = [
  ['admin.demo@example.com', 'ADMIN'],
  ['doctor.demo@example.com', 'BACSI'],
  ['staff.demo@example.com', 'NHANSU'],
  ['patient.demo@example.com', 'BENHNHAN'],
];

async function main() {
  const password = process.env.DEMO_PASSWORD;
  if (!password) {
    throw new Error(
      'Set DEMO_PASSWORD first. Example: $env:DEMO_PASSWORD="ChangeMe@123456"',
    );
  }

  const outputs = await readOutputs();
  const userPoolId = requireOutput(outputs, 'UserPoolId');
  const client = new CognitoIdentityProviderClient({
    region: outputs.region || 'ap-southeast-1',
  });

  for (const [email, groupName] of users) {
    try {
      await client.send(
        new AdminCreateUserCommand({
          UserPoolId: userPoolId,
          Username: email,
          UserAttributes: [
            { Name: 'email', Value: email },
            { Name: 'email_verified', Value: 'true' },
          ],
          MessageAction: 'SUPPRESS',
        }),
      );
      console.log(`Created ${email}`);
    } catch (error) {
      if (error.name !== 'UsernameExistsException') {
        throw error;
      }
      console.log(`${email} already exists`);
    }

    await client.send(
      new AdminSetUserPasswordCommand({
        UserPoolId: userPoolId,
        Username: email,
        Password: password,
        Permanent: true,
      }),
    );

    await client.send(
      new AdminAddUserToGroupCommand({
        UserPoolId: userPoolId,
        Username: email,
        GroupName: groupName,
      }),
    );

    console.log(`Assigned ${email} to ${groupName}`);
  }
}

main().catch((error) => {
  console.error(error.message || error);
  process.exitCode = 1;
});
