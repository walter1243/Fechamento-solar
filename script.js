const CHAVE_PARCIAL = 'fechamento_parcial_v1';
const CHAVE_PARCIAIS = 'fechamentos_parciais_v1';
const CHAVE_ULTIMO_CUPOM = 'ultimo_cupom_v1';
const URL_SERVICO_IMPRESSAO = 'http://127.0.0.1:8000/imprimir';
const API_BASE_URL = window.location.protocol === 'file:'
    ? 'https://fechamento-solar.vercel.app'
    : window.location.origin;
const URL_API_PARCIAIS = `${API_BASE_URL}/api/parciais`;
const URL_API_FECHAMENTOS_FINAIS = `${API_BASE_URL}/api/fechamentos-finais`;

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

function gerarConteudoParcialTexto(parcial) {
    const linhas = [
        'FECHAMENTO PARCIAL',
        '',
        '--------------------------------',
        '',
        `Data/Hora: ${formatarDataHora(parcial.datahora)}`,
        '',
        `Caixa Parcial: ${parcial.operador || '-'}`,
        '',
        `Valor Parcial: ${formatarMoeda(parcial.valor)}`,
        '',
        '--------------------------------',
        '',
        ''
    ];
    return linhas.join('\r\n');
}

function gerarConteudoFinalTexto(dados) {
    const linhas = [
        'FECHAMENTO FINAL',
        '',
        '--------------------------------',
        '',
        `Data/Hora Parcial: ${formatarDataHora(dados.parcialDataHora)}`,
        '',
        `Caixa Parcial: ${dados.parcialOperador || '-'}`,
        '',
        `Valor Parcial: ${formatarMoeda(dados.parcialValor)}`,
        '',
        '--------------------------------',
        '',
        `Operador Final: ${dados.finalOperador || '-'}`,
        '',
        `Cartao Debito: ${formatarMoeda(dados.debito)}`,
        '',
        `Cartao Credito: ${formatarMoeda(dados.credito)}`,
        ''
    ];

    if (dados.caixaCompartilhado) {
        linhas.push(`Caixa Compartilhado: iniciou com ${dados.parcialOperador || '-'} (${formatarMoeda(dados.parcialValor)}) e terminou com ${dados.finalOperador || '-'}`);
        linhas.push('');
    }

    if (dados.alimentacao > 0) {
        linhas.push(`Cartao Alimentacao: ${formatarMoeda(dados.alimentacao)}`);
        linhas.push('');
    }

    linhas.push(`PIX: ${formatarMoeda(dados.pix)}`);
    linhas.push('');

    if (dados.transferencia > 0) {
        linhas.push(`Transferencia: ${formatarMoeda(dados.transferencia)}`);
        linhas.push('');
    }

    linhas.push(`Sistema: ${formatarMoeda(dados.sistema)}`);
    linhas.push('');
    linhas.push(`Dinheiro Agenda: ${formatarMoeda(dados.dinheiroAgenda)}`);
    linhas.push('');
    linhas.push(`Total Dinheiro (Sistema + Agenda): ${formatarMoeda(dados.totalDinheiro)}`);
    linhas.push('');
    linhas.push(`Total Cartao: ${formatarMoeda(dados.totalCartao)}`);
    linhas.push('');
    linhas.push(`Total PIX/Transf: ${formatarMoeda(dados.totalPixTransferencia)}`);
    linhas.push('');
    linhas.push(`Saidas Manha Total: ${formatarMoeda(dados.saidasManha)}`);
    linhas.push('');
    linhas.push('Detalhes Saidas Manha:');

    if (!dados.detalhesSaidasManha.length) {
        linhas.push('- Sem lancamentos');
    } else {
        dados.detalhesSaidasManha.forEach(function (item) {
            linhas.push(`- ${item.descricao}: ${formatarMoeda(item.valor)}`);
        });
    }

    linhas.push('');
    linhas.push(`Saidas Tarde Total: ${formatarMoeda(dados.saidasTarde)}`);
    linhas.push('');
    linhas.push('Detalhes Saidas Tarde:');

    if (!dados.detalhesSaidasTarde.length) {
        linhas.push('- Sem lancamentos');
    } else {
        dados.detalhesSaidasTarde.forEach(function (item) {
            linhas.push(`- ${item.descricao}: ${formatarMoeda(item.valor)}`);
        });
    }

    linhas.push('');
    linhas.push(`Total Final (sem parcial): ${formatarMoeda(dados.total)}`);
    linhas.push('');
    linhas.push(`Saidas (M+T): ${formatarMoeda(dados.saidas)}`);
    linhas.push('');
    linhas.push('Diferenca:');
    linhas.push('');
    linhas.push('--------------------------------');
    linhas.push('');
    return linhas.join('\r\n');
}

function gerarCupomElginArquivo(conteudo) {
    baixarArquivo('cupom-elgin.txt', conteudo);
}
async function imprimirViaServicoLocal(conteudo) {
    const response = await fetch(URL_SERVICO_IMPRESSAO, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ texto: conteudo })
    });

    if (!response.ok) {
        throw new Error(`Serviço respondeu com status ${response.status}.`);
    }

    const resultado = await response.json();
    if (resultado.status !== 'Impresso com sucesso') {
        throw new Error(resultado.detalhes || 'Falha ao imprimir via serviço local.');
    }

    return resultado;
}

