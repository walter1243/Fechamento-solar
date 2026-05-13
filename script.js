function openTab(tabName) {
    const tabs = document.querySelectorAll('.tab-content');
    tabs.forEach(tab => tab.style.display = 'none');

    document.getElementById(tabName).style.display = 'block';
}

function calcularParcial() {
    const valor = parseFloat(document.getElementById('parcial-valor').value) || 0;
    document.getElementById('parcial-total').textContent = valor.toFixed(2);
}

function calcularFinal() {
    const debito = parseFloat(document.getElementById('cartao-debito').value) || 0;
    const credito = parseFloat(document.getElementById('cartao-credito').value) || 0;
    const alimentacao = parseFloat(document.getElementById('cartao-alimentacao').value) || 0;
    const pix = parseFloat(document.getElementById('pix').value) || 0;
    const transferencia = parseFloat(document.getElementById('transferencia').value) || 0;
    const dinheiroAgenda = parseFloat(document.getElementById('dinheiro-agenda').value) || 0;
    const saidasManha = parseFloat(document.getElementById('saidas-manha').value) || 0;
    const saidasTarde = parseFloat(document.getElementById('saidas-tarde').value) || 0;

    const totalCartao = debito + credito + alimentacao;
    const totalPixTransferencia = pix + transferencia;
    const total = totalCartao + totalPixTransferencia + dinheiroAgenda;
    const saidas = saidasManha + saidasTarde;
    const diferenca = total - saidas;

    document.getElementById('final-total').textContent = total.toFixed(2);
    document.getElementById('final-diferenca').textContent = diferenca.toFixed(2);
}