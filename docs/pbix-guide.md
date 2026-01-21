# Guia PBIX (RLS)

## Objetivo
Padronizar a criacao das tabelas Sec_/Dim_ e da role CustomerRLS, garantindo RLS por customer e override por usuario.

## Pre-requisitos
- Dataset com fonte(s) em Import.
- Sec_rls_base disponivel no banco (view criada automaticamente pela API com base nas regras).
- DAX conforme o contrato em `RLS_CONTRACT.md`.

## Fluxo padrao (com sec_rls_base)
1) Importar sec_rls_base
   - Power BI Desktop -> Home -> Get Data -> PostgreSQL.
   - Conecte no servidor e selecione sec_rls_base no Navigator.
2) Ajustar tipos no Power Query
   - customer_id e user_id como Text.
   - target_key e op como Text.
   - value_* conforme value_type do target (text/int/uuid).
3) Criar Sec_<TargetKey>
   - Reference em sec_rls_base.
   - Filtrar target_key = "<TargetKey>".
   - Manter somente customer_id, user_id, op e value_*.
4) Criar Dim_<TargetKey>
   - Reference na tabela fato.
   - Manter apenas a coluna de fato e renomear para Value.
   - Remove duplicates e blanks.
5) Relacionamento
   - Dim_<TargetKey>[Value] (1) -> Fact[<fact_column>] (*).
   - Cross filter direction: Single.
6) Role
   - Modeling -> Manage roles -> New -> CustomerRLS.
   - Aplicar o DAX do contrato em Dim_<TargetKey>.

## Atalho (tabelas prontas)
Se o banco ja entrega as tabelas Sec_<TargetKey> e Dim_<TargetKey>:
- Pular as etapas 1-3.
- Carregar Sec_<TargetKey> e Dim_<TargetKey> direto no Navigator.
- Validar tipos das colunas (customer_id/user_id Text).
Nota:
- A API cria automaticamente a view Sec_<TargetKey> ao salvar um target.

## Validacao rapida
1) View -> View as -> CustomerRLS.
2) Adicione slicer com Dim_<TargetKey>[Value].
3) Verifique se os dados filtram conforme as regras.

## Referencias
- Contrato de RLS: `RLS_CONTRACT.md`
- Nota operacional: effective identity exige fontes em Import.
