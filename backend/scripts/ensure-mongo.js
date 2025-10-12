#!/usr/bin/env node

const net = require('net');
const { execSync } = require('child_process');
const path = require('path');

const DEFAULT_PORT = 27017;
const DEFAULT_HOST = 'localhost';
const WAIT_TIMEOUT_MS = 20000;
const WAIT_INTERVAL_MS = 500;

function parsePort(rawPort) {
  const parsed = Number(rawPort);
  if (Number.isNaN(parsed) || parsed <= 0) {
    return DEFAULT_PORT;
  }
  return parsed;
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function checkConnection(host, port) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let resolved = false;

    const finalize = (status) => {
      if (!resolved) {
        resolved = true;
        resolve(status);
      }
    };

    socket.setTimeout(1000);
    socket.once('connect', () => {
      socket.end();
      finalize(true);
    });
    socket.once('timeout', () => {
      socket.destroy();
      finalize(false);
    });
    socket.once('error', () => {
      finalize(false);
    });

    socket.connect(port, host);
  });
}

async function waitForConnection(host, port) {
  const start = Date.now();
  while (Date.now() - start < WAIT_TIMEOUT_MS) {
    if (await checkConnection(host, port)) {
      return true;
    }
    await delay(WAIT_INTERVAL_MS);
  }
  return false;
}

function tryDockerCommand(args, options) {
  try {
    execSync(`docker compose ${args}`, options);
    return true;
  } catch (error) {
    if (error?.code !== 'ENOENT') {
      // docker was found but the command failed
      throw error;
    }
  }

  // fallback to older docker-compose binary
  execSync(`docker-compose ${args}`, options);
  return true;
}

async function main() {
  const explicitUri = process.env.DATABASE_URI;
  if (explicitUri) {
    return;
  }

  const autoStartFlag = (process.env.AUTO_START_MONGO || '').toLowerCase();
  if (autoStartFlag === 'false' || autoStartFlag === '0') {
    return;
  }

  const host = process.env.DATABASE_HOST || DEFAULT_HOST;
  const port = parsePort(process.env.DATABASE_PORT || DEFAULT_PORT);

  if (host !== 'localhost' && host !== '127.0.0.1') {
    return;
  }

  if (await checkConnection(host, port)) {
    return;
  }

  const composeDirectory = path.resolve(__dirname, '../..');
  const composeOptions = { cwd: composeDirectory, stdio: 'inherit' };

  try {
    console.log('[startup] MongoDB is not reachable. Attempting to start docker compose service "mongodb"...');
    tryDockerCommand('up -d mongodb', composeOptions);
  } catch (error) {
    console.error('[startup] Failed to auto-start MongoDB using docker compose.');
    console.error('[startup] Please ensure Docker is installed and run "docker compose up -d mongodb" manually.');
    if (error) {
      console.error(String(error.message || error));
    }
    process.exitCode = 1;
    return;
  }

  if (await waitForConnection(host, port)) {
    console.log('[startup] MongoDB is ready.');
    return;
  }

  console.error('[startup] MongoDB did not become ready in time.');
  console.error('[startup] Verify the container logs with "docker compose logs mongodb".');
  process.exitCode = 1;
}

main().catch((error) => {
  console.error('[startup] Unexpected error while preparing MongoDB.');
  console.error(error);
  process.exitCode = 1;
});
