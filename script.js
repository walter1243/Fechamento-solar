const CHAVE_PARCIAL = 'fechamento_parcial_v1';
const CHAVE_ULTIMO_CUPOM = 'ultimo_cupom_v1';
const URL_SERVICO_IMPRESSAO = 'http://127.0.0.1:8000/imprimir';

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
        `Nome do Caixa: ${parcial.operador || '-'}`,
        '',
        `Valor do Caixa: ${formatarMoeda(parcial.valor)}`,
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
        '',
        `Cartao Alimentacao: ${formatarMoeda(dados.alimentacao)}`,
        '',
        `PIX: ${formatarMoeda(dados.pix)}`,
        '',
        `Transferencia: ${formatarMoeda(dados.transferencia)}`,
        '',
        `Sistema: ${formatarMoeda(dados.sistema)}`,
        '',
        `Dinheiro Agenda: ${formatarMoeda(dados.dinheiroAgenda)}`,
        '',
        `Total Cartao: ${formatarMoeda(dados.totalCartao)}`,
        '',
        `Total PIX/Transf: ${formatarMoeda(dados.totalPixTransferencia)}`,
        '',
        `Saidas Manha Total: ${formatarMoeda(dados.saidasManha)}`,
        '',
        'Detalhes Saidas Manha:'
    ];

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
    linhas.push(`Total Final: ${formatarMoeda(dados.total)}`);
    linhas.push('');
    linhas.push(`Saidas (M+T): ${formatarMoeda(dados.saidas)}`);
    linhas.push('');
    linhas.push(`Diferenca: ${formatarMoeda(dados.diferenca)}`);
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

function salvarParcial() {
    const operador = document.getElementById('parcial-operador').value.trim();
    const datahora = document.getElementById('parcial-datahora').value;
    const valor = paraNumero(document.getElementById('parcial-valor').value);
    if (!operador || !datahora) {
        document.getElementById('parcial-status').textContent = 'Preencha nome do caixa e data/hora.';
        return false;
    }
    const parcial = { operador, datahora, valor };
    localStorage.setItem(CHAVE_PARCIAL, JSON.stringify(parcial));
    document.getElementById('parcial-total').textContent = formatarMoeda(valor);
    document.getElementById('parcial-status').textContent = 'Fechamento parcial salvo com sucesso.';
    carregarParcialNoFinal();
    return true;
}

async function salvarParcialEImprimir() {
    const salvo = salvarParcial();
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
    const bruto = localStorage.getItem(CHAVE_PARCIAL);
    if (!bruto) {
        document.getElementById('final-parcial-valor').textContent = 'R$ 0,00';
        document.getElementById('final-parcial-operador').textContent = '-';
        document.getElementById('final-parcial-datahora').textContent = '-';
        return;
    }
    const parcial = JSON.parse(bruto);
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
    document.getElementById('print-debito').textContent = formatarMoeda(dados.debito);
    document.getElementById('print-credito').textContent = formatarMoeda(dados.credito);
    document.getElementById('print-alimentacao').textContent = formatarMoeda(dados.alimentacao);
    document.getElementById('print-pix').textContent = formatarMoeda(dados.pix);
    document.getElementById('print-transferencia').textContent = formatarMoeda(dados.transferencia);
    document.getElementById('print-sistema').textContent = formatarMoeda(dados.sistema);
    document.getElementById('print-dinheiro-agenda').textContent = formatarMoeda(dados.dinheiroAgenda);
    document.getElementById('print-total-cartao').textContent = formatarMoeda(dados.totalCartao);
    document.getElementById('print-total-pix').textContent = formatarMoeda(dados.totalPixTransferencia);
    document.getElementById('print-saidas-manha-total').textContent = formatarMoeda(dados.saidasManha);
    document.getElementById('print-saidas-tarde').textContent = formatarMoeda(dados.saidasTarde);
    document.getElementById('print-total-final').textContent = formatarMoeda(dados.total);
    document.getElementById('print-saidas').textContent = formatarMoeda(dados.saidas);
    document.getElementById('print-diferenca').textContent = formatarMoeda(dados.diferenca);
    const lista = document.getElementById('print-saidas-manha-list');
    lista.innerHTML = '';
    if (!dados.detalhesSaidasManha.length) {
        const vazio = document.createElement('li');
        vazio.textContent = 'Sem lançamentos';
        lista.appendChild(vazio);
        return;
    }
    dados.detalhesSaidasManha.forEach(function (item) {
        const li = document.createElement('li');
        li.textContent = `${item.descricao}: ${formatarMoeda(item.valor)}`;
        lista.appendChild(li);
    });

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
    const parcialSalvo = JSON.parse(localStorage.getItem(CHAVE_PARCIAL) || '{}');
    const debito = paraNumero(document.getElementById('cartao-debito').value);
    const credito = paraNumero(document.getElementById('cartao-credito').value);
    const alimentacao = paraNumero(document.getElementById('cartao-alimentacao').value);
    const pix = paraNumero(document.getElementById('pix').value);
    const transferencia = paraNumero(document.getElementById('transferencia').value);
    const sistema = paraNumero(document.getElementById('sistema').value);
    const dinheiroAgenda = paraNumero(document.getElementById('dinheiro-agenda').value);
    const saidasManha = paraNumero(document.getElementById('saidas-manha').value);
    const saidasTarde = paraNumero(document.getElementById('saidas-tarde').value);
    const totalCartao = debito + credito + alimentacao;
    const totalPixTransferencia = pix + transferencia;
    const total = totalCartao + totalPixTransferencia + sistema + dinheiroAgenda;
    const saidas = saidasManha + saidasTarde;
    const diferenca = total - saidas;
    return {
        parcialDataHora: parcialSalvo.datahora || document.getElementById('parcial-datahora').value,
        parcialOperador: parcialSalvo.operador || document.getElementById('parcial-operador').value || '-',
        parcialValor: paraNumero(parcialSalvo.valor),
        finalOperador: document.getElementById('operador').value || parcialSalvo.operador || '-',
        debito,
        credito,
        alimentacao,
        pix,
        transferencia,
        sistema,
        dinheiroAgenda,
        totalCartao,
        totalPixTransferencia,
        saidasManha,
        detalhesSaidasManha: obterDetalhesSaidas('manha'),
        saidasTarde,
        detalhesSaidasTarde: obterDetalhesSaidas('tarde'),
        total,
        saidas,
        diferenca
    };
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
    const dados = montarDadosCupom();
    document.getElementById('final-total').textContent = formatarMoeda(dados.total);
    document.getElementById('final-diferenca').textContent = formatarMoeda(dados.diferenca);
    preencherCupom(dados);
    return dados;
}

async function imprimirFechamentoFinal() {
    const dados = calcularFinal();
    localStorage.setItem(CHAVE_ULTIMO_CUPOM, JSON.stringify(dados));
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

document.addEventListener('DOMContentLoaded', function () {
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
    carregarParcialNoFinal();
    const defaultButton = document.querySelector('.tab-button[data-tab="parcial"]');
    openTab('parcial', defaultButton);
});