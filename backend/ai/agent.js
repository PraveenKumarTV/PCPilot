'use strict';

const GroqService = require('../services/groqService');
const groqConfig = require('../config/groqConfig');
const PcpilotMcpClient = require('../mcp/client');
const { READ_ONLY_TOOLS, executeReadOnlyTool } = require('./toolExecutor');

const SYSTEM_PROMPT = `You are PCPilot, a local computer management assistant.
Use the provided MCP tools to answer questions with real local system data.
Never invent system values.
Only read-only system, file, and process tools are available in this version.
For a question asking for folders and their sizes, use get_folder_sizes once with the requested parent path and return its sorted results.
For destructive requests, explain that deletion and process termination are not enabled yet.
Keep answers concise and explain which operation you performed.`;

function mcpToolsToGroqTools(mcpTools) {
  return mcpTools.map((tool) => ({
    type: 'function',
    function: {
      name: tool.name,
      description: tool.description || '',
      parameters: tool.inputSchema || { type: 'object', properties: {} },
    },
  }));
}

function isFolderSummaryRequest(message) {
  const normalized = message.toLocaleLowerCase();
  return normalized.includes('folder')
    && (normalized.includes('size') || normalized.includes('space'));
}

class PcpilotAgent {
  constructor(options = {}) {
    this.mcpClient = options.mcpClient || new PcpilotMcpClient(options);
    this.groq = options.groqService || new GroqService(options);
  }

  async chat(message, history = []) {
    if (!message || typeof message !== 'string' || !message.trim()) {
      throw new Error('Message must be a non-empty string');
    }

    const limitedHistory = history
      .filter((item) => item && ['user', 'assistant'].includes(item.role) && typeof item.content === 'string')
      .slice(-10);

    const discovered = await this.mcpClient.listTools();
    let availableTools = discovered.tools.filter((tool) => READ_ONLY_TOOLS.has(tool.name));
    if (isFolderSummaryRequest(message)) {
      availableTools = availableTools.filter((tool) => tool.name === 'get_folder_sizes');
    }

    const messages = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...limitedHistory,
      { role: 'user', content: message.trim() },
    ];
    const tools = mcpToolsToGroqTools(availableTools);
    const toolExecutions = [];

    for (let round = 0; round < groqConfig.maxToolRounds; round += 1) {
      const completion = await this.groq.createChatCompletion({ messages, tools });
      const responseMessage = completion.choices[0]?.message;

      if (!responseMessage) {
        throw new Error('Groq returned an empty response');
      }

      const toolCalls = responseMessage.tool_calls || [];
      if (!toolCalls.length) {
        return {
          answer: responseMessage.content || 'I could not produce a response.',
          toolExecutions,
        };
      }

      messages.push(responseMessage);

      for (const toolCall of toolCalls) {
        const toolName = toolCall.function.name;
        let argumentsValue = {};

        try {
          argumentsValue = JSON.parse(toolCall.function.arguments || '{}');
        } catch (_error) {
          throw new Error(`Groq sent invalid JSON arguments for ${toolName}`);
        }

        try {
          const executed = await executeReadOnlyTool(this.mcpClient, toolName, argumentsValue);
          toolExecutions.push({ name: toolName, arguments: argumentsValue, success: true });
          messages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: JSON.stringify(executed.result),
          });
        } catch (error) {
          toolExecutions.push({ name: toolName, arguments: argumentsValue, success: false, error: error.message });
          messages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: JSON.stringify({ error: error.message }),
          });
        }
      }
    }

    throw new Error('Maximum tool-calling rounds reached');
  }
}

module.exports = PcpilotAgent;
