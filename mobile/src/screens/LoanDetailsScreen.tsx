import { useCallback, useState } from 'react';
import { Alert, Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { getErrorMessage } from '../api/client';
import { getLoan, repayLoan } from '../api/miniLedgerApi';
import type { LoanDetails } from '../api/types';
import { Button } from '../components/Button';
import { ErrorView, InlineError, LoadingView } from '../components/StateViews';
import { StatusBadge } from '../components/StatusBadge';
import { useFocusedData } from '../hooks/useFocusedData';
import type { ScreenProps } from '../navigation/types';
import { colors, spacing } from '../theme';
import { daysBetween, formatDate, formatMoney, todayString } from '../utils/format';

function plural(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? '' : 's'}`;
}

/** A short sentence about the due date, e.g. "Overdue by 3 days" or "Due in 5 days". */
export function describeDueDate(loan: Pick<LoanDetails, 'status' | 'dueDate' | 'isOverdue'>, today: string): string {
  if (loan.status === 'repaid') {
    return 'Repaid';
  }
  const days = daysBetween(today, loan.dueDate);
  if (loan.isOverdue) {
    return `Overdue by ${plural(Math.max(1, -days), 'day')}`;
  }
  if (days === 0) {
    return 'Due today';
  }
  return `Due in ${plural(days, 'day')}`;
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

export function LoanDetailsScreen({ route }: ScreenProps<'LoanDetails'>) {
  const { loanId } = route.params;
  const fetchLoan = useCallback(() => getLoan(loanId), [loanId]);
  const { data: loan, setData, error, retry } = useFocusedData(fetchLoan);
  const [repaying, setRepaying] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  if (!loan) {
    return error ? <ErrorView message={error} onRetry={retry} /> : <LoadingView message="Loading loan..." />;
  }

  async function markRepaid(current: LoanDetails) {
    setRepaying(true);
    setActionError(null);
    try {
      setData(await repayLoan(current.id));
    } catch (err) {
      setActionError(getErrorMessage(err));
    } finally {
      setRepaying(false);
    }
  }

  function confirmRepay(current: LoanDetails) {
    Alert.alert(
      'Mark as repaid?',
      `Confirm that ${current.friendName} paid back ${formatMoney(current.amount)} today.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Mark repaid', onPress: () => void markRepaid(current) },
      ],
    );
  }

  const today = todayString();

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={[styles.header, loan.isOverdue && styles.headerOverdue]}>
        <View style={styles.headerTop}>
          <Text style={styles.friend} numberOfLines={2}>
            {loan.friendName}
          </Text>
          <StatusBadge loan={loan} />
        </View>
        <Text style={[styles.amount, loan.isOverdue && styles.overdueText]}>{formatMoney(loan.amount)}</Text>
        <Text style={[styles.dueText, loan.isOverdue && styles.overdueText]}>
          {describeDueDate(loan, today)}
        </Text>
      </View>

      <InlineError message={actionError ?? error} />

      <View style={styles.section}>
        <DetailRow label="Loan date" value={formatDate(loan.loanDate)} />
        <DetailRow label="Due date" value={formatDate(loan.dueDate)} />
        <DetailRow label="Status" value={loan.status === 'repaid' ? 'Repaid' : 'Not repaid yet'} />
        {loan.repaidDate ? <DetailRow label="Repaid on" value={formatDate(loan.repaidDate)} /> : null}
      </View>

      <Text style={styles.sectionTitle}>Receipt</Text>
      {loan.receiptImage ? (
        <Image
          source={{ uri: loan.receiptImage }}
          style={styles.receipt}
          resizeMode="contain"
          accessibilityLabel="Receipt photo"
        />
      ) : (
        <Text style={styles.muted}>No receipt attached.</Text>
      )}

      {loan.status === 'pending' ? (
        <View style={styles.action}>
          <Button
            title="Mark as repaid"
            onPress={() => confirmRepay(loan)}
            loading={repaying}
            testID="mark-repaid"
          />
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.md, paddingBottom: spacing.lg * 2 },
  header: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
  },
  headerOverdue: { borderColor: colors.danger, backgroundColor: '#FFF5F5' },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm },
  friend: { fontSize: 20, fontWeight: '700', color: colors.text, flexShrink: 1 },
  amount: { fontSize: 32, fontWeight: '800', color: colors.text, marginTop: spacing.sm },
  dueText: { fontSize: 15, color: colors.textMuted, marginTop: spacing.xs },
  overdueText: { color: colors.danger },
  section: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  rowLabel: { color: colors.textMuted, fontSize: 15 },
  rowValue: { color: colors.text, fontSize: 15, fontWeight: '600' },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: spacing.sm },
  receipt: { width: '100%', height: 320, borderRadius: 12, backgroundColor: colors.border },
  muted: { color: colors.textMuted },
  action: { marginTop: spacing.lg },
});
