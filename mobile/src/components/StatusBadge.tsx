import { StyleSheet, Text, View } from 'react-native';
import type { Loan } from '../api/types';
import { colors } from '../theme';

type BadgeKind = 'repaid' | 'overdue' | 'pending';

export function getBadgeKind(loan: Pick<Loan, 'status' | 'isOverdue'>): BadgeKind {
  if (loan.status === 'repaid') {
    return 'repaid';
  }
  return loan.isOverdue ? 'overdue' : 'pending';
}

const BADGES: Record<BadgeKind, { label: string; color: string; background: string }> = {
  repaid: { label: 'Repaid', color: colors.success, background: colors.successBg },
  overdue: { label: 'Overdue', color: colors.danger, background: colors.dangerBg },
  pending: { label: 'Pending', color: colors.warning, background: colors.warningBg },
};

export function StatusBadge({ loan }: { loan: Pick<Loan, 'status' | 'isOverdue'> }) {
  const badge = BADGES[getBadgeKind(loan)];
  return (
    <View style={[styles.badge, { backgroundColor: badge.background }]}>
      <Text style={[styles.text, { color: badge.color }]}>{badge.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, alignSelf: 'flex-start' },
  text: { fontSize: 12, fontWeight: '700' },
});
