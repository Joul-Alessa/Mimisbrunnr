const express = require('express');
const cors = require('cors');

const resourceRoutes = require('./routes/resources');
const cardRoutes = require('./routes/cards');
const knowledgeFieldRoutes = require('./routes/knowledgeFields');
const { HttpError } = require('./utils/errors');

const app = express();

app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.use('/api/resources', resourceRoutes);
app.use('/api/cards', cardRoutes);
app.use('/api/knowledge-fields', knowledgeFieldRoutes);

app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  const status = err instanceof HttpError ? err.status : 500;
  if (status === 500) console.error(err);
  res.status(status).json({ error: err.message || 'Internal server error' });
});

module.exports = app;
