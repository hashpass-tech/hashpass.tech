import { createHashpass, type SupportIdentity, type SupportTicket, type WidgetConfiguration } from "@hashpass/sdk";

export type HashpassSupportEvent = "ready" | "opened" | "closed" | "ticket.created" | "message.created" | "unread.changed" | "handoff.requested" | "error";
export interface HashpassSupportConfig { appId: string; locale?: "en" | "es" | string; position?: "bottom-right" | "bottom-left" | "top-right" | "top-left"; greeting?: string; apiBaseUrl?: string; theme?: { color?: string; logoUrl?: string; launcherIconUrl?: string } }

type Listener = (payload?: unknown) => void;
const labels = { en: { open: "Open support", close: "Close support", title: "HashPass Support", start: "Start a conversation", message: "How can we help?" }, es: { open: "Abrir soporte", close: "Cerrar soporte", title: "Soporte de HashPass", start: "Iniciar una conversación", message: "¿Cómo podemos ayudarte?" } } as const;

export class HashpassSupportElement extends HTMLElement {
  static observedAttributes = ["app-id", "locale", "position", "greeting", "api-base-url"];
  #listeners = new Map<HashpassSupportEvent, Set<Listener>>();
  #open = false;
  #ticket?: SupportTicket;
  #root = this.attachShadow({ mode: "open" });

  connectedCallback(): void { this.render(); this.emit("ready"); }
  attributeChangedCallback(): void { this.render(); }
  open(): void { this.#open = true; this.render(); this.emit("opened"); }
  close(): void { this.#open = false; this.render(); this.emit("closed"); }
  toggle(): void { this.#open ? this.close() : this.open(); }
  identify(identity: SupportIdentity): Promise<unknown> { return this.client().support.identifySupportVisitor(identity); }
  reset(): void { this.#ticket = undefined; this.render(); }
  async createTicket(input: { subject: string; message: string }): Promise<SupportTicket> { const ticket = await this.client().support.createTicket({ ...input, context: { platform: "web", url: globalThis.location?.href } }); this.#ticket = ticket; this.emit("ticket.created", ticket); this.render(); return ticket; }
  on(event: HashpassSupportEvent, callback: Listener): void { const set = this.#listeners.get(event) ?? new Set(); set.add(callback); this.#listeners.set(event, set); }
  off(event: HashpassSupportEvent, callback: Listener): void { this.#listeners.get(event)?.delete(callback); }

  private config(): HashpassSupportConfig { const appId = this.getAttribute("app-id") || document.currentScript?.getAttribute("data-hashpass-app-id") || ""; if (!appId) this.emit("error", new Error("app-id is required")); return { appId, locale: this.getAttribute("locale") ?? "en", position: (this.getAttribute("position") as HashpassSupportConfig["position"]) ?? "bottom-right", greeting: this.getAttribute("greeting") ?? undefined, apiBaseUrl: this.getAttribute("api-base-url") ?? undefined }; }
  private client() { const c = this.config(); return createHashpass({ appId: c.appId, baseUrl: c.apiBaseUrl }); }
  private emit(event: HashpassSupportEvent, payload?: unknown): void { this.#listeners.get(event)?.forEach((cb) => cb(payload)); this.dispatchEvent(new CustomEvent(event, { detail: payload })); }
  private render(): void { const c = this.config(); const l = labels[c.locale === "es" ? "es" : "en"]; const color = c.theme?.color ?? "#06b6d4"; this.#root.innerHTML = `<style>:host{position:fixed;z-index:2147483000;${c.position?.includes("top")?"top":"bottom"}:20px;${c.position?.includes("left")?"left":"right"}:20px;font-family:Inter,system-ui,sans-serif}.launcher,.send{min-width:44px;min-height:44px;border:0;border-radius:999px;background:${color};color:#001018;font-weight:700;box-shadow:0 10px 30px #0003}.panel{width:min(380px,calc(100vw - 32px));height:min(560px,calc(100vh - 96px));background:#fff;color:#111827;border:1px solid #d1d5db;border-radius:20px;box-shadow:0 24px 80px #0004;display:flex;flex-direction:column;overflow:hidden}.head{background:#07141f;color:#fff;padding:16px;display:flex;justify-content:space-between;align-items:center}.body{padding:16px;flex:1;overflow:auto}.sr{position:absolute;left:-9999px}.focus:focus,.launcher:focus,.send:focus,textarea:focus{outline:3px solid #facc15;outline-offset:2px}textarea{width:100%;min-height:88px}</style><div aria-live="polite" class="sr">${this.#ticket ? "Ticket updated" : ""}</div>${this.#open ? `<section class="panel" role="dialog" aria-modal="false" aria-label="${l.title}"><div class="head"><strong>${l.title}</strong><button class="focus" id="close" aria-label="${l.close}">×</button></div><div class="body"><p>${c.greeting ?? l.message}</p><p>${this.#ticket ? `#${this.#ticket.id} — ${this.#ticket.status}` : l.start}</p><textarea id="msg" aria-label="${l.message}"></textarea><button class="send" id="send">${l.start}</button><p><small>Privacy notice: do not include secrets or payment details.</small></p></div></section>` : `<button class="launcher" id="open" aria-label="${l.open}">?</button>`}`; this.#root.getElementById("open")?.addEventListener("click",()=>this.open()); this.#root.getElementById("close")?.addEventListener("click",()=>this.close()); this.#root.getElementById("send")?.addEventListener("click",()=>{ const body=(this.#root.getElementById("msg") as HTMLTextAreaElement)?.value?.trim(); if(body) void this.createTicket({subject:body.slice(0,80),message:body}).catch(e=>this.emit("error",e)); }); }
}

export function defineHashpassSupport(tag = "hashpass-support"): void { if (!customElements.get(tag)) customElements.define(tag, HashpassSupportElement); }
defineHashpassSupport();

declare global { interface Window { HashpassSupport?: HashpassSupportElement } }
