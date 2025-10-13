#!/usr/bin/env node

const mongoose = require('mongoose');
const { ensureMongo, StartupError } = require('./ensure-mongo');

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (!arg.startsWith('-')) {
      continue;
    }

    const next = args[i + 1];
    switch (arg) {
      case '--uri':
      case '-u':
        if (next && !next.startsWith('-')) {
          options.uri = next;
          i++;
        }
        break;
      case '--host':
        if (next && !next.startsWith('-')) {
          options.host = next;
          i++;
        }
        break;
      case '--port':
        if (next && !next.startsWith('-')) {
          options.port = next;
          i++;
        }
        break;
      case '--db':
      case '--database':
        if (next && !next.startsWith('-')) {
          options.dbName = next;
          i++;
        }
        break;
      case '--username':
      case '--user':
        if (next && !next.startsWith('-')) {
          options.user = next;
          i++;
        }
        break;
      case '--password':
      case '--pass':
        if (next && !next.startsWith('-')) {
          options.password = next;
          i++;
        }
        break;
      case '--authSource':
      case '--auth-source':
        if (next && !next.startsWith('-')) {
          options.authSource = next;
          i++;
        }
        break;
      default:
        break;
    }
  }

  return options;
}

function resolveDatabaseUri(cliOptions = {}) {
  if (cliOptions.uri) {
    return cliOptions.uri;
  }

  if (process.env.DATABASE_URI) {
    return process.env.DATABASE_URI;
  }

  const host = cliOptions.host || process.env.DATABASE_HOST || 'localhost';
  const port = cliOptions.port || process.env.DATABASE_PORT || '27017';
  const dbName = cliOptions.dbName || process.env.DATABASE_NAME || 'chat';
  const authSource =
    cliOptions.authSource || process.env.DATABASE_AUTH_SOURCE || dbName;
  const user = cliOptions.user || process.env.DATABASE_USER;
  const password = cliOptions.password || process.env.DATABASE_PASSWORD;

  if (user && password) {
    const encodedUser = encodeURIComponent(user);
    const encodedPassword = encodeURIComponent(password);
    return `mongodb://${encodedUser}:${encodedPassword}@${host}:${port}/${dbName}?authSource=${authSource}`;
  }

  return `mongodb://${host}:${port}/${dbName}`;
}

async function purgeCollections(connection) {
  const collections = await connection.db.collections();
  if (!collections.length) {
    console.log('[reset-db] No collections found to purge. Database is already empty.');
    return;
  }

  for (const collection of collections) {
    const result = await collection.deleteMany({});
    console.log(
      `[reset-db] Cleared ${result.deletedCount ?? 0} documents from collection "${collection.collectionName}".`
    );
  }
}

function maskConnectionString(uri) {
  try {
    const parsed = new URL(uri);
    if (parsed.password) {
      parsed.password = '***';
    }
    return parsed.toString();
  } catch (error) {
    return uri.replace(/:[^:@/]*@/, ':***@');
  }
}

function isAuthError(error) {
  return (
    (error &&
      (error.code === 13 ||
        error.codeName === 'Unauthorized' ||
        /requires authentication/i.test(error.message || ''))) ||
    (error?.response?.code === 13 &&
      error?.response?.codeName === 'Unauthorized')
  );
}

async function main() {
  const cliOptions = parseArgs();
  let cleanup;
  try {
    const ensureResult = await ensureMongo();
    cleanup = ensureResult?.cleanup;
    const uri = ensureResult?.uri || resolveDatabaseUri(cliOptions);

    console.log('[reset-db] Connecting to', maskConnectionString(uri));

    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 10000
    });

    await purgeCollections(mongoose.connection);

    console.log('[reset-db] Database purge completed successfully.');
  } catch (error) {
    if (error instanceof StartupError || error?.isStartupHelp) {
      console.error('[reset-db] Unable to prepare MongoDB.');
      console.error(error.message);
      for (const hint of error.help || []) {
        console.error('-', hint);
      }
      process.exitCode = 1;
      return;
    }

    if (isAuthError(error)) {
      console.error('[reset-db] Authentication failed when connecting to MongoDB.');
      console.error(
        'Ensure that the provided credentials have permission to list and purge collections.'
      );
      console.error(
        'You can pass explicit credentials with --user <username> --pass <password> and --authSource <db>, or provide a full --uri.'
      );
      console.error('Original error message:', error.message || error);
    } else {
      console.error('[reset-db] Unexpected error while purging the database.');
      console.error(error);
    }
    process.exitCode = 1;
  } finally {
    try {
      await mongoose.disconnect();
    } catch (disconnectError) {
      if (disconnectError) {
        console.error('[reset-db] Failed to disconnect cleanly:', disconnectError.message || disconnectError);
      }
    }

    if (cleanup) {
      await cleanup();
    }
  }
}

main();
