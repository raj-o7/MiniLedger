import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Loan } from '../api/types';
import { colors, spacing } from '../theme';
import { formatDate, formatMoney } from '../utils/format';
import { StatusBadge } from './StatusBadge';

interface LoanCardProps {
  loan: Loan;
  onPress: () => void;
}

export function LoanCard({ loan, onPress }: LoanCardProps) {
  const dateLine =
    loan.status === 'repaid' && loan.repaidDate
      ? `Repaid on ${formatDate(loan.repaidDate)}`
      : `Due ${formatDate(loan.dueDate)}`;

  return (
    <Pressable
      testID={`loan-card-${loan.id}`}
      accessibilityRole="button"
      accessibilityLabel={`${loan.friendName}, ${formatMoney(loan.amount)}, ${dateLine}`}
      onPress={onPress}
      style={({ pressed }) => [styles.card, loan.isOverdue && styles.overdue, pressed && styles.pressed]}
    >
      <View style={styles.row}>
        <Text style={styles.name} numberOfLines={1}>
          {loan.friendName}
        </Text>
        <Text style={[styles.amount, loan.isOverdue && styles.overdueText]}>
          {formatMoney(loan.amount)}
        </Text>
      </View>
      <View style={styles.row}>
        <Text style={[styles.date, loan.isOverdue && styles.overdueText]}>{dateLine}</Text>
        <StatusBadge loan={loan} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderLeftWidth: 4,
    borderLeftColor: colors.border,
    gap: spacing.sm,
  },
  overdue: {
    borderLeftColor: colors.danger,
    backgroundColor: '#FFF5F5',
  },
  pressed: { opacity: 0.8 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm },
  name: { fontSize: 16, fontWeight: '600', color: colors.text, flexShrink: 1 },
  amount: { fontSize: 16, fontWeight: '700', color: colors.text },
  date: { fontSize: 14, color: colors.textMuted },
  overdueText: { color: colors.danger },
});
