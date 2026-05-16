const CHAVE_PARCIAL = 'fechamento_parcial_v1';
const CHAVE_PARCIAIS = 'fechamentos_parciais_v1';
const CHAVE_ULTIMO_CUPOM = 'ultimo_cupom_v1';
const URL_SERVICO_IMPRESSAO = 'http://127.0.0.1:8000/imprimir';
const URL_SERVICO_IMPRESSAO_IMAGEM = 'http://127.0.0.1:8000/imprimir_imagem';
const URL_SERVICO_STATUS = 'http://127.0.0.1:8000/status_impressora';
const API_BASE_URL = window.location.protocol === 'file:'
    ? 'https://fechamento-solar.vercel.app'
    : window.location.origin;
const URL_API_OPERADORES = `${API_BASE_URL}/api/operadores`;
const URL_API_PARCIAIS = `${API_BASE_URL}/api/parciais`;
const URL_API_FECHAMENTOS_FINAIS = `${API_BASE_URL}/api/fechamentos-finais`;
let operadoresCadastrados = [];
let historicoParciais = [];
let historicoFinais = [];
const LARGURA_CUPOM = 38;

function openTab(tabId, botao) {
    const abas = document.querySelectorAll('.tab-content');
    abas.forEach(function (aba) {
        aba.style.display = aba.id === tabId ? 'block' : 'none';
    });

    const botoes = document.querySelectorAll('.tab-button');
    botoes.forEach(function (item) {
        item.classList.remove('active');
    });

    if (botao) {
        botao.classList.add('active');
    }
}

function formatarMoeda(valor) {
    return `R$ ${Number(valor || 0).toFixed(2).replace('.', ',')}`;
}

function paraNumero(valor) {
    return parseFloat(valor) || 0;
}

function formatarDataHora(valor) {
    if (!valor) return '-';
    const data = new Date(valor);
    if (Number.isNaN(data.getTime())) return valor;
    return data.toLocaleString('pt-BR');
}

function formatarDataParaFiltro(valor) {
    const data = valor ? new Date(valor) : new Date();
    if (Number.isNaN(data.getTime())) {
        return '';
    }
    const ano = data.getFullYear();
    const mes = String(data.getMonth() + 1).padStart(2, '0');
    const dia = String(data.getDate()).padStart(2, '0');
    return `${ano}-${mes}-${dia}`;
}

async function requisicaoJson(url, options) {
    const response = await fetch(url, options);
    let payload = {};

    try {
        payload = await response.json();
    } catch (erro) {
        payload = {};
    }

    if (!response.ok) {
        throw new Error(payload.error || `Falha na requisicao (${response.status}).`);
    }

    return payload;
}

async function salvarOperadorNoBanco(nome) {
    await requisicaoJson(URL_API_OPERADORES, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome })
    });
}

