const { getSql, readJsonBody, sendJson, setCorsHeaders } = require('./_utils');

module.exports = async function handler(req, res) {
  setCorsHeaders(res);

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'Metodo nao permitido.' });
    return;
  }

  try {
    const sql = getSql();
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