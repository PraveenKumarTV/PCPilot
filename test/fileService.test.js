'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const fileService = require('../backend/services/fileService');

let testRoot;

test.before(async () => {
  testRoot = await fs.mkdtemp(path.join(os.homedir(), '.pcpilot-phase4-'));
  await fs.mkdir(path.join(testRoot, 'nested'));
  await fs.writeFile(path.join(testRoot, 'alpha.txt'), 'same content');
  await fs.writeFile(path.join(testRoot, 'copy.txt'), 'same content');
  await fs.writeFile(path.join(testRoot, 'nested', 'large.log'), 'a'.repeat(100));
});

test.after(async () => {
  await fs.rm(testRoot, { recursive: true, force: true });
});

test('file services scan allowed directories', async () => {
  const size = await fileService.getFolderSize(testRoot);
  assert.equal(size.fileCount, 3);
  assert.equal(size.directoryCount, 1);
  assert.equal(size.totalBytes, 124);

  const largest = await fileService.getLargestFiles(testRoot, 1);
  assert.equal(path.basename(largest[0].path), 'large.log');

  const matches = await fileService.searchFiles(testRoot, 'ALPHA');
  assert.deepEqual(matches.map((item) => path.basename(item)), ['alpha.txt']);
});

test('folder size summaries return immediate folders sorted by size', async () => {
  const summary = await fileService.getFolderSizes(testRoot, 10);
  assert.equal(summary.path, testRoot);
  assert.equal(summary.folders.length, 1);
  assert.equal(summary.folders[0].name, 'nested');
  assert.equal(summary.folders[0].totalBytes, 100);
});

test('duplicate and metadata scans return real file data', async () => {
  const duplicates = await fileService.findDuplicateFiles(testRoot);
  assert.equal(duplicates.length, 1);
  assert.deepEqual(duplicates[0].paths.map((item) => path.basename(item)).sort(), ['alpha.txt', 'copy.txt']);

  const metadata = await fileService.getFileMetadata(path.join(testRoot, 'alpha.txt'));
  assert.equal(metadata.name, 'alpha.txt');
  assert.equal(metadata.extension, '.txt');
  assert.equal(metadata.sizeBytes, 12);
});

test('file services reject paths outside the allowed home directory', async () => {
  await assert.rejects(() => fileService.getFolderSize('/etc'), /outside configured allowed directories/);
  await assert.rejects(() => fileService.getFileMetadata('/etc/passwd'), /outside configured allowed directories/);
});
