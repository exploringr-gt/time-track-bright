// Persists the currently-selected staff in localStorage so refresh keeps you signed in.
import { useEffect, useState } from "react";

const KEY = "tt.selectedStaffId";

export function useSelectedStaff() {
  const [id, setId] = useState<string | null>(null);

  useEffect(() => {
    try {
      setId(localStorage.getItem(KEY));
    } catch {
      // ignore
    }
  }, []);

  const update = (next: string | null) => {
    setId(next);
    try {
      if (next) localStorage.setItem(KEY, next);
      else localStorage.removeItem(KEY);
    } catch {
      // ignore
    }
  };

  return [id, update] as const;
}
