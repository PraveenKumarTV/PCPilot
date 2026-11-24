'use strict';

require('dotenv').config();

const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');

const configuredRoots = (process.env.PCPILOT_ALLOWED_DIRS || os.homedir())
  .split(path.delimiter)
  .map((value) => value.trim())
  .filter(Boolean)
  .map((value) => path.resolve(value));

function isInsideRoot(candidate, root) {
  const relative = path.relative(root, candidate);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

async function getAllowedRoots() {
  const roots = [];
  for (const root of configuredRoots) {
    try {
      const realRoot = await fs.realpath(root);
      if (!roots.includes(realRoot)) {
        roots.push(realRoot);
      }
    } catch (_error) {
      // Ignore configured roots that do not exist on this machine.
    }
  }
  return roots;
}

async function resolveAllowedPath(inputPath, options = {}) {
  if (typeof inputPath !== 'string' || !inputPath.trim()) {
    throw new Error('A non-empty path is required');
  }

  const requestedPath = path.resolve(inputPath);
  const [realPath, allowedRoots] = await Promise.all([
    fs.realpath(requestedPath),
    getAllowedRoots(),
  ]);

  if (!allowedRoots.some((root) => isInsideRoot(realPath, root))) {
    throw new Error('Path is outside configured allowed directories');
  }

  if (options.type) {
    const stats = await fs.stat(realPath);
    if (options.type === 'directory' && !stats.isDirectory()) {
      throw new Error('Path must be a directory');
    }
    if (options.type === 'file' && !stats.isFile()) {
      throw new Error('Path must be a file');
    }
  }

  return realPath;
}

module.exports = { configuredRoots, getAllowedRoots, isInsideRoot, resolveAllowedPath };
