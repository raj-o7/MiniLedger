import { useCallback, useLayoutEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { getLoans } from '../api/miniLedgerApi';
import type { LoanFilter } from '../api/types';
import { LoanCard } from '../components/LoanCard';
import { EmptyState, ErrorView, InlineError, LoadingView } from '../components/StateViews';
import { useFocusedData } from '../hooks/useFocusedData';
import type { ScreenProps } from '../navigation/types';
import { colors, spacing } from '../theme';

const FILTERS: { value: LoanFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'repaid', label: 'Repaid' },
];

const EMPTY_MESSAGES: Record<LoanFilter, { title: string; message: string }> = {
  all: { title: 'No loans yet', message: 'Loans you record will appear here.' },
  pending: { title: 'Nothing pending', message: 'Every loan has been repaid. Nice!' },
  overdue: { title: 'Nothing overdue', message: 'No pending loan is past its due date.' },
  repaid: { title: 'No repaid loans', message: 'Loans you mark as repaid will appear here.' },
};

export function LoanListScreen({ navigation, route }: ScreenProps<'Loans'>) {
  const [filter, setFilter] = useState<LoanFilter>(route.params?.filter ?? 'all');
  const fetchLoans = useCallback(() => getLoans(filter), [filter]);
  const { data: loans, error, refreshing, refresh, retry } = useFocusedData(fetchLoans);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <Pressable onPress={() => navigation.navigate('AddLoan')} accessibilityRole="button" hitSlop={8}>
          <Text style={styles.headerButton}>+ Add</Text>
        </Pressable>
      ),
    });
  }, [navigation]);

  return (
    <View style={styles.container}>
      <View style={styles.filters} accessibilityRole="tablist">
        {FILTERS.map((item) => {
          const selected = item.value === filter;
          return (
            <Pressable
              key={item.value}
              onPress={() => setFilter(item.value)}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              style={[styles.chip, selected && styles.chipSelected]}
            >
              <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{item.label}</Text>
            </Pressable>
          );
        })}
      </View>

      {!loans ? (
        error ? (
          <ErrorView message={error} onRetry={retry} />
        ) : (
          <LoadingView message="Loading loans..." />
        )
      ) : (
        <FlatList
          data={loans}
          keyExtractor={(loan) => String(loan.id)}
          renderItem={({ item }) => (
            <LoanCard loan={item} onPress={() => navigation.navigate('LoanDetails', { loanId: item.id })} />
          )}
          ListHeaderComponent={<InlineError message={error} />}
          ListEmptyComponent={
            <EmptyState
              title={EMPTY_MESSAGES[filter].title}
              message={EMPTY_MESSAGES[filter].message}
              actionTitle={filter === 'all' ? 'Add a loan' : undefined}
              onAction={filter === 'all' ? () => navigation.navigate('AddLoan') : undefined}
            />
          }
          contentContainerStyle={styles.list}
          refreshing={refreshing}
          onRefresh={refresh}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerButton: { color: colors.primary, fontSize: 16, fontWeight: '600' },
  filters: { flexDirection: 'row', gap: spacing.sm, padding: spacing.md, paddingBottom: spacing.sm },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.text, fontWeight: '600' },
  chipTextSelected: { color: colors.primaryText },
  list: { flexGrow: 1, padding: spacing.md, paddingTop: spacing.sm },
});
