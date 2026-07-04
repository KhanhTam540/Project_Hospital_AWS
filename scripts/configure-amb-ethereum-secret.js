#!/usr/bin/env node
'use strict';

const {
  GetSecretValueCommand,
  PutSecretValueCommand,
  SecretsManagerClient,
} = require('@aws-sdk/client-secrets-manager');

function getArg(name, fallback = '') {
  const index = process.argv.indexOf(`--${name}`);
  if (index >= 0 && process.argv[index + 1]) return process.argv[index + 1];
  return process.env[name.toUpperCase().replace(/-/g, '_')] || fallback;
}

const secretId = getArg('secret-id') || getArg('secret-arn');
const rpcUrl = getArg('rpc-url');
const privateKey = getArg('private-key');
const chainId = getArg('chain-id');
const networkName = getArg('network-name', chainId === '1' ? 'Ethereum Mainnet' : 'Ethereum');
const explorerBaseUrl = getArg('explorer-base-url', chainId === '1' ? 'https://etherscan.io' : '');
const billingToken = getArg('billing-token');
const confirmations = getArg('confirmations', '0');

if (!secretId || !rpcUrl || !privateKey || !chainId) {
  console.error(`Usage:
node scripts/configure-amb-ethereum-secret.js \\
  --secret-id <integration-secret-arn-or-name> \\
  --rpc-url <amb-ethereum-http-endpoint> \\
  --private-key <0x-wallet-private-key> \\
  --chain-id <1|11155111|...> \\
  [--network-name "Ethereum Mainnet"] \\
  [--explorer-base-url https://etherscan.io] \\
  [--billing-token <billing-token>] \\
  [--confirmations 0]
`);
  process.exit(1);
}

if (!/^0x[0-9a-fA-F]{64}$/.test(privateKey)) {
  console.error('Invalid private key format. Expected 0x followed by 64 hex characters.');
  process.exit(1);
}

const client = new SecretsManagerClient({});

async function readCurrentSecret() {
  try {
    const response = await client.send(new GetSecretValueCommand({ SecretId: secretId }));
    const text = response.SecretString || Buffer.from(response.SecretBinary || '', 'base64').toString('utf8');
    return text ? JSON.parse(text) : {};
  } catch (error) {
    if (error?.name === 'ResourceNotFoundException') throw error;
    console.warn(`Could not parse existing secret value, replacing with AMB config only: ${error.message}`);
    return {};
  }
}

async function main() {
  const current = await readCurrentSecret();
  const next = {
    ...current,
    BLOCKCHAIN_MODE: 'AMB_ETHEREUM',
    AMB_ETHEREUM_RPC_URL: rpcUrl,
    AMB_ETHEREUM_PRIVATE_KEY: privateKey,
    AMB_ETHEREUM_CHAIN_ID: String(chainId),
    AMB_ETHEREUM_NETWORK_NAME: networkName,
    AMB_ETHEREUM_EXPLORER_BASE_URL: explorerBaseUrl,
    AMB_ETHEREUM_CONFIRMATIONS: String(confirmations),
  };

  if (billingToken) {
    next.AMB_ETHEREUM_BILLING_TOKEN = billingToken;
  }

  await client.send(
    new PutSecretValueCommand({
      SecretId: secretId,
      SecretString: JSON.stringify(next, null, 2),
    }),
  );

  console.log('AMB Ethereum secret updated successfully.');
  console.log(`Mode       : ${next.BLOCKCHAIN_MODE}`);
  console.log(`RPC URL    : ${rpcUrl.replace(/billingtoken=[^&]+/i, 'billingtoken=***')}`);
  console.log(`Chain ID   : ${chainId}`);
  console.log(`Network    : ${networkName}`);
  console.log(`Confirmations: ${confirmations}`);
}

main().catch((error) => {
  console.error('Failed to configure AMB Ethereum secret:', error);
  process.exit(1);
});
