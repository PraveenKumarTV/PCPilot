'use strict';

const express = require('express');

function createChatRouter(agent) {
  const router = express.Router();

  router.post('/api/chat', async (req, res, next) => {
    try {
      const { message, history } = req.body || {};
      const result = await agent.chat(message, history);
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  return router;
}

module.exports = createChatRouter;
