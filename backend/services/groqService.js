'use strict';

const Groq = require('groq-sdk').default;
const config = require('../config/groqConfig');

class GroqService {
  constructor(options = {}) {
    if (!config.apiKey && !options.apiKey) {
      throw new Error('GROQ_API_KEY is not configured');
    }

    this.client = new Groq({
      apiKey: options.apiKey || config.apiKey,
      timeout: config.timeoutMs,
    });
  }

  async createChatCompletion({ messages, tools, model }) {
    return this.client.chat.completions.create({
      model: model || config.model,
      messages,
      tools,
      tool_choice: tools?.length ? 'auto' : 'none',
      temperature: 0.2,
    });
  }
}

module.exports = GroqService;
