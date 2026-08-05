import { createHashpass, type HashpassSdkOptions, type SupportTicket } from "@hashpass/sdk";

export interface SecureSupportSessionStore {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  deleteItem(key: string): Promise<void>;
}

export interface NativeSupportControllerOptions extends HashpassSdkOptions {
  secureStore: SecureSupportSessionStore;
  pollIntervalMs?: number;
}

export class NativeSupportController {
  readonly sdk;
  constructor(readonly options: NativeSupportControllerOptions) {
    this.sdk = createHashpass(options);
  }
  createTicket(input: { subject: string; message: string }): Promise<SupportTicket> {
    return this.sdk.support.createTicket({ ...input, context: { platform: "android" } });
  }
  async rememberActiveTicket(ticketId: string): Promise<void> {
    await this.options.secureStore.setItem("hashpass.support.activeTicketId", ticketId);
  }
  getActiveTicketId(): Promise<string | null> {
    return this.options.secureStore.getItem("hashpass.support.activeTicketId");
  }
  clearActiveTicket(): Promise<void> {
    return this.options.secureStore.deleteItem("hashpass.support.activeTicketId");
  }
}
