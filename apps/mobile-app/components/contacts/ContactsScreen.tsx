import React, { useState } from 'react';
import AuthenticatorFlow from '../security/AuthenticatorFlow';
import { ActionButton } from '@hashpass/ui/primitives';
import type { ContactsAction } from '../../types/contacts';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { uiPalette } from '@hashpass/ui/tokens';
import { useAuth } from '../../hooks/useAuth';
import { useContacts } from '../../hooks/useContacts';
import { usePin } from '../../hooks/usePin';
import { useSetup } from '../../hooks/useSetup';
import { useTheme } from '../../hooks/useTheme';
import SetupWizard from '../security/SetupWizard';
import ContactsExperience from './ContactsExperience';

export default function ContactsScreen({ standalone = false }) {
  const { user, dbUserId, isLoading: authLoading } = useAuth();
  const { isDark } = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ card?: string }>();
  const card = typeof params.card === 'string' ? params.card : undefined;
  const network = useContacts(authLoading ? null : user?.id ?? null, card);
  const accountId = authLoading ? null : dbUserId ?? null;
  const setup = useSetup(accountId);
  const pin = usePin(accountId);
  const [pending, setPending] = useState<ContactsAction | null>(null);
  const returnTo = `/contacts${card ? `?card=${encodeURIComponent(card)}` : ''}`;
  const mode = isDark ? 'dark' : 'light';
  // First Contacts open (or new consent text): nothing is shared until setup is finished.
  const gated = !!setup.view && !!setup.context && setup.view.phase !== 'complete';
  return <SafeAreaView edges={standalone ? ['top', 'bottom'] : ['bottom']} style={{ flex: 1, backgroundColor: uiPalette(isDark).canvas }}>
    {pending ? <>
      <AuthenticatorFlow scope="critical" onDone={() => { const action = pending; setPending(null); void network.act(action); }} />
      <ActionButton mode={mode} label="Cancel" variant="ghost" onPress={() => setPending(null)} />
    </> : gated ? <SetupWizard mode={mode} view={setup.view!} context={setup.context!} send={setup.send} pin={pin} /> : <ContactsExperience
      key={user?.id ?? 'guest'}
      snapshot={network.snapshot}
      loading={authLoading || network.loading}
      busy={network.busy}
      error={network.error}
      signedIn={!!user}
      standalone={standalone}
      mode={mode}
      onAction={(action: ContactsAction) => { setPending(action); return Promise.resolve(false); }}
      onRetry={() => { void network.reload(); }}
      onSignIn={() => router.push({ pathname: '/(shared)/auth', params: { returnTo } } as never)}
      onDashboard={() => router.push('/(shared)/dashboard/contacts' as never)}
      onStandalone={() => router.push('/contacts' as never)}
    />}
  </SafeAreaView>;
}
