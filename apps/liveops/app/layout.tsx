import type { Metadata } from 'next';
import './styles.css';

export const metadata: Metadata = {
  title: 'HASHPASS LiveOps',
  description: 'Realtime event operations. Before problems become incidents.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
