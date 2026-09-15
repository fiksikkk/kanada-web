import { useEffect, useState } from "react";
import {
  createAdminUser,
  deleteAdminUser,
  getAdminUsers,
  resetUserTotp,
  setAdminUserScopes,
  updateAdminUser,
  type AdminUser,
} from "../api/client.ts";
import { describeAuthError } from "../api/errors.ts";

export function useAdminUsers() {
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [resettingId, setResettingId] = useState<number | null>(null);
  const [resetError, setResetError] = useState<string | null>(null);
  const [mutatingId, setMutatingId] = useState<number | null>(null);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const reload = () => {
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
  };

  useEffect(reload, []);

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

  const create = async (input: {
    username: string;
    password: string;
    role: AdminUser["role"];
  }) => {
    setCreateError(null);
    setCreating(true);
    try {
      const { user } = await createAdminUser(input);
      setUsers((prev) => (prev ? [...prev, user] : [user]));
      return true;
    } catch (err) {
      setCreateError(describeAuthError(err));
      return false;
    } finally {
      setCreating(false);
    }
  };

  const updateRole = async (
    userId: number,
    role: AdminUser["role"],
    isActive: boolean,
    scopeRestricted: boolean,
  ) => {
    setMutationError(null);
    setMutatingId(userId);
    try {
      await updateAdminUser(userId, { role, isActive, scopeRestricted });
      setUsers(
        (prev) =>
          prev?.map((user) =>
            user.id === userId ? { ...user, role, isActive, scopeRestricted } : user,
          ) ?? prev,
      );
      return true;
    } catch (err) {
      setMutationError(describeAuthError(err));
      return false;
    } finally {
      setMutatingId(null);
    }
  };

  const remove = async (userId: number) => {
    setMutationError(null);
    setMutatingId(userId);
    try {
      await deleteAdminUser(userId);
      setUsers((prev) => prev?.filter((user) => user.id !== userId) ?? prev);
      return true;
    } catch (err) {
      setMutationError(describeAuthError(err));
      return false;
    } finally {
      setMutatingId(null);
    }
  };

  const setScopes = async (userId: number, scopeIds: string[]) => {
    setMutationError(null);
    setMutatingId(userId);
    try {
      await setAdminUserScopes(userId, scopeIds);
      setUsers(
        (prev) =>
          prev?.map((user) =>
            user.id === userId ? { ...user, scopeAccess: scopeIds } : user,
          ) ?? prev,
      );
      return true;
    } catch (err) {
      setMutationError(describeAuthError(err));
      return false;
    } finally {
      setMutatingId(null);
    }
  };

  return {
    users,
    error,
    resettingId,
    resetError,
    reset,
    creating,
    createError,
    create,
    mutatingId,
    mutationError,
    updateRole,
    remove,
    setScopes,
  };
}
