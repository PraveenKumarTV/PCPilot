'use strict';

require('dotenv').config();

const groqConfig = {
  apiKey: process.env.GROQ_API_KEY || '',
  model: process.env.GROQ_MODEL || 'openai/gpt-oss-20b',
  timeoutMs: Number(process.env.GROQ_TIMEOUT_MS || 30000),
  maxToolRounds: Number(process.env.GROQ_MAX_TOOL_ROUNDS || 4),
};

module.exports = groqConfig;
