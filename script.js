const CHAVE_PARCIAL = 'fechamento_parcial_v1';
const CHAVE_ULTIMO_CUPOM = 'ultimo_cupom_v1';

function formatarMoeda(valor) {
    return `R$ ${Number(valor || 0).toFixed(2).replace('.', ',')}`;
}

function paraNumero(valor) {
    return parseFloat(valor) || 0;
}

function formatarDataHora(valor) {
    if (!valor) {
        return '-';
    }

    const data = new Date(valor);
    if (Number.isNaN(data.getTime())) {
        return valor;
    }

    return data.toLocaleString('pt-BR');
}

function openTab(tabName, clickedButton) {
    const tabs = document.querySelectorAll('.tab-content');
    tabs.forEach(tab => tab.style.display = 'none');

    const buttons = document.querySelectorAll('.tab-button');
    buttons.forEach(button => button.classList.remove('active'));

    document.getElementById(tabName).style.display = 'block';

    if (clickedButton) {
        clickedButton.classList.add('active');
    }

    if (tabName === 'final') {
        carregarParcialNoFinal();
    }
}

function salvarParcial() {
    const operador = document.getElementById('parcial-operador').value.trim();
    const datahora = document.getElementById('parcial-datahora').value;
    const valor = paraNumero(document.getElementById('parcial-valor').value);

    if (!operador || !datahora) {
        document.getElementById('parcial-status').textContent = 'Preencha nome do caixa e data/hora.';
        return;
    }

    const parcial = { operador, datahora, valor };
    localStorage.setItem(CHAVE_PARCIAL, JSON.stringify(parcial));

    document.getElementById('parcial-total').textContent = formatarMoeda(valor);
    document.getElementById('parcial-status').textContent = 'Fechamento parcial salvo com sucesso.';

    carregarParcialNoFinal();
}

function salvarParcialEImprimir() {
    salvarParcial();

    const bruto = localStorage.getItem(CHAVE_PARCIAL);
    if (!bruto) {
        return;
    }

    const parcial = JSON.parse(bruto);
    const dados = {
        parcialDataHora: parcial.datahora || '-',
        parcialOperador: parcial.operador || '-',
        parcialValor: paraNumero(parcial.valor),
        finalOperador: parcial.operador || '-',
        debito: 0,
        credito: 0,
        alimentacao: 0,
        pix: 0,
        transferencia: 0,
        dinheiroAgenda: 0,
        totalCartao: 0,
        totalPixTransferencia: 0,
        saidasManha: 0,
        detalhesSaidasManha: [],
        saidasTarde: 0,
        total: 0,
        saidas: 0,
        diferenca: 0
    };

    preencherCupom(dados);
    localStorage.setItem(CHAVE_ULTIMO_CUPOM, JSON.stringify(dados));
    window.print();
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
    document.getElementById('final-parcial-datahora').textContent = parcial.datahora || '-';
}

function adicionarSaidaManha(descricao = '', valor = '') {
    const lista = document.getElementById('saidas-manha-list');
    const item = document.createElement('div');
    item.className = 'subfield-item';

    const descricaoInput = document.createElement('input');
    descricaoInput.type = 'text';
    descricaoInput.className = 'saida-manha-descricao';
    descricaoInput.placeholder = 'Descrição (ex.: gasolina)';
    descricaoInput.value = descricao;

    const valorInput = document.createElement('input');
    valorInput.type = 'number';
    valorInput.className = 'saida-manha-valor';
    valorInput.placeholder = 'Valor';
    valorInput.step = '0.01';
    valorInput.value = valor;

    const removerBotao = document.createElement('button');
    removerBotao.type = 'button';
    removerBotao.className = 'remove-item-button';
    removerBotao.setAttribute('aria-label', 'Remover saída');
    removerBotao.textContent = 'Remover';

    valorInput.addEventListener('input', atualizarTotalSaidasManha);
    removerBotao.addEventListener('click', function () {
        item.remove();
        atualizarTotalSaidasManha();
    });

    item.appendChild(descricaoInput);
    item.appendChild(valorInput);
    item.appendChild(removerBotao);

    lista.appendChild(item);
    atualizarTotalSaidasManha();
}

function obterDetalhesSaidasManha() {
    const itens = Array.from(document.querySelectorAll('.subfield-item'));
    return itens
        .map(function (item) {
            const descricao = item.querySelector('.saida-manha-descricao').value.trim();
            const valor = paraNumero(item.querySelector('.saida-manha-valor').value);
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
}

function montarDadosCupom() {
    const parcialSalvo = JSON.parse(localStorage.getItem(CHAVE_PARCIAL) || '{}');

    const debito = paraNumero(document.getElementById('cartao-debito').value);
    const credito = paraNumero(document.getElementById('cartao-credito').value);
    const alimentacao = paraNumero(document.getElementById('cartao-alimentacao').value);
    const pix = paraNumero(document.getElementById('pix').value);
    const transferencia = paraNumero(document.getElementById('transferencia').value);
    const dinheiroAgenda = paraNumero(document.getElementById('dinheiro-agenda').value);
    const saidasManha = paraNumero(document.getElementById('saidas-manha').value);
    const saidasTarde = paraNumero(document.getElementById('saidas-tarde').value);

    const totalCartao = debito + credito + alimentacao;
    const totalPixTransferencia = pix + transferencia;
    const total = totalCartao + totalPixTransferencia + dinheiroAgenda;
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
        dinheiroAgenda,
        totalCartao,
        totalPixTransferencia,
        saidasManha,
        detalhesSaidasManha: obterDetalhesSaidasManha(),
        saidasTarde,
        total,
        saidas,
        diferenca
    };
}

function atualizarTotalSaidasManha() {
    const valores = document.querySelectorAll('.saida-manha-valor');
    let soma = 0;

    valores.forEach(function (input) {
        soma += paraNumero(input.value);
    });

    document.getElementById('saidas-manha').value = soma.toFixed(2);
}

function calcularFinal() {
    const dados = montarDadosCupom();

    document.getElementById('final-total').textContent = formatarMoeda(dados.total);
    document.getElementById('final-diferenca').textContent = formatarMoeda(dados.diferenca);

    preencherCupom(dados);
    return dados;
}

function imprimirFechamentoFinal() {
    const dados = calcularFinal();
    localStorage.setItem(CHAVE_ULTIMO_CUPOM, JSON.stringify(dados));
    window.print();
}

function reimprimirUltimoCupom() {
    const bruto = localStorage.getItem(CHAVE_ULTIMO_CUPOM);
    if (!bruto) {
        alert('Nenhum cupom anterior encontrado para reimpressão.');
        return;
    }

    const dados = JSON.parse(bruto);
    preencherCupom(dados);
    window.print();
}

document.addEventListener('DOMContentLoaded', function () {
    const campoDataHora = document.getElementById('parcial-datahora');
    if (campoDataHora && !campoDataHora.value) {
        const agora = new Date();
        const localISO = new Date(agora.getTime() - (agora.getTimezoneOffset() * 60000)).toISOString().slice(0, 16);
        campoDataHora.value = localISO;
    }

    adicionarSaidaManha('Gasolina', '0');
    atualizarTotalSaidasManha();

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