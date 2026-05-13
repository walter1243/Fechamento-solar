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
            SELECT *
            FROM fechamentos_finais
            WHERE DATE(created_at) = ${selectedDate}
            ORDER BY created_at DESC
          `
        : await sql`
            SELECT *
            FROM fechamentos_finais
            ORDER BY created_at DESC
            LIMIT 30
          `;

      const ids = rows.map(row => row.id);
      const detalhes = ids.length
        ? await sql`
            SELECT fechamento_final_id, periodo, descricao, valor
            FROM saidas_detalhes
            WHERE fechamento_final_id = ANY(${ids})
            ORDER BY id ASC
          `
        : [];

      sendJson(res, 200, {
        items: rows.map(row => ({
          id: row.id,
          parcialOperador: row.operador_inicial_nome,
          finalOperador: row.operador_final_nome,
          caixaCompartilhado: row.caixa_compartilhado,
          debito: Number(row.debito || 0),
          credito: Number(row.credito || 0),
          alimentacao: Number(row.alimentacao || 0),
          pix: Number(row.pix || 0),
          transferencia: Number(row.transferencia || 0),
          sistema: Number(row.sistema || 0),
          dinheiroAgenda: Number(row.dinheiro_agenda || 0),
          totalDinheiro: Number(row.total_dinheiro || 0),
          totalCartao: Number(row.total_cartao || 0),
          totalPixTransferencia: Number(row.total_pix_transferencia || 0),
          total: Number(row.total_final || 0),
          saidasManha: Number(row.saidas_manha_total || 0),
          saidasTarde: Number(row.saidas_tarde_total || 0),
          saidas: Number(row.saidas_total || 0),
          parcialDataHora: row.created_at,
          parcialValor: 0,
          detalhesSaidasManha: detalhes
            .filter(item => item.fechamento_final_id === row.id && item.periodo === 'manha')
            .map(item => ({ descricao: item.descricao, valor: Number(item.valor || 0) })),
          detalhesSaidasTarde: detalhes
            .filter(item => item.fechamento_final_id === row.id && item.periodo === 'tarde')
            .map(item => ({ descricao: item.descricao, valor: Number(item.valor || 0) })),
          createdAt: row.created_at,
        }))
      });
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
        sendJson(res, 401, { error: 'Senha incorreta para deletar fechamento final.' });
        return;
      }

      await sql`
        DELETE FROM saidas_detalhes
        WHERE fechamento_final_id = ${id}
      `;

      await sql`
        DELETE FROM fechamentos_finais
        WHERE id = ${id}
      `;

      sendJson(res, 200, { ok: true });
      return;
    }

    if (req.method !== 'POST') {
      sendJson(res, 405, { error: 'Metodo nao permitido.' });
      return;
    }

    const body = await readJsonBody(req);

    const inserted = await sql`
      INSERT INTO fechamentos_finais (
        operador_inicial_nome,
        operador_final_nome,
        caixa_compartilhado,
        debito,
        credito,
        alimentacao,
        pix,
        transferencia,
        sistema,
        dinheiro_agenda,
        total_dinheiro,
        total_cartao,
        total_pix_transferencia,
        total_final,
        saidas_manha_total,
        saidas_tarde_total,
        saidas_total
      ) VALUES (
        ${String(body.parcialOperador || '-').trim()},
        ${String(body.finalOperador || '-').trim()},
        ${Boolean(body.caixaCompartilhado)},
        ${Number(body.debito || 0)},
        ${Number(body.credito || 0)},
        ${Number(body.alimentacao || 0)},
        ${Number(body.pix || 0)},
        ${Number(body.transferencia || 0)},
        ${Number(body.sistema || 0)},
        ${Number(body.dinheiroAgenda || 0)},
        ${Number(body.totalDinheiro || 0)},
        ${Number(body.totalCartao || 0)},
        ${Number(body.totalPixTransferencia || 0)},
        ${Number(body.total || 0)},
        ${Number(body.saidasManha || 0)},
        ${Number(body.saidasTarde || 0)},
        ${Number(body.saidas || 0)}
      )
      RETURNING id
    `;

    const fechamentoId = inserted[0].id;
    const detalhes = [
      ...(Array.isArray(body.detalhesSaidasManha) ? body.detalhesSaidasManha.map(item => ({ ...item, periodo: 'manha' })) : []),
      ...(Array.isArray(body.detalhesSaidasTarde) ? body.detalhesSaidasTarde.map(item => ({ ...item, periodo: 'tarde' })) : []),
    ];

    for (const item of detalhes) {
      await sql`
        INSERT INTO saidas_detalhes (fechamento_final_id, periodo, descricao, valor)
        VALUES (
          ${fechamentoId},
          ${item.periodo},
          ${String(item.descricao || 'Sem descricao')},
          ${Number(item.valor || 0)}
        )
      `;
    }

    sendJson(res, 201, { ok: true, id: fechamentoId });
  } catch (error) {
    sendJson(res, 500, { error: error.message || 'Erro interno.' });
  }
};