import { AccountView } from './account-view';

/**
 * /account — the signed-in user's profile and submissions. Session-dependent
 * content is loaded client-side in AccountView; this wrapper just provides the
 * page shell and metadata.
 */
export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Account',
};

export default function AccountPage() {
  return (
    <main className="container" style={{ maxWidth: 720, paddingTop: 48, paddingBottom: 80 }}>
      <h1 style={{ marginBottom: 32 }}>Account</h1>
      <AccountView />
    </main>
  );
}
