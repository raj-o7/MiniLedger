import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { LoanFilter } from '../api/types';

/** Every screen and the parameters it needs when you navigate to it. */
export type RootStackParamList = {
  Login: undefined;
  Otp: { phone: string };
  Dashboard: undefined;
  Loans: { filter?: LoanFilter } | undefined;
  AddLoan: undefined;
  LoanDetails: { loanId: number };
};

export type ScreenProps<Name extends keyof RootStackParamList> = NativeStackScreenProps<
  RootStackParamList,
  Name
>;
