#!/usr/bin/env node

const net = require('net');
const { execSync } = require('child_process');
const path = require('path');

let MongoMemoryServer;

class StartupError extends Error {
  constructor(message, help = []) {
    super(message);
    this.name = 'StartupError';
    this.isStartupHelp = true;
    this.help = Array.isArray(help) ? help : [help].filter(Boolean);
  }
}

const DEFAULT_PORT = 27017;
const DEFAULT_HOST = 'localhost';
const WAIT_TIMEOUT_MS = 60000;
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

async function startInMemoryMongo() {
  if (!MongoMemoryServer) {
    try {
      ({ MongoMemoryServer } = require('mongodb-memory-server'));
    } catch (error) {
      if (error?.code === 'MODULE_NOT_FOUND') {
        throw new StartupError(
          'mongodb-memory-server is not installed, so an in-memory MongoDB fallback cannot be started.',
          [
            'Install it locally with "npm install --save-dev mongodb-memory-server" (inside the backend directory) to enable the fallback.',
            'Alternatively, start your own MongoDB instance and set DATABASE_URI or AUTO_START_MONGO=false before running npm run start:dev.'
          ]
        );
      }

      throw error;
    }
  }

  const dbName = process.env.DATABASE_NAME || 'chat';
  const memoryServer = await MongoMemoryServer.create({
    instance: {
      dbName
    }
  });

  const uri = memoryServer.getUri(dbName);
  console.log('[startup] Using mongodb-memory-server fallback at', uri);

  return {
    uri,
    cleanup: async () => {
      try {
        await memoryServer.stop();
      } catch (error) {
        console.error('[startup] Failed to stop mongodb-memory-server cleanly.');
        console.error(error);
      }
    }
  };
}

async function ensureMongo() {
  const explicitUri = process.env.DATABASE_URI;
  if (explicitUri) {
    return { uri: explicitUri };
  }

  const autoStartFlag = (process.env.AUTO_START_MONGO || '').toLowerCase();
  if (autoStartFlag === 'false' || autoStartFlag === '0') {
    return {};
  }

  const host = process.env.DATABASE_HOST || DEFAULT_HOST;
  const port = parsePort(process.env.DATABASE_PORT || DEFAULT_PORT);

  if (await checkConnection(host, port)) {
    return {};
  }

  if (host !== 'localhost' && host !== '127.0.0.1') {
    console.warn('[startup] MongoDB host is remote. Skipping auto-start.');
    return {};
  }

  const composeDirectory = path.resolve(__dirname, '../..');
  const composeOptions = { cwd: composeDirectory, stdio: 'inherit' };

  try {
    console.log('[startup] MongoDB is not reachable. Attempting to start docker compose service "mongodb"...');
    tryDockerCommand('up -d mongodb', composeOptions);
    if (await waitForConnection(host, port)) {
      console.log('[startup] MongoDB is ready.');
      return {};
    }
    console.error('[startup] MongoDB did not become ready in time. Falling back to in-memory instance.');
  } catch (error) {
    const help = [
      'Ensure Docker is running and that your user can access the docker socket.',
      'If Docker is unavailable, install mongodb-memory-server or provide DATABASE_URI/AUTO_START_MONGO=false and start MongoDB manually.'
    ];

    console.error('[startup] Failed to auto-start MongoDB using docker compose. Falling back to in-memory instance.');
    if (error) {
      console.error(String(error.message || error));
    }

    if (error && error.message?.includes('permission denied')) {
      help.unshift('Docker reported a permission error when pulling or starting mongo: grant docker access or run the command with sufficient privileges.');
    }

    // Provide the same guidance if we later fail to launch mongodb-memory-server
    ensureMongo.lastDockerHelp = help;
  }

  try {
    return await startInMemoryMongo();
  } catch (error) {
    const help = ensureMongo.lastDockerHelp || [
      'Start a MongoDB instance manually and expose it via DATABASE_URI, or disable auto bootstrap with AUTO_START_MONGO=false.'
    ];

    console.error('[startup] Unable to start mongodb-memory-server.');

    if (error?.isStartupHelp) {
      error.help = [...error.help, ...help];
      throw error;
    }

    throw new StartupError(error?.message || String(error), help);
  }
}

module.exports = {
  ensureMongo,
  StartupError
};

if (require.main === module) {
  ensureMongo()
    .then((result) => {
      if (result?.uri) {
        console.log('[startup] MongoDB connection URI:', result.uri);
      }
    })
    .catch((error) => {
      console.error('[startup] Unexpected error while preparing MongoDB.');
      console.error(error);
      process.exitCode = 1;
    });
}