async function excluirOperadorNoBanco(nome, senha) {
    await requisicaoJson(`${URL_API_OPERADORES}?nome=${encodeURIComponent(nome)}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ senha })
    });
}

async function carregarOperadoresDoBanco() {
    const resultado = await requisicaoJson(URL_API_OPERADORES);
    operadoresCadastrados = Array.isArray(resultado.items)
        ? resultado.items.map(function (item) { return String(item.nome || '').trim(); }).filter(Boolean)
        : [];
}

async function salvarParcialNoBanco(parcial) {
    try {
        await requisicaoJson(URL_API_PARCIAIS, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(parcial)
        });
        return true;
    } catch (erro) {
        console.warn('Nao foi possivel salvar fechamento parcial no banco.', erro);
        return false;
    }
}

async function carregarParciaisDoBanco() {
    const resultado = await requisicaoJson(URL_API_PARCIAIS);
    const lista = Array.isArray(resultado.items) ? resultado.items : [];
    const normalizados = lista.map(function (item) {
        return {
            id: item.id,
            operador: String(item.operador || '').trim(),
            datahora: item.datahora || '',
            valor: Number(item.valor || 0)
        };
    }).filter(function (item) {
        return item.operador && item.datahora;
    });

    salvarListaParciais(normalizados);

    if (normalizados.length) {
        localStorage.setItem(CHAVE_PARCIAL, JSON.stringify(normalizados[0]));
    }
}

function baixarArquivo(nomeArquivo, conteudo) {
    const blob = new Blob([conteudo], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = nomeArquivo;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

function limitarLinhaCupom(texto) {
    return String(texto || '').slice(0, LARGURA_CUPOM);
}

function linhaDetalheCupom(prefixo, descricao, valor) {
    const valorTexto = formatarMoeda(valor);
    const sufixo = ` ${valorTexto}`;
    const maxDescricao = Math.max(0, LARGURA_CUPOM - prefixo.length - sufixo.length);
    const descricaoCurta = String(descricao || 'Sem lancamento').slice(0, maxDescricao);
    return `${prefixo}${descricaoCurta}${sufixo}`;
}

function linhaCampoCupom(rotulo, valor) {
    const textoRotulo = `${String(rotulo || '').trim()}:`;
    const textoValor = String(valor || '-').trim();
    const larguraPontos = Math.max(1, LARGURA_CUPOM - textoRotulo.length - textoValor.length - 2);
    return `${textoRotulo} ${'.'.repeat(larguraPontos)} ${textoValor}`;
}

function gerarConteudoParcialTexto(parcial) {
    const data = formatarDataHora(parcial.datahora);
    const caixa = parcial.operador || '-';
    const valor = formatarMoeda(parcial.valor);
    const separador = '-'.repeat(LARGURA_CUPOM);

    const linhas = [
        'SOLAR SUPERMERCADO',
        'FECHAMENTO PARCIAL',
        separador,
        `DT: ${data}`,
        `CX: ${caixa}`,
        '',
        `VAL: ${valor}`,
        separador,
        '',
        ''
    ];
    return linhas.map(limitarLinhaCupom).join('\r\n');
}

function normalizarDadosCupom(dados) {
    const parcialValor = Number(dados.parcialValor || 0);
    const envelopeNoite = Number(dados.envelopeNoite || 0);
    const sistema = Number(dados.sistema || 0);
    const dinheiroAgenda = Number(dados.dinheiroAgenda || 0);
    if (dados.apurado == null) dados.apurado = parcialValor + envelopeNoite;
    if (dados.esperado == null) dados.esperado = sistema + dinheiroAgenda;
    if (dados.diferenca == null) dados.diferenca = dados.apurado - dados.esperado;
    if (dados.totalDinheiro == null) dados.totalDinheiro = dados.apurado;
    return dados;
}

function gerarConteudoFinalTexto(dados) {
    normalizarDadosCupom(dados);
    const separador = '-'.repeat(LARGURA_CUPOM);
    const linhas = [
        'SOLAR SUPERMERCADO',
        'FECHAMENTO FINAL',
        separador,
        linhaCampoCupom('Data/Hora Parcial', formatarDataHora(dados.parcialDataHora)),
        linhaCampoCupom('Caixa Parcial', dados.parcialOperador || '-'),
        linhaCampoCupom('Valor Parcial', formatarMoeda(dados.parcialValor)),
        '',
        linhaCampoCupom('Operador Final', dados.finalOperador || '-'),
        linhaCampoCupom('Cartão Débito', formatarMoeda(dados.debito)),
        linhaCampoCupom('Cartão Crédito', formatarMoeda(dados.credito)),
    ];

    if (dados.caixaCompartilhado) {
        linhas.push(`Caixa Compartilhado: iniciou com ${dados.parcialOperador || '-'} (${formatarMoeda(dados.parcialValor)}) e terminou com ${dados.finalOperador || '-'}`);
    }

    if (dados.alimentacao > 0) {
        linhas.push(linhaCampoCupom('Cartão Alimentação', formatarMoeda(dados.alimentacao)));
    }

    linhas.push(linhaCampoCupom('PIX', formatarMoeda(dados.pix)));

    if (dados.transferencia > 0) {
        linhas.push(linhaCampoCupom('Transferência', formatarMoeda(dados.transferencia)));
    }

    linhas.push(
        linhaCampoCupom('Sistema', formatarMoeda(dados.sistema)),
        linhaCampoCupom('Dinheiro Agenda', formatarMoeda(dados.dinheiroAgenda)),
        linhaCampoCupom('Envelope Noite', formatarMoeda(dados.envelopeNoite)),
        '',
        linhaCampoCupom('Apurado', formatarMoeda(dados.apurado)),
        '  (Parcial + Envelope Noite)',
        linhaCampoCupom('Esperado', formatarMoeda(dados.esperado)),
        '  (Sistema + Dinheiro Agenda)',
        linhaCampoCupom('Diferença', formatarMoeda(dados.diferenca)),
        '  (Apurado - Esperado)',
        '',
        linhaCampoCupom('Total Cartão', formatarMoeda(dados.totalCartao)),
        linhaCampoCupom('Total PIX/Transf', formatarMoeda(dados.totalPixTransferencia)),
        '',
        linhaCampoCupom('Saídas Manhã Total', formatarMoeda(dados.saidasManha)),
        'Detalhes Saídas Manhã:',
    );

    if (!dados.detalhesSaidasManha.length) {
        linhas.push('- Sem lançamentos');
    } else {
        dados.detalhesSaidasManha.forEach(function (item) {
            linhas.push(linhaDetalheCupom('- ', item.descricao, item.valor));
        });
    }

    linhas.push(
        '',
        linhaCampoCupom('Saídas Tarde Total', formatarMoeda(dados.saidasTarde)),
        'Detalhes Saídas Tarde:',
        '',
    );

    if (!dados.detalhesSaidasTarde.length) {
        linhas.push('- Sem lançamentos');
    } else {
        dados.detalhesSaidasTarde.forEach(function (item) {
            linhas.push(linhaDetalheCupom('- ', item.descricao, item.valor));
        });
    }

    linhas.push(
        '',
        separador,
        linhaCampoCupom('Saídas (M+T)', formatarMoeda(dados.saidas)),
        separador,
        '',
        ''
    );

    return linhas.map(limitarLinhaCupom).join('\r\n');
}

function gerarCupomElginArquivo(conteudo) {
    baixarArquivo('cupom-elgin.txt', conteudo);
}

async function consultarStatusImpressora() {
    const controller = new AbortController();
    const timeoutId = setTimeout(function () {
        controller.abort();
    }, 3000);

    try {
        const response = await fetch(URL_SERVICO_STATUS, {
            method: 'GET',
            signal: controller.signal
        });

        if (!response.ok) {
            throw new Error(`Serviço respondeu com status ${response.status}.`);
        }

        const status = await response.json();
        if (status.status !== 'ok') {
            throw new Error(status.detalhes || 'Nao foi possivel ler o status da impressora.');
        }

        if (!Array.isArray(status.printers) || status.printers.length === 0) {
            throw new Error('Nenhuma impressora encontrada neste computador. Verifique se a Elgin i9 esta instalada no Windows e ligada.');
        }

        if (!status.printer) {
            throw new Error('Nao foi possivel selecionar uma impressora para impressao.');
        }

        return status;
    } catch (erro) {
        if (erro.name === 'AbortError') {
            throw new Error('Servico de impressao local nao respondeu em tempo habil.');
        }
        throw erro;
    } finally {
        clearTimeout(timeoutId);
    }
}

async function imprimirViaServicoLocal(conteudo) {
    const status = await consultarStatusImpressora();
    const controller = new AbortController();
    const timeoutId = setTimeout(function () {
        controller.abort();
    }, 12000);

    try {
        // Prioriza RAW ESC/POS, que costuma ser mais confiavel na Elgin i9 (USB).
        const responseTexto = await fetch(URL_SERVICO_IMPRESSAO, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal: controller.signal,
            body: JSON.stringify({
                texto: conteudo,
                impressora: status.printer
            })
        });

        if (responseTexto.ok) {
            const resultadoTexto = await responseTexto.json();
            if (resultadoTexto.status === 'Impresso com sucesso') {
                resultadoTexto.printers = status.printers;
                resultadoTexto.modo = 'texto';
                return resultadoTexto;
            }
        }

        // Fallback para imagem quando RAW falhar.
        const responseImagem = await fetch(URL_SERVICO_IMPRESSAO_IMAGEM, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal: controller.signal,
            body: JSON.stringify({
                linhas: String(conteudo || '').split(/\r?\n/),
                impressora: status.printer
            })
        });

        if (!responseImagem.ok) {
            throw new Error(`Serviço respondeu com status ${responseImagem.status}.`);
        }

        const resultadoImagem = await responseImagem.json();
        if (resultadoImagem.status !== 'Impresso como imagem com sucesso') {
            throw new Error(resultadoImagem.detalhes || 'Falha ao imprimir via serviço local.');
        }

        resultadoImagem.printers = status.printers;
        resultadoImagem.modo = 'imagem';
        return resultadoImagem;
    } catch (erro) {
        if (erro.name === 'AbortError') {
            throw new Error('Tempo limite ao tentar imprimir no serviço local.');
        }
        throw erro;
    } finally {
        clearTimeout(timeoutId);
    }
}

async function imprimirOuGerarFallback(conteudo, tipoCupom) {
    try {
        const resultado = await imprimirViaServicoLocal(conteudo);
        const nomeImpressora = resultado.printer || 'impressora local';
        const modo = resultado.modo === 'imagem' ? 'imagem' : 'texto';
        alert(`Impressão ${tipoCupom} enviada com sucesso para ${nomeImpressora} (modo ${modo}).`);
    } catch (erro) {
        console.error('Erro na impressão via serviço local:', erro);
        alert(`Nao foi possivel imprimir ${tipoCupom} automaticamente. Um arquivo cupom-elgin.txt sera baixado para impressao manual.\n\nDetalhes: ${erro.message}`);
        gerarCupomElginArquivo(conteudo);
    }
}

async function salvarFechamentoFinalNoBanco(dados) {
    try {
        await requisicaoJson(URL_API_FECHAMENTOS_FINAIS, {
            method: 'POST',
            body: JSON.stringify(dados)
        });
        return true;
    } catch (erro) {
        console.warn('Nao foi possivel salvar fechamento final no banco.', erro);
        return false;
    }
}

async function carregarHistoricoParciaisPorData(data) {
    const resultado = await requisicaoJson(`${URL_API_PARCIAIS}?date=${encodeURIComponent(data)}`);
    return Array.isArray(resultado.items) ? resultado.items : [];
}

async function carregarHistoricoFinaisPorData(data) {
    const resultado = await requisicaoJson(`${URL_API_FECHAMENTOS_FINAIS}?date=${encodeURIComponent(data)}`);
    return Array.isArray(resultado.items) ? resultado.items : [];
}

function atualizarPreviewHistorico(texto) {
    const preview = document.getElementById('history-preview');
    if (!preview) return;
    preview.textContent = texto || 'Selecione um relatorio para visualizar aqui.';
}

function fecharPopupHistorico() {
    const modal = document.getElementById('history-modal');
    if (!modal) return;
    modal.hidden = true;
}

function abrirPopupHistorico(titulo, conteudo) {
    const modal = document.getElementById('history-modal');
    const modalTitulo = document.getElementById('history-modal-title');
    const modalPreview = document.getElementById('history-modal-preview');
    if (!modal || !modalTitulo || !modalPreview) return;
    modalTitulo.textContent = titulo;
    modalPreview.textContent = conteudo;
    modal.hidden = false;
}

function renderizarListaHistorico(containerId, itens, tipo) {
    const container = document.getElementById(containerId);
    if (!container) return;

    if (!itens.length) {
        container.innerHTML = '<p class="helper-line">Nenhum relatorio encontrado para o dia selecionado.</p>';
        return;
    }

    container.innerHTML = itens.map(function (item, indice) {
        const titulo = tipo === 'parcial'
            ? `${item.operador || '-'} • ${formatarMoeda(item.valor)}`
            : `${item.finalOperador || '-'} • ${formatarMoeda(item.total)}`;
        const meta = tipo === 'parcial'
            ? `${formatarDataHora(item.datahora)}<br>Fechamento parcial`
            : `${formatarDataHora(item.createdAt || item.parcialDataHora)}<br>Inicial: ${item.parcialOperador || '-'} • Final: ${item.finalOperador || '-'}`;
        const visualizarAcao = tipo === 'parcial' ? `visualizarHistoricoParcial(${indice})` : `visualizarHistoricoFinal(${indice})`;
        const imprimirAcao = tipo === 'parcial' ? `imprimirHistoricoParcial(${indice})` : `imprimirHistoricoFinal(${indice})`;
        const deletarAcao = tipo === 'parcial' ? `deletarHistoricoParcial(${indice})` : `deletarHistoricoFinal(${indice})`;

        return `
            <article class="history-item">
                <p class="history-item-title">${titulo}</p>
                <p class="history-item-meta">${meta}</p>
                <div class="history-item-actions">
                    <button type="button" class="action-button subtle" onclick="${visualizarAcao}">Visualizar</button>
                    <button type="button" class="action-button secondary" onclick="${imprimirAcao}">Imprimir</button>
                    <button type="button" class="action-button subtle" onclick="${deletarAcao}" style="color: #ff6b6b;">✕ Deletar</button>
                </div>
            </article>
        `;
    }).join('');
}

function visualizarHistoricoParcial(indice) {
    const item = historicoParciais[indice];
    if (!item) return;
    const conteudo = gerarConteudoParcialTexto(item);
    atualizarPreviewHistorico(conteudo);
    abrirPopupHistorico('Visualizacao • Fechamento Parcial', conteudo);
}

function visualizarHistoricoFinal(indice) {
    const item = historicoFinais[indice];
    if (!item) return;
    const conteudo = gerarConteudoFinalTexto(item);
    atualizarPreviewHistorico(conteudo);
    abrirPopupHistorico('Visualizacao • Fechamento Final', conteudo);
}

async function imprimirHistoricoParcial(indice) {
    const item = historicoParciais[indice];
    if (!item) return;
    const conteudo = gerarConteudoParcialTexto(item);
    atualizarPreviewHistorico(conteudo);
    await imprimirOuGerarFallback(conteudo, 'do fechamento parcial historico');
}

async function imprimirHistoricoFinal(indice) {
    const item = historicoFinais[indice];
    if (!item) return;
    const conteudo = gerarConteudoFinalTexto(item);
    atualizarPreviewHistorico(conteudo);
    await imprimirOuGerarFallback(conteudo, 'do fechamento final historico');
}

async function deletarHistoricoParcial(indice) {
    const item = historicoParciais[indice];
    if (!item || !item.id) return;
    
    const confirmar = window.confirm(`Deletar fechamento parcial de ${item.operador}?`);
    if (!confirmar) return;
    
    const senha = window.prompt('Digite a senha para confirmar a exclusão:');
    if (senha === null || senha === '') return;
    
    try {
        await requisicaoJson(`${URL_API_PARCIAIS}?id=${item.id}`, {
            method: 'DELETE',
            body: JSON.stringify({ senha })
        });
        alert('Fechamento parcial deletado com sucesso.');
        await carregarHistoricoPorData();
    } catch (erro) {
        console.error('Erro ao deletar parcial:', erro);
        alert('Nao foi possivel deletar. Verifique a senha.');
    }
}

async function deletarHistoricoFinal(indice) {
    const item = historicoFinais[indice];
    if (!item || !item.id) return;
    
    const confirmar = window.confirm(`Deletar fechamento final de ${item.finalOperador}?`);
    if (!confirmar) return;
    
    const senha = window.prompt('Digite a senha para confirmar a exclusão:');
    if (senha === null || senha === '') return;
    
    try {
        await requisicaoJson(`${URL_API_FECHAMENTOS_FINAIS}?id=${item.id}`, {
            method: 'DELETE',
            body: JSON.stringify({ senha })
        });
        alert('Fechamento final deletado com sucesso.');
        await carregarHistoricoPorData();
    } catch (erro) {
        console.error('Erro ao deletar final:', erro);
        alert('Nao foi possivel deletar. Verifique a senha.');
    }
}

async function carregarHistoricoPorData() {
    const campoData = document.getElementById('history-date');
    if (!campoData) return;

    const data = campoData.value || formatarDataParaFiltro();
    if (!data) return;
    campoData.value = data;

    try {
        const [parciais, finais] = await Promise.all([
            carregarHistoricoParciaisPorData(data),
            carregarHistoricoFinaisPorData(data)
        ]);
        historicoParciais = parciais;
        historicoFinais = finais;
        document.getElementById('history-partials-count').textContent = String(parciais.length);
        document.getElementById('history-finals-count').textContent = String(finais.length);
        renderizarListaHistorico('history-partials-list', parciais, 'parcial');
        renderizarListaHistorico('history-finals-list', finais, 'final');
        atualizarPreviewHistorico();
    } catch (erro) {
        console.error('Erro ao carregar historico por data:', erro);
        document.getElementById('history-partials-count').textContent = '0';
        document.getElementById('history-finals-count').textContent = '0';
        document.getElementById('history-partials-list').innerHTML = '<p class="helper-line">Nao foi possivel carregar os parciais.</p>';
        document.getElementById('history-finals-list').innerHTML = '<p class="helper-line">Nao foi possivel carregar os finais.</p>';
        atualizarPreviewHistorico('Falha ao carregar historico do dia selecionado.');
    }
}

function carregarListaParciais() {
    try {
        const lista = JSON.parse(localStorage.getItem(CHAVE_PARCIAIS) || '[]');
        if (!Array.isArray(lista)) return [];
        return lista
            .filter(function (item) {
                return item && item.operador;
            })
            .map(function (item) {
                return {
                    operador: String(item.operador).trim(),
                    datahora: item.datahora || '',
                    valor: paraNumero(item.valor)
                };
            });
    } catch (_erro) {
        return [];
    }
}

function renderizarOperadoresCadastrados() {
    const container = document.getElementById('operators-list');
    if (!container) return;

    if (!operadoresCadastrados.length) {
        container.innerHTML = '<p class="helper-line">Nenhum caixa cadastrado.</p>';
        return;
    }

    container.innerHTML = operadoresCadastrados.map(function (nome) {
        return `<span class="operator-tag">${nome}<button type="button" class="operator-remove" onclick="excluirCaixa('${nome.replace(/'/g, "\\'")}')">Excluir</button></span>`;
    }).join('');
}

