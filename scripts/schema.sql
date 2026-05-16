-- Core tables for caixa fechamento

CREATE TABLE IF NOT EXISTS operadores (
    id BIGSERIAL PRIMARY KEY,
    nome VARCHAR(120) NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS fechamentos_parciais (
    id BIGSERIAL PRIMARY KEY,
    operador_nome VARCHAR(120) NOT NULL,
    datahora TIMESTAMPTZ NOT NULL,
    valor NUMERIC(12,2) NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS fechamentos_finais (
    id BIGSERIAL PRIMARY KEY,
    parcial_id BIGINT NULL REFERENCES fechamentos_parciais(id) ON DELETE SET NULL,
    operador_inicial_nome VARCHAR(120) NOT NULL,
    operador_final_nome VARCHAR(120) NOT NULL,
    caixa_compartilhado BOOLEAN NOT NULL DEFAULT FALSE,
    debito NUMERIC(12,2) NOT NULL DEFAULT 0,
    credito NUMERIC(12,2) NOT NULL DEFAULT 0,
    alimentacao NUMERIC(12,2) NOT NULL DEFAULT 0,
    pix NUMERIC(12,2) NOT NULL DEFAULT 0,
    transferencia NUMERIC(12,2) NOT NULL DEFAULT 0,
    sistema NUMERIC(12,2) NOT NULL DEFAULT 0,
    dinheiro_agenda NUMERIC(12,2) NOT NULL DEFAULT 0,
    total_dinheiro NUMERIC(12,2) NOT NULL DEFAULT 0,
    total_cartao NUMERIC(12,2) NOT NULL DEFAULT 0,
    total_pix_transferencia NUMERIC(12,2) NOT NULL DEFAULT 0,
    total_final NUMERIC(12,2) NOT NULL DEFAULT 0,
    saidas_manha_total NUMERIC(12,2) NOT NULL DEFAULT 0,
    saidas_tarde_total NUMERIC(12,2) NOT NULL DEFAULT 0,
    saidas_total NUMERIC(12,2) NOT NULL DEFAULT 0,
    envelope_noite NUMERIC(12,2) NOT NULL DEFAULT 0,
    parcial_valor NUMERIC(12,2) NOT NULL DEFAULT 0,
    diferenca NUMERIC(12,2) NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Migracoes para bancos existentes
ALTER TABLE fechamentos_finais ADD COLUMN IF NOT EXISTS envelope_noite NUMERIC(12,2) NOT NULL DEFAULT 0;
ALTER TABLE fechamentos_finais ADD COLUMN IF NOT EXISTS parcial_valor NUMERIC(12,2) NOT NULL DEFAULT 0;
ALTER TABLE fechamentos_finais ADD COLUMN IF NOT EXISTS diferenca NUMERIC(12,2) NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS saidas_detalhes (
    id BIGSERIAL PRIMARY KEY,
    fechamento_final_id BIGINT NOT NULL REFERENCES fechamentos_finais(id) ON DELETE CASCADE,
    periodo VARCHAR(10) NOT NULL CHECK (periodo IN ('manha', 'tarde')),
    descricao VARCHAR(255) NOT NULL,
    valor NUMERIC(12,2) NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fech_parciais_operador_data ON fechamentos_parciais (operador_nome, datahora DESC);
CREATE INDEX IF NOT EXISTS idx_fech_finais_operadores_data ON fechamentos_finais (operador_inicial_nome, operador_final_nome, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_saidas_fechamento ON saidas_detalhes (fechamento_final_id);
