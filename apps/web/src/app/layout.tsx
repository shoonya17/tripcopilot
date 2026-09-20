import './globals.css';
import { ClerkProvider } from '@clerk/nextjs';
import { PwaRegistrar } from '@/components/PwaRegistrar';

export const metadata = { title: 'Trip Copilot', description: 'Your journey-aware travel agent.' };
// Pages render tenant-scoped canonical data and must not be statically built.
export const dynamic = 'force-dynamic';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const clerkConfigured = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);
  const content = <body><PwaRegistrar />{children}</body>;
  return clerkConfigured ? <ClerkProvider dynamic>{content}</ClerkProvider> : content;
}
