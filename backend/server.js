'use strict';

const envFile = process.env.PCPILOT_ENV_FILE;
require('dotenv').config(envFile ? { path: envFile } : undefined);

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
let started = false;

app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.resolve(__dirname, '..', 'frontend')));
app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));
app.use(createSystemRouter());
app.use(createFileRouter());
app.use(createProcessRouter());
app.use(createCleanupRouter());

async function start(options = {}) {
  if (started) {
    throw new Error('PCPilot backend has already been started');
  }
  started = true;

  const port = Number(options.port ?? process.env.PORT ?? 3000);
  const host = options.host || '127.0.0.1';
  const mcpClient = new PcpilotMcpClient({
    projectRoot: path.resolve(__dirname, '..'),
  });
  let agent;

  try {
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

  const server = app.listen(port, host);
  try {
    await new Promise((resolve, reject) => {
      server.once('listening', resolve);
      server.once('error', reject);
    });
  } catch (error) {
    await mcpClient.close().catch(() => {});
    started = false;
    throw error;
  }

  const address = server.address();
  const actualPort = typeof address === 'object' && address ? address.port : port;
  console.log(`PCPilot backend listening at http://${host}:${actualPort}`);

  let closePromise;
  async function close() {
    if (closePromise) return closePromise;
    closePromise = (async () => {
      if (server.listening) {
        await new Promise((resolve, reject) => {
          server.close((error) => (error ? reject(error) : resolve()));
        });
      }
      await mcpClient.close();
      started = false;
    })();
    return closePromise;
  }

  return { app, server, host, port: actualPort, close };
}

if (require.main === module) {
  start()
    .then(({ close }) => {
      let closing = false;
      const shutdown = () => {
        if (closing) return;
        closing = true;
        close().catch((error) => console.error(`Backend shutdown failed: ${error.message}`));
      };
      process.once('SIGINT', shutdown);
      process.once('SIGTERM', shutdown);
    })
    .catch((error) => {
      console.error(`PCPilot backend failed to start: ${error.message}`);
      process.exitCode = 1;
    });
}

module.exports = { app, start };
