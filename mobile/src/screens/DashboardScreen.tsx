import { useCallback, useLayoutEffect } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { getSummary } from '../api/miniLedgerApi';
import { useAuth } from '../auth/AuthContext';
import { Button } from '../components/Button';
import { ErrorView, InlineError, LoadingView } from '../components/StateViews';
import { useFocusedData } from '../hooks/useFocusedData';
import type { ScreenProps } from '../navigation/types';
import { colors, spacing } from '../theme';
import { formatMoney } from '../utils/format';

function SummaryCard({
  label,
  value,
  detail,
  danger = false,
  onPress,
}: {
  label: string;
  value: string;
  detail?: string;
  danger?: boolean;
  onPress?: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : 'summary'}
      style={[styles.card, danger && styles.cardDanger]}
    >
      <Text style={styles.cardLabel}>{label}</Text>
      <Text style={[styles.cardValue, danger && styles.dangerText]}>{value}</Text>
      {detail ? <Text style={styles.cardDetail}>{detail}</Text> : null}
    </Pressable>
  );
}

export function DashboardScreen({ navigation }: ScreenProps<'Dashboard'>) {
  const { state, signOut } = useAuth();
  const fetchSummary = useCallback(() => getSummary(), []);
  const { data: summary, error, refreshing, refresh, retry } = useFocusedData(fetchSummary);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <Pressable onPress={() => void signOut()} accessibilityRole="button" hitSlop={8}>
          <Text style={styles.logout}>Log out</Text>
        </Pressable>
      ),
    });
  }, [navigation, signOut]);

  if (!summary) {
    return error ? <ErrorView message={error} onRetry={retry} /> : <LoadingView />;
  }

  const phone = state.status === 'signedIn' ? state.user.phone : '';
  const hasOverdue = summary.overdue > 0;

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
    >
      <Text style={styles.greeting}>Logged in as {phone}</Text>
      <InlineError message={error} />

      <View style={styles.hero}>
        <Text style={styles.heroLabel}>Outstanding (still to be repaid)</Text>
        <Text style={styles.heroValue}>{formatMoney(summary.outstanding)}</Text>
        <Text style={styles.heroDetail}>
          {summary.pendingLoans} pending {summary.pendingLoans === 1 ? 'loan' : 'loans'}
        </Text>
      </View>

      <View style={styles.grid}>
        <SummaryCard label="Total lent" value={formatMoney(summary.totalLent)} />
        <SummaryCard label="Total repaid" value={formatMoney(summary.totalRepaid)} />
        <SummaryCard
          label="Overdue"
          value={formatMoney(summary.overdue)}
          detail={hasOverdue ? `${summary.overdueLoans} overdue · tap to view` : 'Nothing overdue'}
          danger={hasOverdue}
          onPress={hasOverdue ? () => navigation.navigate('Loans', { filter: 'overdue' }) : undefined}
        />
        <SummaryCard
          label="Total loans"
          value={String(summary.totalLoans)}
          detail={`${summary.repaidLoans} repaid`}
        />
      </View>

      {summary.totalLoans === 0 ? (
        <Text style={styles.emptyHint}>
          You haven't recorded any loans yet. Add your first one to start tracking.
        </Text>
      ) : null}

      <Button title="Add a loan" onPress={() => navigation.navigate('AddLoan')} testID="add-loan" />
      <View style={styles.gap} />
      <Button
        title="View all loans"
        variant="secondary"
        onPress={() => navigation.navigate('Loans', { filter: 'all' })}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.md },
  greeting: { color: colors.textMuted, marginBottom: spacing.md },
  logout: { color: colors.primary, fontSize: 16, fontWeight: '600' },
  hero: {
    backgroundColor: colors.primary,
    borderRadius: 16,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  heroLabel: { color: '#DBEAFE', fontSize: 14 },
  heroValue: { color: colors.primaryText, fontSize: 34, fontWeight: '800', marginVertical: spacing.xs },
  heroDetail: { color: '#DBEAFE', fontSize: 14 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
  card: {
    flexGrow: 1,
    flexBasis: '45%',
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardDanger: { borderColor: colors.danger, backgroundColor: '#FFF5F5' },
  cardLabel: { color: colors.textMuted, fontSize: 13 },
  cardValue: { color: colors.text, fontSize: 20, fontWeight: '700', marginTop: spacing.xs },
  cardDetail: { color: colors.textMuted, fontSize: 12, marginTop: spacing.xs },
  dangerText: { color: colors.danger },
  emptyHint: { color: colors.textMuted, textAlign: 'center', marginBottom: spacing.md },
  gap: { height: spacing.sm },
});
