'use strict';

const crypto = require('node:crypto');
const fsSync = require('node:fs');
const fs = require('node:fs/promises');
const path = require('node:path');
const { resolveAllowedPath } = require('../config/pathPolicy');

const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 1000;
const MAX_DEPTH = 20;

function boundedLimit(value, fallback = DEFAULT_LIMIT) {
  const numeric = Number(value);
  if (!Number.isInteger(numeric) || numeric < 1) return fallback;
  return Math.min(numeric, MAX_LIMIT);
}

async function walkDirectory(rootPath, visitor, options = {}) {
  const maxDepth = Math.min(Math.max(Number(options.maxDepth ?? MAX_DEPTH), 0), MAX_DEPTH);
  let files = 0;
  let directories = 0;
  const errors = [];

  async function visit(currentPath, depth) {
    let entries;
    try {
      entries = await fs.readdir(currentPath, { withFileTypes: true });
    } catch (error) {
      errors.push({ path: currentPath, error: error.code || error.message });
      return;
    }

    for (const entry of entries) {
      if (entry.isSymbolicLink()) continue;
      const entryPath = path.join(currentPath, entry.name);
      if (entry.isDirectory()) {
        directories += 1;
        await visitor({ path: entryPath, name: entry.name, type: 'directory', depth });
        if (depth < maxDepth) await visit(entryPath, depth + 1);
      } else if (entry.isFile()) {
        files += 1;
        await visitor({ path: entryPath, name: entry.name, type: 'file', depth });
      }
    }
  }

  await visit(rootPath, 0);
  return { files, directories, errors };
}

async function getFolderSize(inputPath) {
  const rootPath = await resolveAllowedPath(inputPath, { type: 'directory' });
  let totalBytes = 0;
  const scanErrors = [];
  const result = await walkDirectory(rootPath, async (entry) => {
    if (entry.type === 'file') {
      try {
        totalBytes += (await fs.stat(entry.path)).size;
      } catch (error) {
        scanErrors.push({ path: entry.path, error: error.code || error.message });
      }
    }
  });

  return { path: rootPath, totalBytes, fileCount: result.files, directoryCount: result.directories, errors: [...result.errors, ...scanErrors] };
}

async function getFolderSizes(inputPath, limit) {
  const rootPath = await resolveAllowedPath(inputPath, { type: 'directory' });
  let entries;
  try {
    entries = await fs.readdir(rootPath, { withFileTypes: true });
  } catch (error) {
    throw new Error(`Unable to read directory: ${error.code || error.message}`);
  }

  const folders = entries
    .filter((entry) => entry.isDirectory() && !entry.isSymbolicLink())
    .map((entry) => path.join(rootPath, entry.name));
  const results = await Promise.all(folders.map(async (folderPath) => {
    const summary = await getFolderSize(folderPath);
    return {
      path: summary.path,
      name: path.basename(summary.path),
      totalBytes: summary.totalBytes,
      fileCount: summary.fileCount,
      directoryCount: summary.directoryCount,
      errors: summary.errors,
    };
  }));

  return {
    path: rootPath,
    folders: results.sort((left, right) => right.totalBytes - left.totalBytes).slice(0, boundedLimit(limit)),
  };
}

async function getLargestFiles(inputPath, limit) {
  const rootPath = await resolveAllowedPath(inputPath, { type: 'directory' });
  const files = [];
  await walkDirectory(rootPath, async (entry) => {
    if (entry.type !== 'file') return;
    try {
      const stats = await fs.stat(entry.path);
      files.push({ path: entry.path, sizeBytes: stats.size, modifiedAt: stats.mtime.toISOString() });
    } catch (_error) {
      // The file may disappear during a scan.
    }
  });

  return files.sort((left, right) => right.sizeBytes - left.sizeBytes).slice(0, boundedLimit(limit));
}

