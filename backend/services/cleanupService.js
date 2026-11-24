'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');
const fileService = require('./fileService');
const { resolveAllowedPath } = require('../config/pathPolicy');

const pendingActions = new Map();
const ACTION_TTL_MS = 5 * 60 * 1000;
const TEMPORARY_EXTENSIONS = new Set(['.tmp', '.temp', '.cache', '.log', '.bak', '.old', '.swp', '.crdownload']);

function isTemporaryCandidate(filePath) {
  const extension = path.extname(filePath).toLocaleLowerCase();
  const name = path.basename(filePath).toLocaleLowerCase();
  return TEMPORARY_EXTENSIONS.has(extension) || name.startsWith('~') || name.endsWith('~');
}

async function scanTemporaryFiles(inputPath) {
  const rootPath = await resolveAllowedPath(inputPath, { type: 'directory' });
  const candidates = [];
  const largest = await fileService.getLargestFiles(rootPath, 1000);
  for (const file of largest) {
    if (isTemporaryCandidate(file.path)) candidates.push({ ...file, category: 'temporary-file' });
  }
  return {
    path: rootPath,
    totalBytes: candidates.reduce((total, file) => total + file.sizeBytes, 0),
    candidates,
  };
}

async function scanCleanupCandidates() {
  const configuredPaths = (process.env.PCPILOT_CLEANUP_DIRS || '')
    .split(path.delimiter)
    .map((value) => value.trim())
    .filter(Boolean);
  const scans = [];
  for (const configuredPath of configuredPaths) {
    try {
      scans.push(await scanTemporaryFiles(configuredPath));
    } catch (error) {
      scans.push({ path: configuredPath, totalBytes: 0, candidates: [], error: error.message });
    }
  }
  return scans;
}

function createDeleteConfirmation(paths) {
  if (!Array.isArray(paths) || paths.length < 1 || paths.length > 100) {
    throw new Error('paths must contain between 1 and 100 files');
  }
  const token = crypto.randomUUID();
  pendingActions.set(token, { paths: [...paths], expiresAt: Date.now() + ACTION_TTL_MS });
  return { token, action: 'delete_selected_files', paths, expiresAt: new Date(Date.now() + ACTION_TTL_MS).toISOString() };
}

async function deleteConfirmedFiles(token) {
  const action = pendingActions.get(token);
  pendingActions.delete(token);
  if (!action || action.expiresAt < Date.now()) throw new Error('Confirmation token is missing or expired');

  const results = [];
  for (const requestedPath of action.paths) {
    try {
      const safePath = await resolveAllowedPath(requestedPath, { type: 'file' });
      const stats = await fs.lstat(safePath);
      if (!stats.isFile()) throw new Error('Only regular files can be deleted');
      await fs.unlink(safePath);
      results.push({ path: safePath, deleted: true });
    } catch (error) {
      results.push({ path: requestedPath, deleted: false, error: error.message });
    }
  }
  return { results };
}

module.exports = { scanTemporaryFiles, scanCleanupCandidates, createDeleteConfirmation, deleteConfirmedFiles };
