'use strict';

const express = require('express');
const systemService = require('../services/systemService');

function createSystemRouter() {
  const router = express.Router();
  const endpoints = {
    info: systemService.getSystemInfo,
    cpu: systemService.getCpuUsage,
    ram: systemService.getRamUsage,
    disks: systemService.getDiskUsage,
  };

  for (const [name, handler] of Object.entries(endpoints)) {
    router.get(`/api/system/${name}`, async (_req, res, next) => {
      try {
        res.json(await handler());
      } catch (error) {
        next(error);
      }
    });
  }

  router.get('/api/system/metrics', async (_req, res, next) => {
    try {
      const [cpu, ram, disks, info] = await Promise.all([
        systemService.getCpuUsage(),
        systemService.getRamUsage(),
        systemService.getDiskUsage(),
        systemService.getSystemInfo(),
      ]);
      res.json({ cpu, ram, disks, info });
    } catch (error) {
      next(error);
    }
  });

  return router;
}

module.exports = createSystemRouter;
