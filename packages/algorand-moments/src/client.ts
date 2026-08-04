export interface AlgorandClientPort { waitForConfirmation(txId: string): Promise<{ confirmedRound: number }>; }
