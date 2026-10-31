import { apiClient } from './api-client';
import type { BalanceApiResponse } from '../types/LukasReward.types';

class LukasRewardService {
  /** Fetch the current account's balance through the authenticated backend API. */
  async getUserBalance(tokenSymbol: string = 'LUKAS'): Promise<number> {
    const response = await apiClient.request('lukas/balance', {
      skipEventSegment: true,
      params: { tokenSymbol },
    });

    if (!response.success) throw new Error(response.error);

    const payload = response.data as BalanceApiResponse | null;
    const balance = Number(payload?.data?.balance ?? 0);
    if (!Number.isFinite(balance)) throw new Error('The rewards balance is invalid');
    return balance;
  }
}

export const lukasRewardService = new LukasRewardService();
