import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { getErrorMessage } from '../api/client';
import { createLoan } from '../api/miniLedgerApi';
import { Button } from '../components/Button';
import { InlineError } from '../components/StateViews';
import { TextField } from '../components/TextField';
import type { ScreenProps } from '../navigation/types';
import { colors, spacing } from '../theme';
import { addDays, todayString } from '../utils/format';
import {
  MAX_RECEIPT_DATA_URI_LENGTH,
  isValidDate,
  parseAmount,
  validateLoanForm,
  type LoanFormErrors,
  type LoanFormValues,
} from '../utils/validation';

const DUE_SHORTCUTS = [
  { label: '+1 week', days: 7 },
  { label: '+2 weeks', days: 14 },
  { label: '+1 month', days: 30 },
];

export function AddLoanScreen({ navigation }: ScreenProps<'AddLoan'>) {
  const [values, setValues] = useState<LoanFormValues>({
    friendName: '',
    amount: '',
    loanDate: todayString(),
    dueDate: '',
  });
  const [errors, setErrors] = useState<LoanFormErrors>({});
  const [receiptImage, setReceiptImage] = useState<string | null>(null);
  const [receiptError, setReceiptError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function updateField(field: keyof LoanFormValues, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  }

  function setDueInDays(days: number) {
    const start = isValidDate(values.loanDate) ? values.loanDate : todayString();
    updateField('dueDate', addDays(start, days));
  }

  async function pickReceipt() {
    setReceiptError(null);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        base64: true,
        quality: 0.5, // compress so the upload stays small
      });
      if (result.canceled) {
        return;
      }
      const base64 = result.assets[0]?.base64;
      if (!base64) {
        setReceiptError('Could not read that image. Please choose another one.');
        return;
      }
      // The picker always returns JPEG data when base64 is requested.
      const dataUri = `data:image/jpeg;base64,${base64.replace(/\s/g, '')}`;
      if (dataUri.length > MAX_RECEIPT_DATA_URI_LENGTH) {
        setReceiptError('That image is too large (max 2 MB). Please choose a smaller one.');
        return;
      }
      setReceiptImage(dataUri);
    } catch (err) {
      setReceiptError(getErrorMessage(err));
    }
  }

  async function handleSave() {
    const validationErrors = validateLoanForm(values, todayString());
    setErrors(validationErrors);
    setSubmitError(null);
    const amount = parseAmount(values.amount);
    if (Object.keys(validationErrors).length > 0 || amount === null) {
      return;
    }

    setSaving(true);
    try {
      const loan = await createLoan({
        friendName: values.friendName.trim(),
        amount,
        loanDate: values.loanDate,
        dueDate: values.dueDate,
        receiptImage: receiptImage ?? undefined,
      });
      // Replace this form with the new loan's details, so "back" returns to the previous screen.
      navigation.replace('LoanDetails', { loanId: loan.id });
    } catch (err) {
      setSubmitError(getErrorMessage(err));
      setSaving(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={100}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <InlineError message={submitError} />

        <TextField
          label="Friend's name"
          value={values.friendName}
          onChangeText={(text) => updateField('friendName', text)}
          placeholder="e.g. Asha"
          autoCapitalize="words"
          maxLength={100}
          error={errors.friendName}
          testID="friend-name-input"
        />
        <TextField
          label="Amount"
          value={values.amount}
          onChangeText={(text) => updateField('amount', text)}
          placeholder="e.g. 1500"
          keyboardType="decimal-pad"
          error={errors.amount}
          testID="amount-input"
        />
        <TextField
          label="Loan date"
          value={values.loanDate}
          onChangeText={(text) => updateField('loanDate', text)}
          placeholder="YYYY-MM-DD"
          autoCapitalize="none"
          error={errors.loanDate}
          hint="The day you gave the money (YYYY-MM-DD)."
        />
        <TextField
          label="Due date"
          value={values.dueDate}
          onChangeText={(text) => updateField('dueDate', text)}
          placeholder="YYYY-MM-DD"
          autoCapitalize="none"
          error={errors.dueDate}
          hint="When your friend should pay you back."
          testID="due-date-input"
        />
        <View style={styles.shortcuts}>
          {DUE_SHORTCUTS.map((shortcut) => (
            <Pressable
              key={shortcut.days}
              onPress={() => setDueInDays(shortcut.days)}
              style={styles.shortcut}
              accessibilityRole="button"
            >
              <Text style={styles.shortcutText}>{shortcut.label}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.sectionLabel}>Receipt photo (optional)</Text>
        {receiptImage ? (
          <View style={styles.receipt}>
            <Image
              source={{ uri: receiptImage }}
              style={styles.receiptImage}
              resizeMode="cover"
              accessibilityLabel="Selected receipt photo"
            />
            <Button title="Remove photo" variant="secondary" onPress={() => setReceiptImage(null)} />
          </View>
        ) : (
          <Button title="Choose receipt photo" variant="secondary" onPress={pickReceipt} />
        )}
        {receiptError ? <Text style={styles.receiptError}>{receiptError}</Text> : null}

        <View style={styles.saveArea}>
          <Button title="Save loan" onPress={handleSave} loading={saving} testID="save-loan" />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { padding: spacing.md, paddingBottom: spacing.lg * 2 },
  shortcuts: { flexDirection: 'row', gap: spacing.sm, marginTop: -spacing.sm, marginBottom: spacing.md },
  shortcut: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#DBEAFE',
  },
  shortcutText: { color: colors.primary, fontWeight: '600', fontSize: 13 },
  sectionLabel: { fontSize: 14, fontWeight: '600', color: colors.text, marginBottom: spacing.xs },
  receipt: { gap: spacing.sm },
  receiptImage: { width: '100%', height: 200, borderRadius: 10, backgroundColor: colors.border },
  receiptError: { color: colors.danger, fontSize: 13, marginTop: spacing.xs },
  saveArea: { marginTop: spacing.lg },
});
