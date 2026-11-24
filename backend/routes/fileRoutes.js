'use strict';

const express = require('express');
const fileService = require('../services/fileService');

function createFileRouter() {
  const router = express.Router();
  const requiredPath = (req) => req.query.path || process.env.HOME;

  router.get('/api/files/largest', async (req, res, next) => {
    try { res.json(await fileService.getLargestFiles(requiredPath(req), req.query.limit)); } catch (error) { next(error); }
  });
  router.get('/api/files/search', async (req, res, next) => {
    try { res.json(await fileService.searchFiles(requiredPath(req), req.query.keyword)); } catch (error) { next(error); }
  });
  router.get('/api/files/metadata', async (req, res, next) => {
    try { res.json(await fileService.getFileMetadata(req.query.path)); } catch (error) { next(error); }
  });
  router.get('/api/files/duplicates', async (req, res, next) => {
    try { res.json(await fileService.findDuplicateFiles(requiredPath(req))); } catch (error) { next(error); }
  });
  router.get('/api/files/tree', async (req, res, next) => {
    try { res.json(await fileService.getDirectoryTree(requiredPath(req), req.query.maxDepth)); } catch (error) { next(error); }
  });

  return router;
}

module.exports = createFileRouter;
