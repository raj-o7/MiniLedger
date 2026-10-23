import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text } from 'react-native';
import { getErrorMessage } from '../api/client';
import { requestOtp } from '../api/miniLedgerApi';
import { Button } from '../components/Button';
import { InlineError } from '../components/StateViews';
import { TextField } from '../components/TextField';
import type { ScreenProps } from '../navigation/types';
import { colors, spacing } from '../theme';
import { normalizePhone, validatePhone } from '../utils/validation';

export function LoginScreen({ navigation }: ScreenProps<'Login'>) {
  const [phone, setPhone] = useState('');
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSendCode() {
    const validationError = validatePhone(phone);
    setPhoneError(validationError);
    setError(null);
    if (validationError) {
      return;
    }

    setLoading(true);
    try {
      const result = await requestOtp(normalizePhone(phone));
      navigation.navigate('Otp', { phone: result.phone });
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>MiniLedger</Text>
        <Text style={styles.subtitle}>Keep track of money you lend to friends.</Text>

        <InlineError message={error} />

        <TextField
          label="Phone number"
          value={phone}
          onChangeText={(text) => {
            setPhone(text);
            setPhoneError(null);
          }}
          placeholder="+91 98765 43210"
          keyboardType="phone-pad"
          autoComplete="tel"
          textContentType="telephoneNumber"
          error={phoneError}
          hint="Include your country code. We'll send you a 6-digit code."
          editable={!loading}
          onSubmitEditing={handleSendCode}
          testID="phone-input"
        />

        <Button title="Send code" onPress={handleSendCode} loading={loading} testID="send-code" />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  container: { flexGrow: 1, justifyContent: 'center', padding: spacing.lg },
  title: { fontSize: 32, fontWeight: '800', color: colors.primary, marginBottom: spacing.sm },
  subtitle: { fontSize: 16, color: colors.textMuted, marginBottom: spacing.lg },
});