function popularOperadoresParcial() {
    const select = document.getElementById('parcial-operador');
    if (!select) return;

    const valorAtual = select.value;
    const operadoresDoHistorico = carregarListaParciais().map(function (item) { return item.operador; });
    const unicos = Array.from(new Set([...
        operadoresCadastrados,
        ...operadoresDoHistorico,
        valorAtual
    ].filter(Boolean)));

    select.innerHTML = '<option value="">Selecione o caixa</option>';
    unicos.forEach(function (nome) {
        const option = document.createElement('option');
        option.value = nome;
        option.textContent = nome;
        select.appendChild(option);
    });

    if (valorAtual && unicos.includes(valorAtual)) {
        select.value = valorAtual;
    }
}

function popularOperadoresFechamentoFinal() {
    const select = document.getElementById('operador-final');
    if (!select) return;

    const valorAtual = select.value;
    const unicos = Array.from(new Set([
        ...operadoresCadastrados,
        ...carregarListaParciais().map(function (item) { return item.operador; }),
        valorAtual
    ].filter(Boolean)));

    select.innerHTML = '<option value="">Selecione o caixa que esta fechando</option>';
    unicos.forEach(function (nome) {
        const option = document.createElement('option');
        option.value = nome;
        option.textContent = nome;
        select.appendChild(option);
    });

    if (valorAtual && unicos.includes(valorAtual)) {
        select.value = valorAtual;
    }
}

