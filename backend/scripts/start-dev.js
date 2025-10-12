#!/usr/bin/env node

const { spawn } = require('child_process');
const { ensureMongo } = require('./ensure-mongo');

async function main() {
  const { uri, cleanup } = await ensureMongo();
  const env = { ...process.env };

  if (uri) {
    env.DATABASE_URI = uri;
  }

  let cleaned = false;
  const runCleanup = async () => {
    if (!cleaned && typeof cleanup === 'function') {
      cleaned = true;
      await cleanup();
    }
  };

  const child = spawn('nest', ['start', '--watch'], {
    stdio: 'inherit',
    shell: true,
    env
  });

  child.on('exit', async (code) => {
    await runCleanup();
    if (typeof code === 'number') {
      process.exit(code);
    } else {
      process.exit(0);
    }
  });

  const forwardSignal = (signal) => {
    if (!child.killed) {
      child.kill(signal);
    }
  };

  process.on('SIGINT', () => forwardSignal('SIGINT'));
  process.on('SIGTERM', () => forwardSignal('SIGTERM'));
  process.on('exit', () => {
    runCleanup().catch((error) => {
      console.error('[startup] Failed to clean up MongoDB resources.');
      console.error(error);
    });
  });
}

main().catch((error) => {
  console.error('[startup] Unable to start development server.');
  console.error(error);
  process.exit(1);
});
