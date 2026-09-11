import { useState } from "react";
import {
  confirmTotp,
  setupTotp,
  type TotpSetupResponse,
} from "../api/client.ts";
import { describeAuthError } from "../api/errors.ts";
import { useAuth } from "../context/useAuth.ts";

type Step = "idle" | "confirm" | "codes";

export function useTotpSetup() {
  const { refresh } = useAuth();
  const [step, setStep] = useState<Step>("idle");
  const [setup, setSetup] = useState<TotpSetupResponse | null>(null);
  const [code, setCode] = useState("");
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const startSetup = async () => {
    setError(null);
    setIsSubmitting(true);
    try {
      const result = await setupTotp();
      setSetup(result);
      setStep("confirm");
    } catch (err) {
      setError(describeAuthError(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const confirmCode = async () => {
    setError(null);
    setIsSubmitting(true);
    try {
      const result = await confirmTotp(code);
      setRecoveryCodes(result.recoveryCodes);
      setStep("codes");
    } catch (err) {
      setError(describeAuthError(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const finish = async () => {
    setStep("idle");
    setSetup(null);
    setCode("");
    setRecoveryCodes([]);
    await refresh();
  };

  return {
    step,
    setup,
    code,
    setCode,
    recoveryCodes,
    error,
    isSubmitting,
    startSetup,
    confirmCode,
    finish,
  };
}
