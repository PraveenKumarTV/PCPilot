'use strict';

require('dotenv').config();

const express = require('express');
const path = require('node:path');

const PcpilotAgent = require('./ai/agent');
const PcpilotMcpClient = require('./mcp/client');
const createChatRouter = require('./routes/chatRoutes');
const createCleanupRouter = require('./routes/cleanupRoutes');
const createFileRouter = require('./routes/fileRoutes');
const createProcessRouter = require('./routes/processRoutes');
const createSystemRouter = require('./routes/systemRoutes');

const app = express();
const port = Number(process.env.PORT || 3000);

app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.resolve(__dirname, '..', 'frontend')));
app.use(createSystemRouter());
app.use(createFileRouter());
app.use(createProcessRouter());
app.use(createCleanupRouter());

async function start() {
  let agent;

  try {
    const mcpClient = new PcpilotMcpClient({
      projectRoot: path.resolve(__dirname, '..'),
    });
    agent = new PcpilotAgent({ mcpClient });
  } catch (error) {
    console.error(`Backend initialization failed: ${error.message}`);
  }

  if (agent) {
    app.use(createChatRouter(agent));
  } else {
    app.post('/api/chat', (_req, res) => {
      res.status(503).json({
        error: 'Groq is not configured. Set GROQ_API_KEY in the backend environment.',
      });
    });
  }

  app.use((error, _req, res, _next) => {
    const status = error.statusCode || 500;
    res.status(status).json({ error: error.message || 'Internal server error' });
  });

  app.listen(port, '127.0.0.1', () => {
    console.log(`PCPilot backend listening at http://127.0.0.1:${port}`);
  });
}

start();

module.exports = { app, start };
