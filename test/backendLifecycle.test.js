'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { start } = require('../backend/server');

test('backend starts on an owned ephemeral loopback port and closes cleanly', async () => {
  const backend = await start({ host: '127.0.0.1', port: 0 });
  const baseUrl = `http://${backend.host}:${backend.port}`;

  try {
    assert.ok(backend.port > 0);
    await assert.rejects(() => start({ host: '127.0.0.1', port: 0 }), /already been started/);

    const health = await fetch(`${baseUrl}/api/health`);
    assert.equal(health.status, 200);
    assert.deepEqual(await health.json(), { status: 'ok' });

    const frontend = await fetch(`${baseUrl}/`);
    assert.equal(frontend.status, 200);
    assert.match(await frontend.text(), /PCPilot \| Local computer intelligence/);

    const metrics = await fetch(`${baseUrl}/api/system/metrics`);
    assert.equal(metrics.status, 200);
    assert.ok((await metrics.json()).info.hostname);
  } finally {
    await backend.close();
  }

  await assert.rejects(() => fetch(`${baseUrl}/api/health`));
});