async function searchFiles(inputPath, keyword) {
  const rootPath = await resolveAllowedPath(inputPath, { type: 'directory' });
  if (typeof keyword !== 'string' || !keyword.trim()) throw new Error('A non-empty keyword is required');
  const normalizedKeyword = keyword.toLocaleLowerCase();
  const matches = [];

  await walkDirectory(rootPath, async (entry) => {
    if (entry.name.toLocaleLowerCase().includes(normalizedKeyword)) matches.push(entry.path);
  });
  return matches;
}

async function getFileMetadata(inputPath) {
  const filePath = await resolveAllowedPath(inputPath);
  const stats = await fs.lstat(filePath);
  const extension = path.extname(filePath);
  return {
    path: filePath,
    name: path.basename(filePath),
    extension: extension || null,
    sizeBytes: stats.size,
    createdAt: stats.birthtime?.toISOString() || null,
    modifiedAt: stats.mtime?.toISOString() || null,
    accessedAt: stats.atime?.toISOString() || null,
    fileType: stats.isDirectory() ? 'directory' : stats.isFile() ? 'file' : 'other',
  };
}

async function findOldFiles(inputPath, days) {
  const rootPath = await resolveAllowedPath(inputPath, { type: 'directory' });
  const ageDays = Number(days);
  if (!Number.isInteger(ageDays) || ageDays < 1 || ageDays > 36500) throw new Error('days must be an integer from 1 to 36500');
  const cutoff = Date.now() - ageDays * 24 * 60 * 60 * 1000;
  const files = [];

  await walkDirectory(rootPath, async (entry) => {
    if (entry.type !== 'file') return;
    try {
      const stats = await fs.stat(entry.path);
      if (stats.mtimeMs < cutoff) files.push({ path: entry.path, sizeBytes: stats.size, modifiedAt: stats.mtime.toISOString() });
    } catch (_error) {
      // The file may disappear during a scan.
    }
  });
  return files;
}

async function hashFile(filePath) {
  const hash = crypto.createHash('sha256');
  for await (const chunk of fsSync.createReadStream(filePath)) hash.update(chunk);
  return hash.digest('hex');
}

async function findDuplicateFiles(inputPath) {
  const rootPath = await resolveAllowedPath(inputPath, { type: 'directory' });
  const bySize = new Map();
  await walkDirectory(rootPath, async (entry) => {
    if (entry.type !== 'file') return;
    try {
      const size = (await fs.stat(entry.path)).size;
      if (!bySize.has(size)) bySize.set(size, []);
      bySize.get(size).push(entry.path);
    } catch (_error) {
      // The file may disappear during a scan.
    }
  });

  const byHash = new Map();
  for (const [size, paths] of bySize) {
    if (paths.length < 2) continue;
    for (const filePath of paths) {
      const hash = await hashFile(filePath);
      const key = `${size}:${hash}`;
      if (!byHash.has(key)) byHash.set(key, { sizeBytes: size, hash, paths: [] });
      byHash.get(key).paths.push(filePath);
    }
  }
  return [...byHash.values()].filter((group) => group.paths.length > 1);
}

async function getDirectoryTree(inputPath, maxDepth = 3) {
  const rootPath = await resolveAllowedPath(inputPath, { type: 'directory' });
  const depth = Math.min(Math.max(Number(maxDepth), 0), MAX_DEPTH);

  async function build(currentPath, currentDepth) {
    const node = { name: path.basename(currentPath) || currentPath, path: currentPath, type: 'directory', children: [] };
    if (currentDepth >= depth) return node;
    let entries;
    try {
      entries = await fs.readdir(currentPath, { withFileTypes: true });
    } catch (error) {
      node.error = error.code || error.message;
      return node;
    }
    for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
      if (entry.isSymbolicLink()) continue;
      const entryPath = path.join(currentPath, entry.name);
      if (entry.isDirectory()) node.children.push(await build(entryPath, currentDepth + 1));
      else if (entry.isFile()) node.children.push({ name: entry.name, path: entryPath, type: 'file' });
    }
    return node;
  }

  return build(rootPath, 0);
}

module.exports = { getFolderSize, getFolderSizes, getLargestFiles, searchFiles, getFileMetadata, findOldFiles, findDuplicateFiles, getDirectoryTree };
