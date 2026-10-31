/// <reference types="jest" />

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const readSource = (path: string) => readFileSync(resolve(__dirname, path), 'utf8');

describe('backend-first client data boundary', () => {
  it('keeps notification navigation and rewards balance reads off the Supabase client', () => {
    const notificationScreen = readSource('../../app/(shared)/dashboard/notifications.tsx');
    const rewardsWidget = readSource('../../components/BlockchainTokensView.tsx');
    const balanceContext = readSource('../../contexts/BalanceContext.tsx');
    const rewardsService = readSource('../../lib/lukas-reward-service.ts');

    for (const source of [notificationScreen, rewardsWidget, balanceContext, rewardsService]) {
      expect(source).not.toMatch(/\bsupabase\s*\.\s*(from|rpc)\s*\(/);
    }

    expect(notificationScreen).toContain("'networking/my-requests'");
    expect(rewardsService).toContain("'lukas/balance'");
    expect(rewardsService).toContain('apiClient.request');
  });

  it('keeps the meeting request list on the authenticated API client', () => {
    const source = readSource('../../app/events/[eventSlug]/networking/my-requests.tsx');
    expect(source).toContain("eventApiPath(eventId, 'meetings/requests')");
    expect(source).toContain('apiClient.request(meetingRequestsPath');
    expect(source).not.toMatch(/\bsupabase\s*\.\s*(from|rpc)\s*\(/);
  });

  it('keeps chat key publication and backup operations behind the authenticated API', () => {
    const source = readSource('../../lib/chat-encryption.ts');
    expect(source).toContain("apiClient.request('chat/keys'");
    expect(source).not.toMatch(/\bsupabase\s*\.\s*(from|rpc)\s*\(/);
  });
});
