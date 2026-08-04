BEGIN;
CREATE TABLE public.x402_service_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), service_type text NOT NULL,
  event_id text REFERENCES public.events(id) ON DELETE SET NULL, request_hash text NOT NULL,
  idempotency_key text, payer_address text, receiving_address text NOT NULL,
  network text NOT NULL, asset_id text NOT NULL, amount numeric(20,6) NOT NULL CHECK(amount>=0),
  facilitator text NOT NULL, payment_transaction_id text, payment_status text NOT NULL,
  result_status text NOT NULL, pass_reference text, qr_reference text, checkpoint_id text,
  proof_digest text, response_json jsonb, created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT x402_service_requests_transaction_unique UNIQUE(payment_transaction_id),
  CONSTRAINT x402_service_requests_idempotency_unique UNIQUE(idempotency_key)
);
CREATE INDEX x402_service_requests_event_idx ON public.x402_service_requests(event_id);
CREATE INDEX x402_service_requests_service_idx ON public.x402_service_requests(service_type);
CREATE INDEX x402_service_requests_payer_idx ON public.x402_service_requests(payer_address);
CREATE INDEX x402_service_requests_created_idx ON public.x402_service_requests(created_at DESC);
CREATE INDEX x402_service_requests_transaction_idx ON public.x402_service_requests(payment_transaction_id);
ALTER TABLE public.x402_service_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.x402_service_requests FROM anon,authenticated;
COMMENT ON TABLE public.x402_service_requests IS 'Privacy-minimized audit records for paid x402 event services. Never store payment signatures or raw QR tokens.';
COMMIT;
