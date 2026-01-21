# Guia PBIX (RLS)

## Objetivo
Padronizar a criacao das tabelas Sec_/Dim_ e da role CustomerRLS, garantindo RLS por customer e override por usuario.

## Pre-requisitos
- Dataset com fonte(s) em Import.
- View Sec_<TargetKey> disponivel no banco (criada automaticamente pela API ao salvar o target).
- DAX conforme o contrato em `RLS_CONTRACT.md`.

## Fluxo padrao (Sec_ pronta)
1) Importar Sec_<TargetKey>
   - Power BI Desktop -> Home -> Get Data -> PostgreSQL.
   - Conecte no servidor e selecione Sec_<TargetKey> no Navigator.
2) Ajustar tipos no Power Query
   - customer_id e user_id como Text.
   - value_* conforme value_type do target (text/int/uuid).
3) Criar Dim_<TargetKey>
   - Reference na tabela fato.
   - Manter apenas a coluna de fato e renomear para Value.
   - Remove duplicates e blanks.
4) Relacionamento
   - Dim_<TargetKey>[Value] (1) -> Fact[<fact_column>] (*).
   - Cross filter direction: Single.
5) Role
   - Modeling -> Manage roles -> New -> CustomerRLS.
   - Aplicar o DAX do contrato em Dim_<TargetKey>.

## Observacoes
- A API cria automaticamente a view Sec_<TargetKey> ao salvar um target.

## Validacao rapida
1) View -> View as -> CustomerRLS.
2) Adicione slicer com Dim_<TargetKey>[Value].
3) Verifique se os dados filtram conforme as regras.

## Referencias
- Contrato de RLS: `RLS_CONTRACT.md`
- Nota operacional: effective identity exige fontes em Import.
