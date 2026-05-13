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
      const selectedDate = req.query?.date;
      const rows = selectedDate
        ? await sql`
            SELECT id, operador_nome, datahora, valor, created_at
            FROM fechamentos_parciais
            WHERE DATE(datahora) = ${selectedDate}
            ORDER BY datahora DESC, created_at DESC
          `
        : await sql`
            SELECT id, operador_nome, datahora, valor, created_at
            FROM (
              SELECT id, operador_nome, datahora, valor, created_at,
                     ROW_NUMBER() OVER (PARTITION BY LOWER(operador_nome) ORDER BY created_at DESC) AS rn
              FROM fechamentos_parciais
            ) parciais
            WHERE rn = 1
            ORDER BY created_at DESC
            LIMIT 30
          `;

      sendJson(res, 200, {
        items: rows.map(row => ({
          id: row.id,
          operador: row.operador_nome,
          datahora: row.datahora,
          valor: Number(row.valor || 0),
          createdAt: row.created_at,
        }))
      });
      return;
    }

    if (req.method === 'POST') {
      const body = await readJsonBody(req);
      const operador = String(body.operador || '').trim();
      const datahora = body.datahora;
      const valor = Number(body.valor || 0);

      if (!operador || !datahora) {
        sendJson(res, 400, { error: 'operador e datahora sao obrigatorios.' });
        return;
      }

      await sql`
        INSERT INTO fechamentos_parciais (operador_nome, datahora, valor)
        VALUES (${operador}, ${datahora}, ${valor})
      `;

      sendJson(res, 201, { ok: true });
      return;
    }

    if (req.method === 'DELETE') {
      const id = String(req.query?.id || req.url.split('/').pop() || '').trim();
      if (!id) {
        sendJson(res, 400, { error: 'id e obrigatorio para deletar.' });
        return;
      }

      const body = await readJsonBody(req);
      const senha = String(body.senha || '').trim();
      const deletePassword = process.env.DELETE_PASSWORD || 'solar013';
      
      if (senha !== deletePassword) {
        sendJson(res, 401, { error: 'Senha incorreta para deletar fechamento parcial.' });
        return;
      }

      await sql`
        DELETE FROM fechamentos_parciais
        WHERE id = ${id}
      `;

      sendJson(res, 200, { ok: true });
      return;
    }

    sendJson(res, 405, { error: 'Metodo nao permitido.' });
  } catch (error) {
    sendJson(res, 500, { error: error.message || 'Erro interno.' });
  }
};