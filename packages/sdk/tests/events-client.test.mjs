import assert from 'node:assert/strict';
import test from 'node:test';
import { EventsClient } from '../dist/events/client.js';
import { HttpTransport } from '../dist/transport.js';

test('events.issueTicket sends API-key authorization and idempotency', async () => {
  let request;
  const fetchMock = async (url, init) => {
    request = { url, init };
    return new Response(JSON.stringify({ id: 'tkt_123', status: 'active' }), { status: 201 });
  };
  const transport = new HttpTransport({
    baseUrl: 'https://api-dev.hashpass.tech/', appId: 'bsl-ticketing', fetch: fetchMock,
    timeoutMs: 1000, auth: { getAccessToken: async () => 'hp_test_example' },
  });
  const client = new EventsClient(transport);
  await client.issueTicket('colombia2026', {
    externalReference: 'order-123-ticket-1', ticketTypeId: 'general',
    attendee: { email: 'ada@example.com', fullName: 'Ada Example' },
    payment: { provider: 'wompi', transactionId: 'txn-123', reference: 'order-123', amountInCents: 8900000, currency: 'COP' },
  }, 'order-123-ticket-1');
  assert.equal(request.url, 'https://api-dev.hashpass.tech/api/v1/events/colombia2026/tickets');
  const headers = new Headers(request.init.headers);
  assert.equal(headers.get('authorization'), 'Bearer hp_test_example');
  assert.equal(headers.get('idempotency-key'), 'order-123-ticket-1');
});
