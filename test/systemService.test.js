'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const systemService = require('../backend/services/systemService');

test('get_system_info returns real system identity and uptime', async () => {
  const result = await systemService.getSystemInfo();
  assert.equal(typeof result.operatingSystem, 'string');
  assert.equal(typeof result.platform, 'string');
  assert.equal(typeof result.architecture, 'string');
  assert.equal(typeof result.hostname, 'string');
  assert.equal(typeof result.uptimeSeconds, 'number');
});

test('get_cpu_usage returns CPU details', async () => {
  const result = await systemService.getCpuUsage();
  assert.equal(typeof result.usagePercentage, 'number');
  assert.ok(result.coreCount > 0);
  assert.equal(typeof result.model, 'string');
});

test('get_ram_usage returns consistent byte values', async () => {
  const result = await systemService.getRamUsage();
  assert.ok(result.totalBytes > 0);
  assert.ok(result.usedBytes >= 0);
  assert.ok(result.freeBytes >= 0);
  assert.ok(result.usagePercentage >= 0 && result.usagePercentage <= 100);
});

test('get_disk_usage returns at least one real partition', async () => {
  const result = await systemService.getDiskUsage();
  assert.ok(Array.isArray(result));
  assert.ok(result.length > 0);
  assert.ok(result[0].totalBytes > 0);
  assert.ok(result[0].mount.length > 0);
});
