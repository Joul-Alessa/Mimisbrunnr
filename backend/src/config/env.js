const path = require('path');
require('dotenv').config();

const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  dbPath: process.env.DB_PATH || path.join(__dirname, '..', '..', 'data', 'mimisbrunnr.sqlite'),
  llm: {
    provider: process.env.LLM_PROVIDER || 'ollama',
    baseUrl: process.env.LLM_BASE_URL || 'http://localhost:11434',
    model: process.env.LLM_MODEL || 'llama3',
  },
};

module.exports = config;
