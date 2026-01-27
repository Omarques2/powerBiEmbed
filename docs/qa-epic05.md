# EPIC-05 — QA Final (Web)

Este guia serve como checklist de QA para validar a migracao do front-end para Shadcn (Milestones 1–8).

## Pre-requisitos
- Node >= 20
- `apps/web` com dependencias instaladas

## Testes automatizados (terminal)
Execute em `apps/web`:

1) Lint  
`npm run lint`

2) Testes  
`npm run test`

3) Build  
`npm run build`

## Checklist visual (manual)
Valide em tres tamanhos: **390px**, **768px**, **1280px**.

### Auth & Global
- [ ] Login: layout, CTA, estados de erro.
- [ ] Pending: layout, botao “Verificar agora”.
- [ ] Callback: loading simples, sem flicker.
- [ ] Toast: aparece no canto inferior direito.
- [ ] Confirm modal: cancel/confirm funcionam.
- [ ] Overlay de loading global em trocas de rota.

### Shell / Home
- [ ] Sidebar desktop colapsa/expande sem quebrar layout.
- [ ] Drawer mobile abre/fecha e nao trava scroll.
- [ ] Embed Power BI centralizado e sem bordas brancas extras.
- [ ] Erro de embed aparece com estilo consistente.

### Admin — Customers
- [ ] Lista + busca ok.
- [ ] Modal do customer: Resumo / Relatorios / Paginas / Preview.
- [ ] Relatorios: toggles funcionam; sync nao reativa itens indevidos.
- [ ] Paginas: grupos + paginas individuais; preview abre.
- [ ] Preview (aba): menu de paginas aparece e navega.

### Admin — Users
- [ ] Pendentes: selecionar usuario e ativar/recusar.
- [ ] Usuarios: tabela carrega, toggle status (nao para platform admin).
- [ ] Modal de usuario: workspaces/reports/paginas apenas herdados do customer.
- [ ] Preview do usuario: menu de paginas e estados vazios corretos.

### Admin — RLS
- [ ] Targets e regras por dataset funcionam.
- [ ] Sec_<target_key> criada automaticamente.
- [ ] Guias/helps continuam acessiveis.

### Admin — Overview/Security
- [ ] Overview carrega sem saltos.
- [ ] Admins: aviso curto, sem campos redundantes.

## Observacoes
- Se algum item falhar, registrar com print e rota exata.
- Repetir o checklist apos qualquer ajuste grande de UI.
