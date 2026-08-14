import { createHmac } from 'node:crypto';

export function anonymizeVisitor(ip: string, secret: string, now = new Date()): string {
  if (secret.length < 32) throw new Error('QR analytics secret must be at least 32 characters');
  const rotation = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
  return createHmac('sha256', secret).update(`${rotation}:${ip}`).digest('base64url').slice(0, 22);
}

export function classifyAgent(agent = ''): { bot: boolean; device: 'mobile'|'tablet'|'desktop'|'unknown' } {
  const bot = /bot|crawler|spider|preview|headless|facebookexternalhit|slurp/i.test(agent);
  const device = /ipad|tablet/i.test(agent) ? 'tablet' : /mobile|iphone|android/i.test(agent) ? 'mobile' : agent ? 'desktop' : 'unknown';
  return { bot, device };
}
