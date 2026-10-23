import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../auth/AuthContext';
import { LoadingView } from '../components/StateViews';
import { AddLoanScreen } from '../screens/AddLoanScreen';
import { DashboardScreen } from '../screens/DashboardScreen';
import { LoanDetailsScreen } from '../screens/LoanDetailsScreen';
import { LoanListScreen } from '../screens/LoanListScreen';
import { LoginScreen } from '../screens/LoginScreen';
import { OtpScreen } from '../screens/OtpScreen';
import { colors } from '../theme';
import type { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

/**
 * Logged-out users only see Login and OTP. Logged-in users only see the app screens.
 * When the auth state changes, React Navigation switches between the two groups for us.
 */
export function RootNavigator() {
  const { state } = useAuth();

  if (state.status === 'loading') {
    return <LoadingView message="Starting MiniLedger..." />;
  }

  return (
    <Stack.Navigator
      screenOptions={{
        contentStyle: { backgroundColor: colors.background },
        headerTintColor: colors.primary,
        headerTitleStyle: { color: colors.text },
      }}
    >
      {state.status === 'signedOut' ? (
        <>
          <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
          <Stack.Screen name="Otp" component={OtpScreen} options={{ title: 'Verify code' }} />
        </>
      ) : (
        <>
          <Stack.Screen name="Dashboard" component={DashboardScreen} options={{ title: 'MiniLedger' }} />
          <Stack.Screen name="Loans" component={LoanListScreen} options={{ title: 'Loans' }} />
          <Stack.Screen name="AddLoan" component={AddLoanScreen} options={{ title: 'Add loan' }} />
          <Stack.Screen name="LoanDetails" component={LoanDetailsScreen} options={{ title: 'Loan details' }} />
        </>
      )}
    </Stack.Navigator>
  );
}
