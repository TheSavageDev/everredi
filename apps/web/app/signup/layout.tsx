import { redirect } from 'next/navigation';
import { getFlags } from '@/lib/flags';

export default async function SignupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const flags = await getFlags();
  if (!flags.signupEnabled) {
    redirect('/login');
  }
  return children;
}
