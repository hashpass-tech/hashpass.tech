/// <reference types="jest" />

const mockRequest = jest.fn();

jest.mock('../../lib/api-client', () => ({
  apiClient: { request: (...args: unknown[]) => mockRequest(...args) },
}));

import { lukasRewardService } from '../../lib/lukas-reward-service';

describe('lukasRewardService', () => {
  beforeEach(() => mockRequest.mockReset());

  it('fetches the authenticated default-token balance and returns a number', async () => {
    mockRequest.mockResolvedValue({ success: true, data: { data: { balance: '12.5' } } });

    await expect(lukasRewardService.getUserBalance()).resolves.toBe(12.5);
    expect(mockRequest).toHaveBeenCalledWith('lukas/balance', {
      skipEventSegment: true,
      params: { tokenSymbol: 'LUKAS' },
    });
  });

  it('surfaces API failures and rejects non-numeric balances', async () => {
    mockRequest.mockResolvedValueOnce({ success: false, error: 'Unauthorized' });
    await expect(lukasRewardService.getUserBalance('LUKAS')).rejects.toThrow('Unauthorized');

    mockRequest.mockResolvedValueOnce({ success: true, data: { data: { balance: 'unknown' } } });
    await expect(lukasRewardService.getUserBalance('LUKAS')).rejects.toThrow('The rewards balance is invalid');
  });
});
