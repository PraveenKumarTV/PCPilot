'use strict';

const express = require('express');
const cleanupService = require('../services/cleanupService');

function createCleanupRouter() {
  const router = express.Router();

  router.post('/api/files/cleanup/scan', async (req, res, next) => {
    try {
      const { path } = req.body || {};
      res.json(await cleanupService.scanTemporaryFiles(path || process.env.HOME));
    } catch (error) { next(error); }
  });

  router.post('/api/actions/confirm', async (req, res, next) => {
    try {
      const { paths } = req.body || {};
      res.json(cleanupService.createDeleteConfirmation(paths));
    } catch (error) { next(error); }
  });

  router.post('/api/files/cleanup/execute', async (req, res, next) => {
    try {
      const { confirmationToken } = req.body || {};
      res.json(await cleanupService.deleteConfirmedFiles(confirmationToken));
    } catch (error) { next(error); }
  });

  return router;
}

module.exports = createCleanupRouter;
