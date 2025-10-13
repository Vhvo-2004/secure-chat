#!/usr/bin/env node

const mongoose = require('mongoose');
const { ensureMongo, StartupError } = require('./ensure-mongo');

function resolveDatabaseUri() {
  if (process.env.DATABASE_URI) {
    return process.env.DATABASE_URI;
  }

  const host = process.env.DATABASE_HOST || 'localhost';
  const port = process.env.DATABASE_PORT || '27017';
  const dbName = process.env.DATABASE_NAME || 'chat';
  const authSource = process.env.DATABASE_AUTH_SOURCE || dbName;
  const user = process.env.DATABASE_USER;
  const password = process.env.DATABASE_PASSWORD;

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

async function main() {
  let cleanup;
  try {
    const ensureResult = await ensureMongo();
    cleanup = ensureResult?.cleanup;
    const uri = ensureResult?.uri || resolveDatabaseUri();

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

    console.error('[reset-db] Unexpected error while purging the database.');
    console.error(error);
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
