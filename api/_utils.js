const { neon } = require('@neondatabase/serverless');

function resolveDatabaseUrl() {
  const rawValue = process.env.DATABASE_URL || process.env.DB_PASSWORD || process.env.bancodedados || '';
  if (!rawValue) {
    throw new Error('DATABASE_URL nao configurado.');
  }

  if (rawValue.startsWith('DATABASE_URL=')) {
    return rawValue.replace('DATABASE_URL=', '');
  }

  if (rawValue.startsWith('postgresql://') || rawValue.startsWith('postgres://')) {
    return rawValue;
  }

  return rawValue;
}

function getSql() {
  return neon(resolveDatabaseUrl());
}

function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

async function readJsonBody(req) {
  if (req.body && typeof req.body === 'object') {
    return req.body;
  }

  if (typeof req.body === 'string' && req.body) {
    return JSON.parse(req.body);
  }

  return await new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => {
      data += chunk;
    });
    req.on('end', () => {
      if (!data) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(data));
      } catch (error) {
        reject(error);
      }
    });
    req.on('error', reject);
  });
}

function sendJson(res, statusCode, payload) {
  setCorsHeaders(res);
  res.status(statusCode).json(payload);
}

module.exports = {
  getSql,
  readJsonBody,
  sendJson,
  setCorsHeaders,
};