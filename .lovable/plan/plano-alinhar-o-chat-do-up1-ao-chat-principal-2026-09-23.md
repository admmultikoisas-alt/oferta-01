# Plano: alinhar o chat do `/up1` ao chat principal

## Mudanças
- Reutilizar no `/up1` a mesma estrutura visual das mensagens do chat principal: avatar por mensagem, balões, espaçamento, sombras, animação de entrada e indicador de digitação.
- Manter o cabeçalho da Kaytlynn e ajustar proporções para celular e desktop sem alterar a identidade da oferta.
- Unificar mensagens sequenciais de processamento no mesmo balão quando fizer sentido, evitando mensagens duplicadas ou saltos visuais.
- Preservar integralmente a verificação de e-mail, cobrança do upsell, Trackly, parâmetros da URL e redirecionamento atual.

## Verificação
- Testar a sequência completa até o formulário.
- Conferir aparência em celular e desktop.
- Confirmar que validação, carregamento, erro e redirecionamento continuam funcionando.

## Detalhes técnicos
- Arquivo principal: `public/sp/up1/index.html`.
- Nenhuma alteração nos valores, Worker, regras do gate ou destino do upsell.
