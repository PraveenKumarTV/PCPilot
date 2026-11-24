'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const cleanupService = require('../backend/services/cleanupService');

let testRoot;

test.before(async () => {
  testRoot = await fs.mkdtemp(path.join(os.homedir(), '.pcpilot-phase6-'));
  await fs.writeFile(path.join(testRoot, 'review.tmp'), 'temporary');
  await fs.writeFile(path.join(testRoot, 'keep.txt'), 'keep');
});

test.after(async () => {
  await fs.rm(testRoot, { recursive: true, force: true });
});

test('cleanup scan reports temporary candidates without deleting them', async () => {
  const result = await cleanupService.scanTemporaryFiles(testRoot);
  assert.equal(result.candidates.length, 1);
  assert.equal(path.basename(result.candidates[0].path), 'review.tmp');
  assert.equal(await fs.readFile(path.join(testRoot, 'review.tmp'), 'utf8'), 'temporary');
});

test('confirmed deletion is one-use and reports the operation', async () => {
  const filePath = path.join(testRoot, 'review.tmp');
  const confirmation = cleanupService.createDeleteConfirmation([filePath]);
  const result = await cleanupService.deleteConfirmedFiles(confirmation.token);
  assert.deepEqual(result.results, [{ path: filePath, deleted: true }]);
  await assert.rejects(() => fs.access(filePath));
  await assert.rejects(() => cleanupService.deleteConfirmedFiles(confirmation.token), /missing or expired/);
});

test('confirmation rejects missing path lists and reports unsafe paths', async () => {
  assert.throws(() => cleanupService.createDeleteConfirmation([]), /between 1 and 100/);
  const confirmation = cleanupService.createDeleteConfirmation(['/etc/passwd']);
  const result = await cleanupService.deleteConfirmedFiles(confirmation.token);
  assert.equal(result.results[0].deleted, false);
  assert.match(result.results[0].error, /outside configured allowed directories/);
});