async function cadastrarCaixa() {
    const input = document.getElementById('operator-new-name');
    if (!input) return;
    const nome = input.value.trim();
    if (!nome) {
        alert('Digite o nome do caixa para cadastrar.');
        return;
    }

    try {
        await salvarOperadorNoBanco(nome);
        input.value = '';
        await carregarOperadoresDoBanco();
        renderizarOperadoresCadastrados();
        popularOperadoresParcial();
        popularOperadoresFechamentoFinal();
    } catch (erro) {
        console.error('Erro ao cadastrar caixa:', erro);
        alert('Nao foi possivel cadastrar o caixa agora.');
    }
}

async function excluirCaixa(nome) {
    if (!nome) return;
    const confirmar = window.confirm(`Excluir o caixa ${nome}?`);
    if (!confirmar) return;

    const senha = window.prompt('Digite a senha para confirmar a exclusão:');
    if (senha === null || senha === '') return;

    try {
        await excluirOperadorNoBanco(nome, senha);
        await carregarOperadoresDoBanco();
        renderizarOperadoresCadastrados();
        popularOperadoresParcial();
        popularOperadoresFechamentoFinal();
        alert('Caixa excluído com sucesso.');
    } catch (erro) {
        console.error('Erro ao excluir caixa:', erro);
        alert('Nao foi possivel excluir o caixa agora. Verifique a senha.');
    }
}

