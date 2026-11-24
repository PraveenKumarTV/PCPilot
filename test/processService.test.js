'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const processService = require('../backend/services/processService');

test('process service lists real processes', async () => {
  const processes = await processService.listRunningProcesses();
  assert.ok(processes.length > 0);
  assert.ok(processes.every((item) => Number.isInteger(item.pid) && item.pid > 0));

  const topMemory = await processService.getTopMemoryProcesses(3);
  assert.ok(topMemory.length > 0);
  assert.ok(topMemory.length <= 3);
  assert.ok(topMemory[0].memoryUsagePercentage >= topMemory[topMemory.length - 1].memoryUsagePercentage);
});

test('process service validates PIDs', async () => {
  await assert.rejects(() => processService.getProcessDetails(0), /positive integer/);
  await assert.rejects(() => processService.getProcessDetails('abc'), /positive integer/);
});
