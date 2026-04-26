// Persists the currently-selected user identity in localStorage so refresh keeps you signed in.
// Identity is either a real staff member (role=staff with a staff_id) or a read-only
// auditor identity (role=viewer, used for PwC NL/AL).
import { useEffect, useState } from "react";

const KEY = "tt.selectedStaffId";
const ROLE_KEY = "tt.userRole";

export type UserRole = "staff" | "viewer";

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

export function useUserRole() {
  const [role, setRole] = useState<UserRole>("staff");

  useEffect(() => {
    try {
      const raw = localStorage.getItem(ROLE_KEY);
      if (raw === "viewer" || raw === "staff") setRole(raw);
    } catch {
      // ignore
    }
  }, []);

  const update = (next: UserRole) => {
    setRole(next);
    try {
      localStorage.setItem(ROLE_KEY, next);
    } catch {
      // ignore
    }
  };

  return [role, update] as const;
}

// Convenience: read role synchronously where a hook isn't usable.
export function readUserRole(): UserRole {
  try {
    const raw = localStorage.getItem(ROLE_KEY);
    if (raw === "viewer") return "viewer";
  } catch {
    // ignore
  }
  return "staff";
}