function salvarListaParciais(lista) {
    localStorage.setItem(CHAVE_PARCIAIS, JSON.stringify(lista));
}

function salvarOuAtualizarParcial(parcial) {
    const chave = parcial.operador.trim().toLowerCase();
    const listaAtual = carregarListaParciais();
    const listaSemDuplicado = listaAtual.filter(function (item) {
        return item.operador.trim().toLowerCase() !== chave;
    });
    listaSemDuplicado.unshift(parcial);
    salvarListaParciais(listaSemDuplicado.slice(0, 30));
}

function popularOperadoresFinal() {
    const select = document.getElementById('operador-parcial');
    if (!select) return;

    const valorAtual = select.value;
    const listaParciais = carregarListaParciais();
    select.innerHTML = '';

    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = 'Selecione um caixa salvo no parcial';
    select.appendChild(placeholder);

    listaParciais.forEach(function (parcial) {
        const option = document.createElement('option');
        option.value = parcial.operador;
        option.textContent = `${parcial.operador} - ${formatarMoeda(parcial.valor)}`;
        select.appendChild(option);
    });

    if (valorAtual && listaParciais.some(function (item) { return item.operador === valorAtual; })) {
        select.value = valorAtual;
    } else if (listaParciais.length) {
        select.value = listaParciais[0].operador;
    } else {
        select.value = '';
    }
}

