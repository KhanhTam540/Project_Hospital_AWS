#!/usr/bin/env node
'use strict';

const {
  GetSecretValueCommand,
  SecretsManagerClient,
} = require('@aws-sdk/client-secrets-manager');
const { JsonRpcProvider, Wallet } = require('ethers');

function getArg(name, fallback = '') {
  const index = process.argv.indexOf(`--${name}`);
  if (index >= 0 && process.argv[index + 1]) return process.argv[index + 1];
  return process.env[name.toUpperCase().replace(/-/g, '_')] || fallback;
}

function appendBillingToken(rpcUrl, billingToken) {
  if (!billingToken) return rpcUrl;
  const parsed = new URL(rpcUrl);
  if (!parsed.searchParams.has('billingtoken')) {
    parsed.searchParams.set('billingtoken', billingToken);
  }
  return parsed.toString();
}

async function readSecret(secretId) {
  const client = new SecretsManagerClient({});
  const response = await client.send(new GetSecretValueCommand({ SecretId: secretId }));
  const text = response.SecretString || Buffer.from(response.SecretBinary || '', 'base64').toString('utf8');
  return JSON.parse(text || '{}');
}

async function main() {
  const secretId = getArg('secret-id') || getArg('secret-arn');
  if (!secretId) {
    console.error('Usage: node scripts/test-amb-ethereum-connection.js --secret-id <integration-secret-arn-or-name>');
    process.exit(1);
  }

  const secret = await readSecret(secretId);
  const rpcUrl = appendBillingToken(
    String(secret.AMB_ETHEREUM_RPC_URL || '').trim(),
    String(secret.AMB_ETHEREUM_BILLING_TOKEN || '').trim(),
  );
  const chainId = Number(secret.AMB_ETHEREUM_CHAIN_ID || 0);
  const privateKey = String(secret.AMB_ETHEREUM_PRIVATE_KEY || '').trim();

  if (!rpcUrl || !chainId || !privateKey) {
    throw new Error('Secret is missing AMB_ETHEREUM_RPC_URL, AMB_ETHEREUM_CHAIN_ID or AMB_ETHEREUM_PRIVATE_KEY');
  }

  const provider = new JsonRpcProvider(rpcUrl, chainId, { staticNetwork: true });
  const wallet = new Wallet(privateKey, provider);
  const [blockNumber, balance] = await Promise.all([
    provider.getBlockNumber(),
    provider.getBalance(wallet.address),
  ]);

  console.log('AMB Ethereum connection OK.');
  console.log(`Network   : ${secret.AMB_ETHEREUM_NETWORK_NAME || 'Ethereum'}`);
  console.log(`Chain ID  : ${chainId}`);
  console.log(`Block     : ${blockNumber}`);
  console.log(`Wallet    : ${wallet.address}`);
  console.log(`Balance   : ${balance.toString()} wei`);
  console.log('Note: sending real transactions requires gas on this wallet.');
}

main().catch((error) => {
  console.error('AMB Ethereum connection test failed:', error);
  process.exit(1);
});
