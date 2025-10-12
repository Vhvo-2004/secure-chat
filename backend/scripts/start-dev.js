#!/usr/bin/env node

const path = require('path');
const { spawnSync, spawn } = require('child_process');

function runEnsureMongo() {
  const scriptPath = path.resolve(__dirname, 'ensure-mongo.js');
  const result = spawnSync(process.execPath, [scriptPath], {
    stdio: 'inherit'
  });

  if (typeof result.status === 'number' && result.status !== 0) {
    process.exit(result.status);
  }
}

function startNest() {
  const child = spawn('nest', ['start', '--watch'], {
    stdio: 'inherit',
    shell: true
  });

  child.on('exit', (code) => {
    if (typeof code === 'number') {
      process.exit(code);
    } else {
      process.exit(0);
    }
  });
}

runEnsureMongo();
startNest();