function obterParcialSelecionadoNoFinal() {
    const operadorSelecionado = (document.getElementById('operador-parcial').value || '').trim();
    const listaParciais = carregarListaParciais();
    const parcialSelecionado = listaParciais.find(function (item) {
        return item.operador === operadorSelecionado;
    });

    if (parcialSelecionado) return parcialSelecionado;

    const bruto = localStorage.getItem(CHAVE_PARCIAL);
    if (!bruto) return null;
    const parcialUnico = JSON.parse(bruto);
    return {
        operador: parcialUnico.operador || '-',
        datahora: parcialUnico.datahora || '',
        valor: paraNumero(parcialUnico.valor)
    };
}

async function salvarParcial() {
    const operador = document.getElementById('parcial-operador').value.trim();
    const datahora = document.getElementById('parcial-datahora').value;
    const valor = paraNumero(document.getElementById('parcial-valor').value);
    if (!operador || !datahora) {
        document.getElementById('parcial-status').textContent = 'Preencha nome do caixa e data/hora.';
        return false;
    }
    const parcial = { operador, datahora, valor };
    localStorage.setItem(CHAVE_PARCIAL, JSON.stringify(parcial));
    salvarOuAtualizarParcial(parcial);
    document.getElementById('parcial-total').textContent = formatarMoeda(valor);
    const salvouNoBanco = await salvarParcialNoBanco(parcial);
    document.getElementById('parcial-status').textContent = salvouNoBanco
        ? 'Fechamento parcial salvo com sucesso e sincronizado no banco.'
        : 'Fechamento parcial salvo apenas neste dispositivo. Banco indisponivel.';
    carregarParcialNoFinal();
    return true;
}

async function salvarParcialEImprimir() {
    const salvo = await salvarParcial();
    if (!salvo) return;
    const bruto = localStorage.getItem(CHAVE_PARCIAL);
    if (!bruto) return;
    const parcial = JSON.parse(bruto);

    const conteudo = gerarConteudoParcialTexto({
        operador: parcial.operador || '-',
        datahora: parcial.datahora || '-',
        valor: paraNumero(parcial.valor)
    });

    await imprimirOuGerarFallback(conteudo, 'do fechamento parcial');
}

function carregarParcialNoFinal() {
    popularOperadoresFinal();
    const parcial = obterParcialSelecionadoNoFinal();
    if (!parcial) {
        document.getElementById('final-parcial-valor').textContent = 'R$ 0,00';
        document.getElementById('final-parcial-operador').textContent = '-';
        document.getElementById('final-parcial-datahora').textContent = '-';
        return;
    }
    document.getElementById('final-parcial-valor').textContent = formatarMoeda(parcial.valor);
    document.getElementById('final-parcial-operador').textContent = parcial.operador || '-';
    document.getElementById('final-parcial-datahora').textContent = formatarDataHora(parcial.datahora || '-');
}

function adicionarSaida(periodo, descricao = '', valor = '') {
    const lista = document.getElementById(`saidas-${periodo}-list`);
    const item = document.createElement('div');
    item.className = 'subfield-item';
    const descricaoInput = document.createElement('input');
    descricaoInput.type = 'text';
    descricaoInput.className = 'saida-descricao';
    descricaoInput.placeholder = 'Descrição';
    descricaoInput.value = descricao;
    const valorInput = document.createElement('input');
    valorInput.type = 'number';
    valorInput.className = 'saida-valor';
    valorInput.placeholder = 'Valor';
    valorInput.step = '0.01';
    valorInput.value = valor;
    const removerBotao = document.createElement('button');
    removerBotao.type = 'button';
    removerBotao.className = 'remove-item-button';
    removerBotao.setAttribute('aria-label', 'Remover saída');
    removerBotao.textContent = 'Remover';
    valorInput.addEventListener('input', function () {
        atualizarTotalSaidas(periodo);
    });
    removerBotao.addEventListener('click', function () {
        item.remove();
        atualizarTotalSaidas(periodo);
    });
    item.appendChild(descricaoInput);
    item.appendChild(valorInput);
    item.appendChild(removerBotao);
    lista.appendChild(item);
    atualizarTotalSaidas(periodo);
}

function adicionarSaidaManha(descricao = '', valor = '') {
    adicionarSaida('manha', descricao, valor);
}

function adicionarSaidaTarde(descricao = '', valor = '') {
    adicionarSaida('tarde', descricao, valor);
}

function obterDetalhesSaidas(periodo) {
    const itens = Array.from(document.querySelectorAll(`#saidas-${periodo}-list .subfield-item`));
    return itens
        .map(function (item) {
            const descricao = item.querySelector('.saida-descricao').value.trim();
            const valor = paraNumero(item.querySelector('.saida-valor').value);
            return { descricao: descricao || 'Sem descrição', valor };
        })
        .filter(function (item) {
            return item.valor > 0 || item.descricao !== 'Sem descrição';
        });
}

