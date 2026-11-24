'use strict';

const path = require('node:path');
const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const { StdioClientTransport } = require('@modelcontextprotocol/sdk/client/stdio.js');

class PcpilotMcpClient {
  constructor(options = {}) {
    this.projectRoot = options.projectRoot || path.resolve(__dirname, '..', '..');
    this.client = null;
    this.transport = null;
  }

  async connect() {
    if (this.client) {
      return;
    }

    this.transport = new StdioClientTransport({
      command: process.execPath,
      args: [path.join(this.projectRoot, 'backend', 'mcp', 'server.js')],
      cwd: this.projectRoot,
      env: process.env,
      stderr: 'inherit',
    });

    this.client = new Client({
      name: 'pcpilot-backend',
      version: '1.0.0',
    });

    await this.client.connect(this.transport);
  }

  async listTools() {
    await this.connect();
    return this.client.listTools();
  }

  async callTool(name, argumentsValue = {}) {
    await this.connect();
    return this.client.callTool({
      name,
      arguments: argumentsValue,
    });
  }

  async close() {
    if (!this.client) {
      return;
    }

    await this.client.close();
    this.client = null;
    this.transport = null;
  }
}

module.exports = PcpilotMcpClient;
