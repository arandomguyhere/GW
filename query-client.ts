import { fetch } from "expo/fetch";
import { Platform } from "react-native";
import { QueryClient, QueryFunction } from "@tanstack/react-query";

/**
 * Gets the base URL for the Express API server.
 * 
 * Priority order:
 * 1. EXPO_PUBLIC_DOMAIN env var (set via GitHub Actions secret at build time)
 * 2. Current page origin on web (useful for local dev with a proxy)
 * 3. Localhost fallback for native dev
 */
export function getApiUrl(): string {
  const domain = process.env.EXPO_PUBLIC_DOMAIN;

  if (domain) {
    // Strip any protocol the caller may have included, then add https://
    const clean = domain.replace(/^https?:\/\//, "").replace(/\/$/, "");
    return `https://${clean}/`;
  }

  // On web, if no domain is set, use the current page origin so the static
  // site can talk to a backend deployed on the same domain (or via a proxy).
  if (Platform.OS === "web" && typeof window !== "undefined") {
    return `${window.location.origin}/`;
  }

  // Native dev fallback
  return "http://localhost:5000/";
}

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  route: string,
  data?: unknown,
  headers?: Record<string, string>,
): Promise<Response> {
  const baseUrl = getApiUrl();
  // Ensure route doesn't double-up the leading slash
  const path = route.startsWith("/") ? route.slice(1) : route;
  const url = new URL(path, baseUrl);

  const res = await fetch(url.toString(), {
    method,
    headers: {
      ...(data ? { "Content-Type": "application/json" } : {}),
      ...headers,
    },
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";

export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const baseUrl = getApiUrl();

    // Only use the first element of the query key as the path.
    // Additional elements (filter objects, etc.) should be handled in
    // per-query queryFn overrides — joining them produces invalid URLs.
    const path = (queryKey[0] as string).replace(/^\//, "");
    const url = new URL(path, baseUrl);

    const res = await fetch(url.toString(), {
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
