import { useCallback, useEffect, useState } from "react";
import { useAuthSession } from "../app/providers/authSessionContext";
import { assignmentRpc } from "./assignmentData";
import { assignmentError } from "./assignments";
export function useAssignmentRead<T>(
  name: string,
  args: Record<string, unknown>,
) {
  const { user } = useAuthSession();
  const serialized = JSON.stringify(args), key = user?.id + name + serialized;
  const [record, setRecord] = useState<{ key: string; data: T } | null>(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [version, setVersion] = useState(0);
  const reload = useCallback(() => setVersion((v) => v + 1), []);
  useEffect(() => {
    const c = new AbortController();
    setError("");
    setLoading(true);
    if (!user?.id) {
      setRecord(null);
      setLoading(false);
      return;
    }
    void assignmentRpc<T>(name, JSON.parse(serialized), c.signal).then(
      (data) => {
        if (!c.signal.aborted) setRecord({ key, data });
      },
    ).catch((e) => {
      if (!c.signal.aborted) {
        setError(assignmentError(e));
        setRecord(null);
      }
    }).finally(() => {
      if (!c.signal.aborted) setLoading(false);
    });
    return () => c.abort();
  }, [name, serialized, key, user?.id, version]);
  return {
    data: record?.key === key ? record.data : null,
    error,
    loading,
    reload,
  };
}
