import { useEffect, useState } from "react";
import {
  createBackup,
  listBackups,
  restoreBackup,
  type BackupEntry,
} from "../api/client.ts";
import { describeAuthError } from "../api/errors.ts";

export function useAdminBackups() {
  const [backups, setBackups] = useState<BackupEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [restoringFile, setRestoringFile] = useState<string | null>(null);
  const [restoreError, setRestoreError] = useState<string | null>(null);

  const reload = () => {
    let cancelled = false;
    listBackups()
      .then((result) => {
        if (!cancelled) setBackups(result.backups);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(describeAuthError(err));
      });
    return () => {
      cancelled = true;
    };
  };

  useEffect(reload, []);

  const create = async () => {
    setCreateError(null);
    setCreating(true);
    try {
      await createBackup();
      reload();
      return true;
    } catch (err) {
      setCreateError(describeAuthError(err));
      return false;
    } finally {
      setCreating(false);
    }
  };

  const restore = async (file: string) => {
    setRestoreError(null);
    setRestoringFile(file);
    try {
      await restoreBackup(file);
      return true;
    } catch (err) {
      setRestoreError(describeAuthError(err));
      return false;
    } finally {
      setRestoringFile(null);
    }
  };

  return {
    backups,
    error,
    reload,
    creating,
    createError,
    create,
    restoringFile,
    restoreError,
    restore,
  };
}
