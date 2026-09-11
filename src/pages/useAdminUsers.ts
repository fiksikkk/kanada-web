import { useEffect, useState } from "react";
import {
  getAdminUsers,
  resetUserTotp,
  type AdminUser,
} from "../api/client.ts";
import { describeAuthError } from "../api/errors.ts";

export function useAdminUsers() {
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [resettingId, setResettingId] = useState<number | null>(null);
  const [resetError, setResetError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getAdminUsers()
      .then((result) => {
        if (!cancelled) setUsers(result.users);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(describeAuthError(err));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const reset = async (userId: number) => {
    setResetError(null);
    setResettingId(userId);
    try {
      await resetUserTotp(userId);
      setUsers(
        (prev) =>
          prev?.map((user) =>
            user.id === userId ? { ...user, totpEnabled: false } : user,
          ) ?? prev,
      );
    } catch (err) {
      setResetError(describeAuthError(err));
    } finally {
      setResettingId(null);
    }
  };

  return { users, error, resettingId, resetError, reset };
}
