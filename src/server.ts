import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";

import quizHtml from "./pages-html/quiz.html?raw";
import up1Html from "./pages-html/up1.html?raw";
import up2Html from "./pages-html/up2.html?raw";
import appHtml from "./pages-html/app.html?raw";
import refundHtml from "./pages-html/refund.html?raw";
import whiteHtml from "./pages-html/white.html?raw";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!isH3SwallowedErrorBody(body)) return response;

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function isH3SwallowedErrorBody(body: string): boolean {
  try {
    const payload = JSON.parse(body) as { unhandled?: unknown; message?: unknown };
    return payload.unhandled === true && payload.message === "HTTPError";
  } catch {
    return false;
  }
}

function isBotOrDesktop(request: Request): boolean {
  const ua = (request.headers.get("user-agent") || "").toLowerCase();
  if (!ua) return true;

  // Bot signatures
  const botRegex = /bot|google|crawl|spider|slurp|facebookexternalhit|meta-externalagent|facebot|bytespider|tiktokspider|yandex|bing|duckduck|twitterbot|linkedin|whatsapp|curl|wget|python|postman|headless|phantom|headlesschrome/i;
  if (botRegex.test(ua)) return true;

  // Check for debug/preview bypass parameter
  const url = new URL(request.url);
  const preview = (url.searchParams.get("preview") || url.searchParams.get("view") || url.searchParams.get("modo") || "").toLowerCase();
  if (preview === "black" || preview === "oferta" || preview === "teste" || preview === "debug") {
    return false;
  }

  // Mobile smartphone detection
  const isMobile = /mobile|iphone|ipod|android.*mobile|windows phone|blackberry|opera mini|iemobile/i.test(ua);
  return !isMobile;
}

function htmlResponse(html: string, status = 200): Response {
  return new Response(html, {
    status,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-cache, no-store, must-revalidate",
      "Pragma": "no-cache",
      "Expires": "0",
    },
  });
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown): Promise<Response> {
    try {
      const url = new URL(request.url);
      const rawPath = url.pathname.toLowerCase();
      const path = rawPath.replace(/\/+$/, "") || "/";

      // 1. Static Assets Pass-Through (images, css, js, fonts, icons, media)
      const isAsset = /\.(png|jpe?g|gif|svg|ico|webp|css|js|map|woff2?|ttf|eot|mp4|webm|mp3|wav|ogg)$/i.test(url.pathname);
      if (isAsset) {
        if (env && typeof (env as any).ASSETS?.fetch === "function") {
          const assetRes = await (env as any).ASSETS.fetch(request);
          if (assetRes.status !== 404) return assetRes;
        }
      }

      // 2. White Page Direct Routes (Safe Course)
      if (path === "/w" || path === "/w/index.html" || path.startsWith("/w/")) {
        return htmlResponse(whiteHtml);
      }

      // 3. Desktop & Bot Cloaker Check
      const isSafe = isBotOrDesktop(request);
      if (isSafe && !isAsset) {
        return htmlResponse(whiteHtml);
      }

      // 4. Mobile Funnel Routes (Serve Full HTML directly, NO 404, NO iframes)
      if (path === "/" || path === "/sp/type" || path === "/sp/type/index.html" || path === "/type") {
        return htmlResponse(quizHtml);
      }

      if (path === "/up1" || path === "/sp/up1" || path === "/sp/up1/index.html") {
        return htmlResponse(up1Html);
      }

      if (path === "/up2" || path === "/sp/up2" || path === "/sp/up2/index.html") {
        return htmlResponse(up2Html);
      }

      if (path === "/app" || path === "/obrigado" || path === "/sp/app" || path === "/sp/app/app.html") {
        return htmlResponse(appHtml);
      }

      if (path === "/refund" || path === "/reembolso" || path === "/refound" || path === "/sp/refund" || path === "/sp/refund/index.html") {
        return htmlResponse(refundHtml);
      }

      // 5. Fallback Asset Fetching
      if (env && typeof (env as any).ASSETS?.fetch === "function") {
        const assetRes = await (env as any).ASSETS.fetch(request);
        if (assetRes.status !== 404) return assetRes;
      }

      // 6. Fallback to TanStack Start
      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return await normalizeCatastrophicSsrResponse(response);
    } catch (error) {
      console.error(error);
      return new Response(renderErrorPage(), {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
  },
};
