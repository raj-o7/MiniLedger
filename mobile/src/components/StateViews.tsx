import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { colors, spacing } from '../theme';
import { Button } from './Button';

/** Full-screen spinner shown while data loads for the first time. */
export function LoadingView({ message = 'Loading...' }: { message?: string }) {
  return (
    <View style={styles.center}>
      <ActivityIndicator size="large" color={colors.primary} />
      <Text style={styles.muted}>{message}</Text>
    </View>
  );
}

/** Explains what went wrong and offers a retry button. */
export function ErrorView({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <View style={styles.center}>
      <Text style={styles.title}>Something went wrong</Text>
      <Text style={styles.message}>{message}</Text>
      {onRetry ? <Button title="Try again" onPress={onRetry} variant="secondary" /> : null}
    </View>
  );
}

/** Shown when a list has nothing in it yet. */
export function EmptyState({
  title,
  message,
  actionTitle,
  onAction,
}: {
  title: string;
  message: string;
  actionTitle?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.center}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.message}>{message}</Text>
      {actionTitle && onAction ? <Button title={actionTitle} onPress={onAction} /> : null}
    </View>
  );
}

/** A small red message box used inside forms. */
export function InlineError({ message }: { message: string | null }) {
  if (!message) {
    return null;
  }
  return (
    <View style={styles.inlineError} accessibilityRole="alert">
      <Text style={styles.inlineErrorText}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
    gap: spacing.md,
  },
  title: { fontSize: 18, fontWeight: '700', color: colors.text, textAlign: 'center' },
  message: { fontSize: 15, color: colors.textMuted, textAlign: 'center' },
  muted: { color: colors.textMuted },
  inlineError: {
    backgroundColor: colors.dangerBg,
    borderRadius: 8,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  inlineErrorText: { color: colors.danger, fontSize: 14 },
});
