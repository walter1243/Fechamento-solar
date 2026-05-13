const { getSql, readJsonBody, sendJson, setCorsHeaders } = require('./_utils');

module.exports = async function handler(req, res) {
  setCorsHeaders(res);

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  try {
    const sql = getSql();

    if (req.method === 'GET') {
      const rows = await sql`
        SELECT nome, created_at
        FROM operadores
        ORDER BY LOWER(nome) ASC
      `;

      sendJson(res, 200, {
        items: rows.map(row => ({
          nome: row.nome,
          createdAt: row.created_at,
        }))
      });
      return;
    }

    if (req.method === 'POST') {
      const body = await readJsonBody(req);
      const nome = String(body.nome || '').trim();
      if (!nome) {
        sendJson(res, 400, { error: 'nome e obrigatorio.' });
        return;
      }

      await sql`
        INSERT INTO operadores (nome)
        VALUES (${nome})
        ON CONFLICT (nome) DO NOTHING
      `;

      sendJson(res, 201, { ok: true });
      return;
    }

    if (req.method === 'DELETE') {
      const nome = String(req.query?.nome || '').trim();
      if (!nome) {
        sendJson(res, 400, { error: 'nome e obrigatorio para excluir.' });
        return;
      }

      await sql`
        DELETE FROM operadores
        WHERE nome = ${nome}
      `;

      sendJson(res, 200, { ok: true });
      return;
    }

    sendJson(res, 405, { error: 'Metodo nao permitido.' });
  } catch (error) {
    sendJson(res, 500, { error: error.message || 'Erro interno.' });
  }
};