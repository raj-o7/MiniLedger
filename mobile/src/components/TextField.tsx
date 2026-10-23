import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import { colors, spacing } from '../theme';

interface TextFieldProps extends TextInputProps {
  label: string;
  error?: string | null;
  hint?: string;
}

export function TextField({ label, error, hint, style, ...inputProps }: TextFieldProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={colors.textMuted}
        style={[styles.input, error ? styles.inputError : null, style]}
        {...inputProps}
      />
      {error ? (
        <Text style={styles.error}>{error}</Text>
      ) : hint ? (
        <Text style={styles.hint}>{hint}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: spacing.md },
  label: { fontSize: 14, fontWeight: '600', color: colors.text, marginBottom: spacing.xs },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    fontSize: 16,
    color: colors.text,
  },
  inputError: { borderColor: colors.danger },
  error: { color: colors.danger, fontSize: 13, marginTop: spacing.xs },
  hint: { color: colors.textMuted, fontSize: 13, marginTop: spacing.xs },
});
