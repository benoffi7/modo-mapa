import { useState, useEffect, useRef } from 'react';

interface UseVerificationCooldownResult {
  verificationSent: boolean;
  verificationLoading: boolean;
  verificationCooldown: number;
  handleResendVerification: () => Promise<void>;
}

/**
 * Manages cooldown timer for email verification resend.
 * @param resendFn - The async function that actually sends the verification email.
 * @param cooldownSeconds - Duration of cooldown in seconds (default 60).
 */
export function useVerificationCooldown(
  resendFn: () => Promise<void>,
  cooldownSeconds = 60,
): UseVerificationCooldownResult {
  const [verificationSent, setVerificationSent] = useState(false);
  const [verificationLoading, setVerificationLoading] = useState(false);
  const [verificationCooldown, setVerificationCooldown] = useState(0);
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (verificationCooldown <= 0) {
      if (cooldownRef.current) clearInterval(cooldownRef.current);
      return;
    }
    cooldownRef.current = setInterval(() => {
      setVerificationCooldown((c) => c - 1);
    }, 1000);
    return () => { if (cooldownRef.current) clearInterval(cooldownRef.current); };
  }, [verificationCooldown > 0]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleResendVerification = async () => {
    setVerificationLoading(true);
    try {
      await resendFn();
      setVerificationSent(true);
      setVerificationCooldown(cooldownSeconds);
    } catch {
      // error handled by caller/context
    } finally {
      setVerificationLoading(false);
    }
  };

  return { verificationSent, verificationLoading, verificationCooldown, handleResendVerification };
}
