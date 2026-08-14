import type { HttpTransport } from "../transport.js";
import type { QrAnalytics, QrLinkInput, QrLinkResource } from "./types.js";
export class QrLinksClient {
  constructor(private readonly transport: HttpTransport) {}
  list(query?: Record<string, string>) { return this.transport.request<QrLinkResource[]>("/api/v1/qr-links", { query }); }
  get(id: string) { return this.transport.request<QrLinkResource>(`/api/v1/qr-links/${id}`); }
  create(input: QrLinkInput) { return this.transport.request<QrLinkResource>("/api/v1/qr-links", { method: "POST", body: input }); }
  update(id: string, input: Partial<QrLinkInput>) { return this.transport.request<QrLinkResource>(`/api/v1/qr-links/${id}`, { method: "PATCH", body: input }); }
  analytics(id: string) { return this.transport.request<QrAnalytics>(`/api/v1/qr-links/${id}/analytics`); }
}
