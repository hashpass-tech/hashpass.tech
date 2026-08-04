export type TransactionStatus = 'pending' | 'confirmed' | 'failed';
export function confirmedTransaction(transactionId?: string | null): TransactionStatus { return transactionId && !transactionId.startsWith('pending:') ? 'confirmed' : 'pending'; }
