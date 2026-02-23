import type { ToolResponse } from "../types";

// ─── Config (set via env vars at build time) ────────────────────
const API_URL = import.meta.env.VITE_WORLDBUILDER_API_URL ?? "";
const API_KEY = import.meta.env.VITE_WORLDBUILDER_API_KEY ?? "";

// ─── Core RPC caller ────────────────────────────────────────────
let requestId = 0;

export async function callTool<T = unknown>(
  toolName: string,
  args: Record<string, unknown> = {}
): Promise<ToolResponse<T>> {
  const id = ++requestId;

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
