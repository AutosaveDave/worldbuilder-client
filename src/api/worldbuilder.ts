import type { ToolResponse } from "../types";

// ─── Config ─────────────────────────────────────────────────────
const STORAGE_KEY_URL = "wb_api_url";
const STORAGE_KEY_KEY = "wb_api_key";

const DEFAULT_URL =
  import.meta.env.VITE_WORLDBUILDER_API_URL ??
  "https://us-central1-PROJECT_ID.cloudfunctions.net/mcp/mcp";
const DEFAULT_KEY = import.meta.env.VITE_WORLDBUILDER_API_KEY ?? "";

export function getApiUrl(): string {
  return localStorage.getItem(STORAGE_KEY_URL) || DEFAULT_URL;
}

export function getApiKey(): string {
  return localStorage.getItem(STORAGE_KEY_KEY) || DEFAULT_KEY;
}

export function setApiUrl(url: string) {
  localStorage.setItem(STORAGE_KEY_URL, url);
}

export function setApiKey(key: string) {
  localStorage.setItem(STORAGE_KEY_KEY, key);
}

export function isConfigured(): boolean {
  const url = getApiUrl();
  const key = getApiKey();
  return (
    !!url &&
    !url.includes("PROJECT_ID") &&
    !!key
  );
}

// ─── Core RPC caller ────────────────────────────────────────────
let requestId = 0;

export async function callTool<T = unknown>(
  toolName: string,
  args: Record<string, unknown> = {}
): Promise<ToolResponse<T>> {
  const id = ++requestId;
  const API_URL = getApiUrl();
  const API_KEY = getApiKey();

  const response = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      "x-api-key": API_KEY,
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id,
      method: "tools/call",
      params: { name: toolName, arguments: args },
    }),
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  const text = await response.text();

  // Parse SSE: find the "data: " line with content
  const lines = text.split("\n");
  for (const line of lines) {
    if (line.startsWith("data: ")) {
      const envelope = JSON.parse(line.slice(6));

      if (envelope.error) {
        throw new Error(envelope.error.message || "RPC error");
      }

      const innerText = envelope.result.content[0].text;
      return JSON.parse(innerText) as ToolResponse<T>;
    }
  }

  throw new Error("No data line found in SSE response");
}