function preencherCupom(dados) {
    normalizarDadosCupom(dados);
    document.getElementById('print-parcial-datahora').textContent = formatarDataHora(dados.parcialDataHora);
    document.getElementById('print-parcial-operador').textContent = dados.parcialOperador || '-';
    document.getElementById('print-parcial-valor').textContent = formatarMoeda(dados.parcialValor);
    document.getElementById('print-final-operador').textContent = dados.finalOperador || '-';
    const infoCompartilhado = document.getElementById('print-compartilhado-info');
    infoCompartilhado.textContent = dados.caixaCompartilhado
        ? `Caixa compartilhado: iniciou na manhã com ${dados.parcialOperador || '-'} (${formatarMoeda(dados.parcialValor)}) e terminou com ${dados.finalOperador || '-'}.`
        : 'Caixa compartilhado: não';
    document.getElementById('print-debito').textContent = formatarMoeda(dados.debito);
    document.getElementById('print-credito').textContent = formatarMoeda(dados.credito);
    const rowAlimentacao = document.getElementById('print-alimentacao-row');
    rowAlimentacao.style.display = dados.alimentacao > 0 ? 'block' : 'none';
    document.getElementById('print-alimentacao').textContent = formatarMoeda(dados.alimentacao);
    document.getElementById('print-pix').textContent = formatarMoeda(dados.pix);
    const rowTransferencia = document.getElementById('print-transferencia-row');
    rowTransferencia.style.display = dados.transferencia > 0 ? 'block' : 'none';
    document.getElementById('print-transferencia').textContent = formatarMoeda(dados.transferencia);
    document.getElementById('print-sistema').textContent = formatarMoeda(dados.sistema);
    document.getElementById('print-dinheiro-agenda').textContent = formatarMoeda(dados.dinheiroAgenda);
    const elEnvelope = document.getElementById('print-envelope-noite');
    if (elEnvelope) elEnvelope.textContent = formatarMoeda(dados.envelopeNoite);
    const elApurado = document.getElementById('print-apurado');
    if (elApurado) elApurado.textContent = formatarMoeda(dados.apurado);
    const elEsperado = document.getElementById('print-esperado');
    if (elEsperado) elEsperado.textContent = formatarMoeda(dados.esperado);
    const elDiferenca = document.getElementById('print-diferenca');
    if (elDiferenca) elDiferenca.textContent = formatarMoeda(dados.diferenca);
    document.getElementById('print-total-cartao').textContent = formatarMoeda(dados.totalCartao);
    document.getElementById('print-total-pix').textContent = formatarMoeda(dados.totalPixTransferencia);
    document.getElementById('print-saidas-manha-total').textContent = formatarMoeda(dados.saidasManha);
    document.getElementById('print-saidas-tarde').textContent = formatarMoeda(dados.saidasTarde);
    document.getElementById('print-saidas').textContent = formatarMoeda(dados.saidas);
    const lista = document.getElementById('print-saidas-manha-list');
    lista.innerHTML = '';
    if (!dados.detalhesSaidasManha.length) {
        const vazio = document.createElement('li');
        vazio.textContent = 'Sem lançamentos';
        lista.appendChild(vazio);
    } else {
        dados.detalhesSaidasManha.forEach(function (item) {
            const li = document.createElement('li');
            li.textContent = `${item.descricao}: ${formatarMoeda(item.valor)}`;
            lista.appendChild(li);
        });
    }

    const listaTarde = document.getElementById('print-saidas-tarde-list');
    listaTarde.innerHTML = '';
    if (!dados.detalhesSaidasTarde.length) {
        const vazio = document.createElement('li');
        vazio.textContent = 'Sem lançamentos';
        listaTarde.appendChild(vazio);
        return;
    }

    dados.detalhesSaidasTarde.forEach(function (item) {
        const li = document.createElement('li');
        li.textContent = `${item.descricao}: ${formatarMoeda(item.valor)}`;
        listaTarde.appendChild(li);
    });
}

function montarDadosCupom() {
    const parcialSelecionado = obterParcialSelecionadoNoFinal() || {};
    const caixaCompartilhado = !!document.getElementById('caixa-compartilhado').checked;
    const finalOperadorInput = (document.getElementById('operador-final').value || '').trim();
    const debito = paraNumero(document.getElementById('cartao-debito').value);
    const credito = paraNumero(document.getElementById('cartao-credito').value);
    const alimentacao = paraNumero(document.getElementById('cartao-alimentacao').value);
    const pix = paraNumero(document.getElementById('pix').value);
    const transferencia = paraNumero(document.getElementById('transferencia').value);
    const sistema = paraNumero(document.getElementById('sistema').value);
    const dinheiroAgenda = paraNumero(document.getElementById('dinheiro-agenda').value);
    const envelopeNoite = paraNumero(document.getElementById('envelope-noite').value);
    const saidasManha = paraNumero(document.getElementById('saidas-manha').value);
    const saidasTarde = paraNumero(document.getElementById('saidas-tarde').value);
    const parcialValor = paraNumero(parcialSelecionado.valor);
    // Apurado = dinheiro fisico real (parcial contado + envelope da noite).
    // Esperado = o que deveria ter (sistema + dinheiro da agenda).
    // Diferenca = Apurado - Esperado (positivo = sobra; negativo = falta).
    const apurado = parcialValor + envelopeNoite;
    const esperado = sistema + dinheiroAgenda;
    const diferenca = apurado - esperado;
    const totalDinheiro = apurado; // mantido por compatibilidade
    const totalCartao = debito + credito + alimentacao;
    const totalPixTransferencia = pix + transferencia;
    const saidas = saidasManha + saidasTarde;
    return {
        parcialDataHora: parcialSelecionado.datahora || document.getElementById('parcial-datahora').value,
        parcialOperador: parcialSelecionado.operador || document.getElementById('parcial-operador').value || '-',
        parcialValor,
        finalOperador: finalOperadorInput || parcialSelecionado.operador || '-',
        caixaCompartilhado,
        debito,
        credito,
        alimentacao,
        pix,
        transferencia,
        sistema,
        dinheiroAgenda,
        envelopeNoite,
        apurado,
        esperado,
        diferenca,
        totalDinheiro,
        totalCartao,
        totalPixTransferencia,
        saidasManha,
        detalhesSaidasManha: obterDetalhesSaidas('manha'),
        saidasTarde,
        detalhesSaidasTarde: obterDetalhesSaidas('tarde'),
        total: 0,
        saidas
    };
}

