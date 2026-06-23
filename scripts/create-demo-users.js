const fs = require('fs');
const path = require('path');
const {
  AdminAddUserToGroupCommand,
  AdminCreateUserCommand,
  AdminSetUserPasswordCommand,
  CognitoIdentityProviderClient,
} = require('@aws-sdk/client-cognito-identity-provider');

const projectRoot = path.resolve(__dirname, '..');
const outputsFile = path.join(
  projectRoot,
  'docs',
  'aws-dev-outputs.json',
);

const users = [
  ['admin.demo@example.com', 'ADMIN'],
  ['doctor.demo@example.com', 'BACSI'],
  ['staff.demo@example.com', 'NHANSU'],
  ['patient.demo@example.com', 'BENHNHAN'],
];

const main = async () => {
  if (!fs.existsSync(outputsFile)) {
    throw new Error('Run npm run outputs before npm run create:users');
  }

  const password = process.env.DEMO_PASSWORD;
  if (!password) {
    throw new Error(
      'Set DEMO_PASSWORD before running. Example: $env:DEMO_PASSWORD="ChangeMe@123456"',
    );
  }

  const outputs = JSON.parse(fs.readFileSync(outputsFile, 'utf8'));
  const client = new CognitoIdentityProviderClient({
    region: outputs.region || 'ap-southeast-1',
  });

  for (const [email, groupName] of users) {
    try {
      await client.send(
        new AdminCreateUserCommand({
          UserPoolId: outputs.UserPoolId,
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
        UserPoolId: outputs.UserPoolId,
        Username: email,
        Password: password,
        Permanent: true,
      }),
    );

    await client.send(
      new AdminAddUserToGroupCommand({
        UserPoolId: outputs.UserPoolId,
        Username: email,
        GroupName: groupName,
      }),
    );

    console.log(`Assigned ${email} to ${groupName}`);
  }
};

main().catch((error) => {
  console.error(error.message || error);
  process.exitCode = 1;
});
