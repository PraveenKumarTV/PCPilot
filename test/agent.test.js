'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const PcpilotAgent = require('../backend/ai/agent');

class FakeMcpClient {
  async listTools() {
    return {
      tools: [
        { name: 'get_ram_usage', description: 'RAM', inputSchema: { type: 'object', properties: {} } },
        { name: 'get_cpu_usage', description: 'CPU', inputSchema: { type: 'object', properties: {} } },
        { name: 'get_folder_sizes', description: 'Folder sizes', inputSchema: { type: 'object', properties: {} } },
        { name: 'delete_selected_files', description: 'Not allowed', inputSchema: { type: 'object', properties: {} } },
      ],
    };
  }

  async callTool(name) {
    if (name === 'get_ram_usage') {
      return { content: [{ type: 'text', text: '{"totalBytes":16000,"usagePercentage":25}' }] };
    }
    if (name === 'get_cpu_usage') {
      return { content: [{ type: 'text', text: '{"usagePercentage":10,"coreCount":4}' }] };
    }
    throw new Error('Unexpected tool');
  }
}

class FakeGroqService {
  constructor() {
    this.round = 0;
  }

  async createChatCompletion() {
    this.round += 1;
    if (this.round === 1) {
      return {
        choices: [{
          message: {
            role: 'assistant',
            content: null,
            tool_calls: [
              { id: 'ram-call', function: { name: 'get_ram_usage', arguments: '{}' } },
              { id: 'cpu-call', function: { name: 'get_cpu_usage', arguments: '{}' } },
            ],
          },
        }],
      };
    }

    return {
      choices: [{ message: { role: 'assistant', content: 'RAM is 25% and CPU is 10%.', tool_calls: [] } }],
    };
  }
}

test('agent executes multiple read-only MCP tool calls', async () => {
  const agent = new PcpilotAgent({
    mcpClient: new FakeMcpClient(),
    groqService: new FakeGroqService(),
  });

  const result = await agent.chat('Show RAM and CPU usage', []);

  assert.equal(result.answer, 'RAM is 25% and CPU is 10%.');
  assert.deepEqual(
    result.toolExecutions.map((item) => item.name),
    ['get_ram_usage', 'get_cpu_usage'],
  );
  assert.ok(result.toolExecutions.every((item) => item.success));
});

test('agent rejects blank messages', async () => {
  const agent = new PcpilotAgent({
    mcpClient: new FakeMcpClient(),
    groqService: new FakeGroqService(),
  });

  await assert.rejects(() => agent.chat('   ', []), /non-empty string/);
});

test('agent exposes the aggregate folder tool for folder size questions', async () => {
  const calls = [];
  const agent = new PcpilotAgent({
    mcpClient: new FakeMcpClient(),
    groqService: {
      async createChatCompletion({ tools }) {
        calls.push(tools.map((tool) => tool.function.name));
        return { choices: [{ message: { role: 'assistant', content: 'Done.', tool_calls: [] } }] };
      },
    },
  });

  await agent.chat('Show folders in /home/praveen with their sizes', []);
  assert.deepEqual(calls, [['get_folder_sizes']]);
});