function confirmarOperadorFinalSeCompartilhado() {
    const caixaCompartilhado = !!document.getElementById('caixa-compartilhado').checked;
    if (!caixaCompartilhado) return true;

    const campoNomeFinal = document.getElementById('operador-final');
    if ((campoNomeFinal.value || '').trim()) return true;
    alert('Selecione o caixa que esta fechando agora.');
    return false;
}

function atualizarVisibilidadeOperadorFinal() {
    const caixaCompartilhado = !!document.getElementById('caixa-compartilhado').checked;
    const blocoOperadorFinal = document.getElementById('bloco-operador-final');
    const campoNomeFinal = document.getElementById('operador-final');

    blocoOperadorFinal.style.display = caixaCompartilhado ? 'block' : 'none';
    if (!caixaCompartilhado) {
        campoNomeFinal.value = '';
    }
}

function atualizarTotalSaidas(periodo) {
    const valores = document.querySelectorAll(`#saidas-${periodo}-list .saida-valor`);
    let soma = 0;
    valores.forEach(function (input) {
        soma += paraNumero(input.value);
    });

    const campoDestino = periodo === 'manha' ? 'saidas-manha' : 'saidas-tarde';
    document.getElementById(campoDestino).value = soma.toFixed(2);
}

function calcularFinal() {
    if (!confirmarOperadorFinalSeCompartilhado()) {
        return null;
    }
    const dados = montarDadosCupom();
    document.getElementById('final-total-cartao').textContent = formatarMoeda(dados.totalCartao);
    document.getElementById('final-total-pix-transferencia').textContent = formatarMoeda(dados.totalPixTransferencia);
    const elApurado = document.getElementById('final-apurado');
    if (elApurado) elApurado.textContent = formatarMoeda(dados.apurado);
    const elEsperado = document.getElementById('final-esperado');
    if (elEsperado) elEsperado.textContent = formatarMoeda(dados.esperado);
    const elDif = document.getElementById('final-diferenca');
    if (elDif) elDif.textContent = formatarMoeda(dados.diferenca);
    preencherCupom(dados);
    return dados;
}

async function imprimirFechamentoFinal() {
    const dados = calcularFinal();
    if (!dados) return;
    localStorage.setItem(CHAVE_ULTIMO_CUPOM, JSON.stringify(dados));
    await salvarFechamentoFinalNoBanco(dados);
    const conteudo = gerarConteudoFinalTexto(dados);
    await imprimirOuGerarFallback(conteudo, 'do fechamento final');
}

async function reimprimirUltimoCupom() {
    const bruto = localStorage.getItem(CHAVE_ULTIMO_CUPOM);
    if (!bruto) {
        alert('Nenhum cupom anterior encontrado para reimpressão.');
        return;
    }
    const dados = JSON.parse(bruto);
    preencherCupom(dados);
    const conteudo = gerarConteudoFinalTexto(dados);
    await imprimirOuGerarFallback(conteudo, 'final (reimpressão)');
}

document.addEventListener('DOMContentLoaded', async function () {
    const campoDataHora = document.getElementById('parcial-datahora');
    if (campoDataHora && !campoDataHora.value) {
        const agora = new Date();
        const localISO = new Date(agora.getTime() - (agora.getTimezoneOffset() * 60000)).toISOString().slice(0, 16);
        campoDataHora.value = localISO;
    }
    adicionarSaidaManha('Gasolina', '0');
    adicionarSaidaTarde('Passagem', '0');
    atualizarTotalSaidas('manha');
    atualizarTotalSaidas('tarde');
    const parcialBruto = localStorage.getItem(CHAVE_PARCIAL);
    if (parcialBruto) {
        const parcial = JSON.parse(parcialBruto);
        document.getElementById('parcial-operador').value = parcial.operador || '';
        document.getElementById('parcial-datahora').value = parcial.datahora || campoDataHora.value;
        document.getElementById('parcial-valor').value = Number(parcial.valor || 0).toFixed(2);
        document.getElementById('parcial-total').textContent = formatarMoeda(parcial.valor || 0);
        document.getElementById('parcial-status').textContent = 'Último fechamento parcial carregado.';
    }

    const selectOperadorParcial = document.getElementById('operador-parcial');
    if (selectOperadorParcial) {
        selectOperadorParcial.addEventListener('change', function () {
            carregarParcialNoFinal();
        });
    }

    const checkboxCompartilhado = document.getElementById('caixa-compartilhado');
    if (checkboxCompartilhado) {
        checkboxCompartilhado.addEventListener('change', function () {
            atualizarVisibilidadeOperadorFinal();
        });
    }

    atualizarVisibilidadeOperadorFinal();

    const campoHistorico = document.getElementById('history-date');
    if (campoHistorico) {
        campoHistorico.value = formatarDataParaFiltro();
    }

    await carregarParciaisDoBanco();
    await carregarOperadoresDoBanco();
    renderizarOperadoresCadastrados();
    popularOperadoresParcial();
    popularOperadoresFechamentoFinal();
    await carregarHistoricoPorData();
    carregarParcialNoFinal();
    const defaultButton = document.querySelector('.tab-button[data-tab="parcial"]');
    openTab('parcial', defaultButton);
});