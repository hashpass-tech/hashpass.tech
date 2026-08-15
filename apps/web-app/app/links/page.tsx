'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import QRCode from 'react-qr-code';
import { BarChart3, Download, MoreHorizontal, Plus, QrCode, Search, ShieldCheck } from 'lucide-react';
import type { QrLinkInput, QrLinkResource } from '@hashpass/sdk';
import styles from './links.module.css';

const API_ORIGIN = process.env.NEXT_PUBLIC_HASHPASS_LINKS_API_URL || 'https://links-api.hashpass.tech';

type LoadState = 'loading' | 'ready' | 'unauthorized' | 'error';

function accessToken() {
  return typeof window === 'undefined' ? null : window.localStorage.getItem('hashpass_access_token');
}

async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const token = accessToken();
  const response = await fetch(`${API_ORIGIN}${path}`, {
    ...init,
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}), ...init?.headers },
  });
  if (response.status === 401) throw new Error('unauthorized');
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.message || 'Request failed');
  }
  return response.json();
}

export default function LinksDashboard() {
  const [links, setLinks] = useState<QrLinkResource[]>([]);
  const [state, setState] = useState<LoadState>('loading');
  const [message, setMessage] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [sort, setSort] = useState('newest');
  const [createOpen, setCreateOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setState('loading');
    try {
      const query = new URLSearchParams();
      if (search) query.set('search', search);
      if (status) query.set('status', status);
      const data = await apiRequest<QrLinkResource[]>(`/api/v1/qr-links?${query}`);
      setLinks(data);
      setState('ready');
    } catch (error) {
      setState(error instanceof Error && error.message === 'unauthorized' ? 'unauthorized' : 'error');
      setMessage(error instanceof Error ? error.message : 'Unable to load QR links');
    }
  }, [search, status]);

  useEffect(() => {
    const timer = window.setTimeout(load, 200);
    return () => window.clearTimeout(timer);
  }, [load]);

  const rows = useMemo(() => [...links].sort((a, b) => {
    if (sort === 'scans') return b.scanCount - a.scanCount;
    if (sort === 'lastScan') return (b.lastScanAt || '').localeCompare(a.lastScanAt || '');
    return b.createdAt.localeCompare(a.createdAt);
  }), [links, sort]);

  const totalScans = links.reduce((total, link) => total + link.scanCount, 0);
  const activeLinks = links.filter(link => link.status === 'active').length;

  async function createLink(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setMessage('');
    const form = new FormData(event.currentTarget);
    const input: QrLinkInput = {
      name: String(form.get('name')),
      destinationUrl: String(form.get('destinationUrl')),
      description: String(form.get('description') || '') || undefined,
    };
    try {
      const created = await apiRequest<QrLinkResource>('/api/v1/qr-links', { method: 'POST', body: JSON.stringify(input) });
      setLinks(current => [created, ...current]);
      setCreateOpen(false);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to create QR link');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className={styles.shell}>
      <aside>
        <div className={styles.brand}><span>H</span> HashPass</div>
        <nav><a className={styles.active}><QrCode />QR links</a><a><BarChart3 />Analytics</a><a><ShieldCheck />Audit trail</a></nav>
        <div className={styles.secure}>Protected by HashPass<br /><small>Privacy-conscious analytics</small></div>
      </aside>
      <section className={styles.main}>
        <header><div><p>HASHPASS LINKS</p><h1>Dynamic QR</h1></div><button className={styles.primary} onClick={() => setCreateOpen(true)}><Plus />Create QR link</button></header>
        <div className={styles.metrics}>
          <article><span>Total scans</span><strong>{totalScans.toLocaleString()}</strong><small>Across your QR links</small></article>
          <article><span>QR links</span><strong>{links.length}</strong><small>Your account</small></article>
          <article><span>Active links</span><strong>{activeLinks}</strong><small>{links.length - activeLinks} inactive</small></article>
        </div>
        <div className={styles.toolbar}>
          <label><Search /><input aria-label="Search QR links" placeholder="Search QR links" value={search} onChange={event => setSearch(event.target.value)} /></label>
          <select aria-label="Status" value={status} onChange={event => setStatus(event.target.value)}><option value="">All statuses</option><option value="active">Active</option><option value="paused">Paused</option><option value="archived">Archived</option></select>
          <select aria-label="Sort" value={sort} onChange={event => setSort(event.target.value)}><option value="newest">Newest first</option><option value="scans">Most scans</option><option value="lastScan">Last scan</option></select>
        </div>
        {state === 'loading' && <div className={styles.state}>Loading your QR links…</div>}
        {state === 'unauthorized' && <div className={styles.state}><h2>Sign in required</h2><p>Sign in with HashPass to view and manage your QR links.</p></div>}
        {state === 'error' && <div className={styles.state}><h2>Unable to load QR links</h2><p>{message}</p><button onClick={load}>Try again</button></div>}
        {state === 'ready' && rows.length === 0 && <div className={styles.state}><h2>No QR links yet</h2><p>Create your first dynamic QR link to get started.</p></div>}
        {state === 'ready' && rows.length > 0 && <div className={styles.table}>
          <div className={`${styles.tr} ${styles.head}`}><span>QR link</span><span>Destination</span><span>Status</span><span>Scans</span><span>Last scan</span><span /></div>
          {rows.map(row => <div className={styles.tr} key={row.id}>
            <span className={styles.identity}><i><QRCode value={row.shortUrl} size={38} /></i><b>{row.name}<small>{row.shortUrl.replace('https://', '')}</small></b></span>
            <span>{new URL(row.destinationUrl).host}</span><span><em className={row.status === 'active' ? styles.on : styles.paused}>{row.status}</em></span>
            <strong>{row.scanCount.toLocaleString()}</strong><span>{row.lastScanAt ? new Date(row.lastScanAt).toLocaleString() : 'Never'}</span><button className={styles.icon} aria-label={`Actions for ${row.name}`}><MoreHorizontal /></button>
          </div>)}
        </div>}
      </section>
      {createOpen && <div className={styles.overlay} onMouseDown={() => setCreateOpen(false)}><form className={styles.modal} onMouseDown={event => event.stopPropagation()} onSubmit={createLink}>
        <p>NEW DYNAMIC QR</p><h2>Create QR link</h2>
        <label>Name<input name="name" required maxLength={120} placeholder="e.g. Member welcome pass" /></label>
        <label>Destination URL<input name="destinationUrl" required type="url" placeholder="https://" /></label>
        <label>Internal description<input name="description" maxLength={1000} placeholder="Optional internal note" /></label>
        {message && <div role="alert">{message}</div>}
        <div className={styles.preview}><QRCode value="https://hashpass.link/q/preview" size={118} /><div><b>Safe by design</b><small>The destination is never embedded in your QR. Printed codes keep working after edits.</small></div></div>
        <footer><button type="button" onClick={() => setCreateOpen(false)}>Cancel</button><button className={styles.primary} disabled={submitting}><Download />{submitting ? 'Creating…' : 'Create link'}</button></footer>
      </form></div>}
    </main>
  );
}
