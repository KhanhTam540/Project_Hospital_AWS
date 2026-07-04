'use strict';

const fs = require('fs');
const path = require('path');
const {
  CognitoIdentityProviderClient,
  InitiateAuthCommand,
} = require('@aws-sdk/client-cognito-identity-provider');
const {
  projectRoot,
  readOutputs,
  requireOutput,
} = require('./medical-script-utils');

const users = {
  admin: 'admin.demo@example.com',
  doctor: 'doctor.demo@example.com',
  staff: 'staff.demo@example.com',
  patient: 'patient.demo@example.com',
};

async function main() {
  const password = process.env.DEMO_PASSWORD;
  if (!password) {
    throw new Error(
      'Set DEMO_PASSWORD first, for example: $env:DEMO_PASSWORD="ChangeMe@123456"',
    );
  }

  const outputs = await readOutputs();
  const ClientId = requireOutput(outputs, 'WebClientId');
  const client = new CognitoIdentityProviderClient({
    region: outputs.region || 'ap-southeast-1',
  });
  const tokens = {};

  for (const [role, username] of Object.entries(users)) {
    const response = await client.send(
      new InitiateAuthCommand({
        ClientId,
        AuthFlow: 'USER_PASSWORD_AUTH',
        AuthParameters: {
          USERNAME: username,
          PASSWORD: password,
        },
      }),
    );

    if (!response.AuthenticationResult?.AccessToken) {
      throw new Error(`Could not obtain access token for ${username}`);
    }

    tokens[role] = {
      username,
      accessToken: response.AuthenticationResult.AccessToken,
      idToken: response.AuthenticationResult.IdToken,
      expiresIn: response.AuthenticationResult.ExpiresIn,
    };
    console.log(`Token created for ${role}: ${username}`);
  }

  const outputFile = path.join(projectRoot, '.medical-test-tokens.json');
  fs.writeFileSync(outputFile, `${JSON.stringify(tokens, null, 2)}\n`);
  console.log(`Saved temporary tokens to ${outputFile}`);
  console.log('Do not commit this file to Git. Tokens expire automatically.');
}

main().catch((error) => {
  console.error(error.message || error);
  process.exitCode = 1;
});
