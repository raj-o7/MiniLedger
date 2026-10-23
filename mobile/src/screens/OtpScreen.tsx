import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text } from 'react-native';
import { getErrorMessage } from '../api/client';
import { requestOtp, verifyOtp } from '../api/miniLedgerApi';
import { useAuth } from '../auth/AuthContext';
import { Button } from '../components/Button';
import { InlineError } from '../components/StateViews';
import { TextField } from '../components/TextField';
import type { ScreenProps } from '../navigation/types';
import { colors, spacing } from '../theme';
import { validateOtp } from '../utils/validation';

const RESEND_WAIT_SECONDS = 30;

export function OtpScreen({ route }: ScreenProps<'Otp'>) {
  const { phone } = route.params;
  const { signIn } = useAuth();
  const [code, setCode] = useState('');
  const [codeError, setCodeError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(RESEND_WAIT_SECONDS);

  // Count down once per second until the user may request another code.
  useEffect(() => {
    if (secondsLeft <= 0) {
      return;
    }
    const timer = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [secondsLeft]);

  async function handleVerify() {
    const validationError = validateOtp(code);
    setCodeError(validationError);
    setError(null);
    setNotice(null);
    if (validationError) {
      return;
    }

    setVerifying(true);
    try {
      const { token, user } = await verifyOtp(phone, code.trim());
      // Signing in switches the navigator to the logged-in screens automatically.
      await signIn(token, user);
    } catch (err) {
      setError(getErrorMessage(err));
      setVerifying(false);
    }
  }

  async function handleResend() {
    setError(null);
    setNotice(null);
    setResending(true);
    try {
      await requestOtp(phone);
      setCode('');
      setNotice('A new code has been sent.');
      setSecondsLeft(RESEND_WAIT_SECONDS);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setResending(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Enter your code</Text>
        <Text style={styles.subtitle}>We sent a 6-digit code to {phone}.</Text>
        <Text style={styles.devNote}>
          Development mode: no SMS is sent. The code is printed in the backend terminal.
        </Text>

        <InlineError message={error} />
        {notice ? <Text style={styles.notice}>{notice}</Text> : null}

        <TextField
          label="Verification code"
          value={code}
          onChangeText={(text) => {
            setCode(text.replace(/\D/g, ''));
            setCodeError(null);
          }}
          placeholder="123456"
          keyboardType="number-pad"
          autoComplete="one-time-code"
          textContentType="oneTimeCode"
          maxLength={6}
          error={codeError}
          editable={!verifying}
          onSubmitEditing={handleVerify}
          style={styles.codeInput}
          testID="otp-input"
        />

        <Button title="Verify and log in" onPress={handleVerify} loading={verifying} testID="verify" />
        <Text style={styles.spacer} />
        <Button
          title={secondsLeft > 0 ? `Resend code in ${secondsLeft}s` : 'Resend code'}
          onPress={handleResend}
          variant="secondary"
          loading={resending}
          disabled={secondsLeft > 0 || verifying}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  container: { flexGrow: 1, padding: spacing.lg },
  title: { fontSize: 24, fontWeight: '700', color: colors.text, marginBottom: spacing.sm },
  subtitle: { fontSize: 16, color: colors.textMuted, marginBottom: spacing.sm },
  devNote: {
    fontSize: 13,
    color: colors.warning,
    backgroundColor: colors.warningBg,
    padding: spacing.sm,
    borderRadius: 8,
    marginBottom: spacing.md,
  },
  notice: { color: colors.success, marginBottom: spacing.md },
  codeInput: { fontSize: 24, letterSpacing: 8, textAlign: 'center' },
  spacer: { height: spacing.sm },
});
