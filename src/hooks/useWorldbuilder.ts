import { useState, useEffect, useCallback, useRef } from "react";
import { callTool } from "../api/worldbuilder";

/**
 * Generic hook for calling an MCP tool and caching the result.
 * Re-fetches whenever `deps` change.
 */
export function useToolQuery<T = unknown>(
  toolName: string,
  args: Record<string, unknown>,
  deps: unknown[] = []
) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState<number | undefined>();
  const [nextPageToken, setNextPageToken] = useState<string | undefined>();

  // Avoid re-creating the callback when args object ref changes
  const argsRef = useRef(args);
  argsRef.current = args;

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await callTool<T>(toolName, argsRef.current);
      if (result.success) {
        setData(result.data ?? null);
        setTotalCount(result.totalCount);
        setNextPageToken(result.nextPageToken);
      } else {
        setError(result.error ?? "Unknown error");
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toolName, ...deps]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { data, loading, error, refetch, totalCount, nextPageToken };
}

/**
 * Manual trigger version — doesn't auto-fetch on mount.
 */
export function useToolMutation<T = unknown>() {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const execute = useCallback(
    async (toolName: string, args: Record<string, unknown>) => {
      setLoading(true);
      setError(null);
      try {
        const result = await callTool<T>(toolName, args);
        if (result.success) {
          setData(result.data ?? null);
          return result;
        } else {
          setError(result.error ?? "Unknown error");
          return result;
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        setError(msg);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return { data, loading, error, execute };
}