async function imprimirOuGerarFallback(conteudo, tipoCupom) {
    try {
        await imprimirViaServicoLocal(conteudo);
        alert(`Impressão ${tipoCupom} enviada com sucesso para a Elgin i9.`);
    } catch (erro) {
        console.error('Erro na impressão via serviço local:', erro);
        gerarCupomElginArquivo(conteudo);
        alert('O serviço local de impressão não está rodando ou falhou. O arquivo cupom-elgin.txt foi gerado para impressão via BAT.');
    }
}

function openTab(tabName, clickedButton) {
    const tabs = document.querySelectorAll('.tab-content');

    tabs.forEach(tab => tab.style.display = 'none');
    const buttons = document.querySelectorAll('.tab-button');
    buttons.forEach(button => button.classList.remove('active'));
    document.getElementById(tabName).style.display = 'block';
    if (clickedButton) clickedButton.classList.add('active');
    if (tabName === 'final') carregarParcialNoFinal();
}

async function requisicaoJson(url, options = {}) {
    const response = await fetch(url, {
        headers: {
            'Content-Type': 'application/json',
            ...(options.headers || {})
        },
        ...options
    });

    if (!response.ok) {
        throw new Error(`Falha na API (${response.status})`);
    }

    return response.json();
}

async function carregarParciaisDoBanco() {
    try {
        const resultado = await requisicaoJson(URL_API_PARCIAIS);
        const lista = Array.isArray(resultado.items) ? resultado.items : [];
        salvarListaParciais(lista);
        if (lista.length) {
            localStorage.setItem(CHAVE_PARCIAL, JSON.stringify(lista[0]));
        }
        return true;
    } catch (erro) {
        console.warn('Nao foi possivel carregar parciais do banco.', erro);
        return false;
    }
}

async function salvarParcialNoBanco(parcial) {
    try {
        await requisicaoJson(URL_API_PARCIAIS, {
            method: 'POST',
            body: JSON.stringify(parcial)
        });
        return true;
    } catch (erro) {
        console.warn('Nao foi possivel salvar parcial no banco.', erro);
        return false;
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
    document.getElementById('print-total-dinheiro').textContent = formatarMoeda(dados.totalDinheiro);
    document.getElementById('print-total-cartao').textContent = formatarMoeda(dados.totalCartao);
    document.getElementById('print-total-pix').textContent = formatarMoeda(dados.totalPixTransferencia);
    document.getElementById('print-saidas-manha-total').textContent = formatarMoeda(dados.saidasManha);
    document.getElementById('print-saidas-tarde').textContent = formatarMoeda(dados.saidasTarde);
    document.getElementById('print-total-final').textContent = formatarMoeda(dados.total);
    document.getElementById('print-saidas').textContent = formatarMoeda(dados.saidas);
    document.getElementById('print-diferenca').textContent = '';
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
    const finalOperadorInput = document.getElementById('operador-final').value.trim();
    const debito = paraNumero(document.getElementById('cartao-debito').value);
    const credito = paraNumero(document.getElementById('cartao-credito').value);
    const alimentacao = paraNumero(document.getElementById('cartao-alimentacao').value);
    const pix = paraNumero(document.getElementById('pix').value);
    const transferencia = paraNumero(document.getElementById('transferencia').value);
    const sistema = paraNumero(document.getElementById('sistema').value);
    const dinheiroAgenda = paraNumero(document.getElementById('dinheiro-agenda').value);
    const saidasManha = paraNumero(document.getElementById('saidas-manha').value);
    const saidasTarde = paraNumero(document.getElementById('saidas-tarde').value);
    const totalDinheiro = sistema + dinheiroAgenda;
    const totalCartao = debito + credito + alimentacao;
    const totalPixTransferencia = pix + transferencia;
    // O valor do parcial eh somente referencia e nunca entra na soma final.
    const total = totalCartao + totalPixTransferencia + totalDinheiro;
    const saidas = saidasManha + saidasTarde;
    return {
        parcialDataHora: parcialSelecionado.datahora || document.getElementById('parcial-datahora').value,
        parcialOperador: parcialSelecionado.operador || document.getElementById('parcial-operador').value || '-',
        parcialValor: paraNumero(parcialSelecionado.valor),
        finalOperador: finalOperadorInput || parcialSelecionado.operador || '-',
        caixaCompartilhado,
        debito,
        credito,
        alimentacao,
        pix,
        transferencia,
        sistema,
        dinheiroAgenda,
        totalDinheiro,
        totalCartao,
        totalPixTransferencia,
        saidasManha,
        detalhesSaidasManha: obterDetalhesSaidas('manha'),
        saidasTarde,
        detalhesSaidasTarde: obterDetalhesSaidas('tarde'),
        total,
        saidas,
        diferenca: null
    };
}

function confirmarOperadorFinalSeCompartilhado() {
    const caixaCompartilhado = !!document.getElementById('caixa-compartilhado').checked;
    if (!caixaCompartilhado) return true;

    const campoNomeFinal = document.getElementById('operador-final');
    if (campoNomeFinal.value.trim()) return true;

    const nome = window.prompt('Caixa compartilhado ativo. Digite o nome de quem está fechando agora:');
    if (!nome || !nome.trim()) {
        alert('Informe o nome de quem está fechando para continuar.');
        return false;
    }
    campoNomeFinal.value = nome.trim();
    return true;
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
    document.getElementById('final-total-dinheiro').textContent = formatarMoeda(dados.totalDinheiro);
    document.getElementById('final-total').textContent = formatarMoeda(dados.total);
    document.getElementById('final-diferenca').textContent = '';
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

    await carregarParciaisDoBanco();
    carregarParcialNoFinal();
    const defaultButton = document.querySelector('.tab-button[data-tab="parcial"]');
    openTab('parcial', defaultButton);
});