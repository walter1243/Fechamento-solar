# Aplicativo Web para Fechamento de Caixa

Este é um aplicativo web simples para realizar o fechamento de caixa, com duas abas principais:

1. **Fechamento Parcial**: Permite inserir um valor simples e calcular o total.
2. **Fechamento Final**: Permite inserir dados detalhados, calcular o total e a diferença entre entradas e saídas.

## Estrutura do Projeto
- `index.html`: Estrutura principal do aplicativo.
- `styles.css`: Estilização do aplicativo.
- `script.js`: Lógica de cálculo e manipulação das abas.

## Como usar
1. Abra o arquivo `index.html` em um navegador.
2. Use as abas para alternar entre o fechamento parcial e o fechamento final.
3. Insira os dados nos campos e clique no botão de calcular para obter os resultados.

## Funcionalidades
- Cálculo automático de totais e diferenças.
- Interface simples e intuitiva.

## Melhorias Futuras
- Adicionar persistência de dados.
- Implementar autenticação para operadores de caixa.
- Melhorar o design da interface.

## Banco de Dados (PostgreSQL)

Este projeto possui um schema SQL para criar as tabelas principais do fechamento:

- `operadores`
- `fechamentos_parciais`
- `fechamentos_finais`
- `saidas_detalhes`

Arquivos:

- `scripts/schema.sql`
- `scripts/init_db.py`

### Como criar as tabelas

1. Configure o `DATABASE_URL` no `.env`.
2. Instale dependencias:

```bash
pip install -r requirements.txt
```

3. Rode o inicializador:

```bash
python scripts/init_db.py
```

Se o `.env` estiver no formato antigo com a URL dentro de `DB_PASSWORD`,
o script tambem reconhece automaticamente.