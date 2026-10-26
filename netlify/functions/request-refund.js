// Netlify Serverless Function: Process Refund Request & Dispatch Confirmation Email
export default async (req, context) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }

  try {
    const body = await req.json();
    const email = (body.email || '').trim().toLowerCase();
    const name = (body.name || '').trim() || 'Cliente';
    const protocol = (body.protocol || ('REF-' + Math.floor(100000 + Math.random() * 900000))).toUpperCase();
    const requestDate = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });

    if (!email || !email.includes('@')) {
      return new Response(JSON.stringify({ ok: false, error: 'E-mail inválido ou não fornecido' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    console.log('[NETLIFY REFUND REQUEST]', { protocol, name, email, date: requestDate });

    let emailDispatched = false;
    let emailError = null;

    const resendApiKey = process.env.RESEND_API_KEY || '';
    if (resendApiKey && resendApiKey.startsWith('re_') && resendApiKey !== 're_SUA_CHAVE_API_RESEND_AQUI') {
      try {
        const senderFrom = process.env.RESEND_FROM_REFUND || process.env.RESEND_FROM || 'Spotify Rewards <suporte@spotmove.shop>';
        const emailRes = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${resendApiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            from: senderFrom,
            to: [email],
            subject: `[Protocolo #${protocol}] Confirmação de Solicitação de Reembolso em Análise`,
            html: getRefundAnalysisEmailHtml(name, email, protocol, requestDate)
          })
        });

        const resData = await emailRes.json();
        if (emailRes.ok) {
          emailDispatched = true;
          console.log('[Netlify Resend Success]', resData);
        } else {
          emailError = resData && (resData.message || JSON.stringify(resData));
          console.error('[Netlify Resend Error]', resData);
        }
      } catch (err) {
        emailError = err.message;
        console.error('[Netlify Resend Exception]', err);
      }
    } else {
      emailError = 'RESEND_API_KEY não configurada no Netlify / Worker';
    }

    return new Response(JSON.stringify({
      ok: true,
      protocol: protocol,
      name: name,
      email: email,
      emailDispatched: emailDispatched,
      emailError: emailError,
      date: requestDate,
      message: emailDispatched
        ? 'Solicitação registrada com sucesso e e-mail de confirmação enviado.'
        : 'Solicitação registrada com sucesso sob o protocolo ' + protocol + '.'
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
};

function getRefundAnalysisEmailHtml(name, email, protocol, date) {
  const cleanName = (name && name.trim().toLowerCase() !== 'customer') ? name.trim() : 'Cliente';
  const cleanEmail = email || '';
  const cleanDate = date || new Date().toLocaleString('pt-BR');

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Confirmação de Solicitação de Reembolso em Análise</title>
</head>
<body style="margin:0;padding:0;background-color:#0d1117;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#e6edf3;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#0b0e14;padding:40px 15px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:540px;background-color:#161b22;border:1px solid #30363d;border-radius:12px;overflow:hidden;box-shadow:0 8px 24px rgba(0,0,0,0.5);">
          <tr>
            <td style="background-color:#101923;padding:24px 32px;border-bottom:1px solid #21262d;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="left">
                    <span style="display:inline-block;background-color:rgba(210,153,34,0.15);color:#e3b341;border:1px solid rgba(210,153,34,0.4);font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;padding:5px 12px;border-radius:20px;">
                      ⏳ SOLICITAÇÃO EM ANÁLISE / UNDER REVIEW
                    </span>
                  </td>
                  <td align="right" style="color:#8b949e;font-size:12px;">
                    Spotify Rewards
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:32px 32px 24px 32px;">
              <h1 style="margin:0 0 16px 0;font-size:22px;font-weight:700;color:#ffffff;line-height:1.3;">
                Sua solicitação de reembolso foi recebida
              </h1>
              <p style="margin:0 0 16px 0;font-size:15px;color:#c9d1d9;line-height:1.6;">
                Olá, <strong>${cleanName}</strong>,
              </p>
              <p style="margin:0 0 24px 0;font-size:14px;color:#8b949e;line-height:1.6;">
                Confirmamos o recebimento da sua solicitação de reembolso referente ao Spotify Rewards. O seu pedido foi registrado com sucesso em nosso sistema de suporte e já foi encaminhado para análise da equipe financeira.
              </p>
              
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#0d1117;border:1px solid #30363d;border-radius:8px;margin-bottom:24px;">
                <tr>
                  <td style="padding:16px 20px;border-bottom:1px solid #21262d;color:#8b949e;font-size:13px;">Número do Protocolo:</td>
                  <td style="padding:16px 20px;border-bottom:1px solid #21262d;color:#1ed760;font-family:monospace;font-size:16px;font-weight:800;text-align:right;">${protocol}</td>
                </tr>
                <tr>
                  <td style="padding:14px 20px;border-bottom:1px solid #21262d;color:#8b949e;font-size:13px;">E-mail da Compra:</td>
                  <td style="padding:14px 20px;border-bottom:1px solid #21262d;color:#e6edf3;font-size:13px;text-align:right;">${cleanEmail}</td>
                </tr>
                <tr>
                  <td style="padding:14px 20px;border-bottom:1px solid #21262d;color:#8b949e;font-size:13px;">Data da Solicitação:</td>
                  <td style="padding:14px 20px;border-bottom:1px solid #21262d;color:#e6edf3;font-size:13px;text-align:right;">${cleanDate}</td>
                </tr>
                <tr>
                  <td style="padding:14px 20px;border-bottom:1px solid #21262d;color:#8b949e;font-size:13px;">Status Atual:</td>
                  <td style="padding:14px 20px;border-bottom:1px solid #21262d;color:#e3b341;font-size:13px;font-weight:700;text-align:right;">Em Análise Financeira</td>
                </tr>
                <tr>
                  <td style="padding:14px 20px;color:#8b949e;font-size:13px;">Destino do Estorno:</td>
                  <td style="padding:14px 20px;color:#e6edf3;font-size:13px;text-align:right;">Mesmo cartão / método original</td>
                </tr>
              </table>

              <div style="background-color:rgba(30,215,96,0.08);border-left:3px solid #1ed760;padding:14px 16px;border-radius:4px;margin-bottom:24px;">
                <p style="margin:0 0 6px 0;font-size:13px;font-weight:600;color:#1ed760;">Quais são os próximos passos?</p>
                <p style="margin:0;font-size:13px;color:#c9d1d9;line-height:1.5;">
                  <strong>1. Análise Interna:</strong> Nossa equipe localiza a transação e valida os dados em até <strong>24 a 48 horas úteis</strong>.<br>
                  <strong>2. Emissão do Estorno:</strong> Assim que aprovado, o estorno é emitido automaticamente e você receberá uma confirmação com o comprovante e código de referência (ARN).<br>
                  <strong>3. Crédito em Fatura:</strong> O valor é creditado na fatura do seu cartão em 5 a 10 dias úteis de acordo com os prazos da sua operadora bancária.
                </p>
              </div>

              <p style="margin:0;font-size:13px;color:#8b949e;line-height:1.5;">
                Guarde este e-mail e o número do seu protocolo (<strong>${protocol}</strong>). Caso tenha qualquer dúvida, responda diretamente a este e-mail informando o número do protocolo.
              </p>
            </td>
          </tr>
          <tr>
            <td style="background-color:#101923;padding:20px 32px;border-top:1px solid #21262d;text-align:center;">
              <p style="margin:0;font-size:12px;color:#6e7681;">
                Spotify Rewards Support &bull; Central de Atendimento ao Cliente
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
