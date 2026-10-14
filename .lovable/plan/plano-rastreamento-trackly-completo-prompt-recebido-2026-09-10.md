# Plano: rastreamento Trackly completo (prompt recebido)

## O que já está conforme (sem mudança)
- Chat (`public/sp/type/index.html`): script no `<head>` já com o ID novo (`f=9af23cbc...`).
- Etapas 1–8 já disparam via `trkFunnel.step()`: inicio, avaliacao, start_verification, yes_i_do, coleta_de_nome, elegibilidade, recibo, vsl_checkout. O prompt autoriza chamada JS para etapas em SPA/callbacks — é o caso do chat.

## O que falta fazer

1. **Script do Trackly em todas as páginas do funil**
   - `/up1` (`public/sp/up1/index.html`): trocar o script antigo (`f=234526a0...`) pelo novo (`f=9af23cbc...`).
   - `/up2` (`public/sp/up2/index.html`): adicionar o script novo no `<head>` (hoje não tem).

2. **Etapa 9 — upsell1** (página `/up1`)
   - `data-funnel-view="upsell1"` no card de confirmação de e-mail (aparecer na tela = chegou na etapa).
   - `data-funnel-step="upsell1"` no botão "VERIFY EMAIL" (`#spConfirmBtn`).

3. **Etapa 10 — upsell2** (página `/up2`)
   - `data-funnel-view="upsell2"` no container principal da página de obrigado.
   - `data-funnel-step="upsell2"` no botão "ACCESS NOW" (`#accessBtn`).

4. **Verificação**
   - Conferir que nenhum parâmetro de URL é removido (o script repassa utms/sessionId sozinho).
   - Testar no preview que os steps disparam sem erros no console.

5. **Entrega**
   - Listar em qual elemento ficou cada chave (chat: chamadas JS no `run()`; upsells: atributos nos elementos acima).

## Detalhes técnicos
- Arquivos tocados: `public/sp/up1/index.html`, `public/sp/up2/index.html` (e nenhuma mudança no chat).
- Chaves usadas exatamente como listadas; etapas de pagamento (gateway) não são marcadas no HTML — chegam por webhook.
