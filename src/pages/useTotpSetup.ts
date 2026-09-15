import { useState } from "react";
import {
  confirmTotp,
  setupTotp,
  type TotpSetupResponse,
} from "../api/client.ts";
import { describeAuthError } from "../api/errors.ts";
import { useAuth } from "../context/useAuth.ts";

export enum TotpSetupStep {
  Idle = "idle",
  Confirm = "confirm",
  Codes = "codes",
}

export function useTotpSetup() {
  const { refresh } = useAuth();
  const [step, setStep] = useState<TotpSetupStep>(TotpSetupStep.Idle);
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
      setStep(TotpSetupStep.Confirm);
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
      setStep(TotpSetupStep.Codes);
    } catch (err) {
      setError(describeAuthError(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const finish = async () => {
    setStep(TotpSetupStep.Idle);
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
