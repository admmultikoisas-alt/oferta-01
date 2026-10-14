import { createIsomorphicFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";

export type RequestInfo = { userAgent: string; search: string; host: string };

export const getRequestInfo = createIsomorphicFn()
  .client((): RequestInfo => ({
    userAgent: navigator.userAgent,
    search: window.location.search,
    host: window.location.host,
  }))
  .server((): RequestInfo => {
    const req = getRequest();
    if (!req) return { userAgent: "", search: "", host: "" };
    const url = new URL(req.url);
    return {
      userAgent: req.headers.get("user-agent") ?? "",
      search: url.search,
      host: url.host,
    };
  });
