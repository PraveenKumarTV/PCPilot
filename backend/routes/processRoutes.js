'use strict';

const express = require('express');
const processService = require('../services/processService');

function createProcessRouter() {
  const router = express.Router();

  router.get('/api/processes', async (_req, res, next) => {
    try { res.json(await processService.listRunningProcesses()); } catch (error) { next(error); }
  });
  router.get('/api/processes/top-memory', async (req, res, next) => {
    try { res.json(await processService.getTopMemoryProcesses(req.query.limit)); } catch (error) { next(error); }
  });
  router.get('/api/processes/top-cpu', async (req, res, next) => {
    try { res.json(await processService.getTopCpuProcesses(req.query.limit)); } catch (error) { next(error); }
  });
  router.get('/api/processes/:pid', async (req, res, next) => {
    try { res.json(await processService.getProcessDetails(req.params.pid)); } catch (error) { next(error); }
  });

  return router;
}

module.exports = createProcessRouter;
