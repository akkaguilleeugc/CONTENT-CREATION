import { Cloud, CloudOff, KeyRound, LogOut, Mail, RefreshCw, ShieldCheck, Smartphone, Laptop, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { BrandMark } from '@/components/brand';
import { Button, Field, Input, Segmented } from '@/components/ui';
import { CloudError } from '@/lib/cloud/backend';
import { $t } from '@/lib/i18n';
import { cloudConfigured, deleteAccount, sendPasswordReset, signIn, signOut, signUp, syncLabel, syncNow, updatePassword, useSync } from '@/lib/sync';
import { confirmDialog, toast } from '@/lib/ui';
import { cn } from '@/lib/utils';

function errorText(e: unknown) {
  const code = e instanceof CloudError ? e.code : 'unknown';
  switch (code) {
    case 'invalid_credentials':
      return $t('Wrong email or password.');
    case 'email_taken':
      return $t('There is already an account with this email. Sign in instead.');
    case 'weak_password':
      return $t('Use at least 8 characters for your password.');
    case 'not_confirmed':
      return $t('Confirm your email first — check your inbox for the link.');
    case 'rate_limited':
      return $t('Too many attempts. Wait a minute and try again.');
    case 'network':
      return $t('No connection. Check your internet and try again.');
    default:
      return e instanceof Error ? e.message : $t('Something went wrong. Try again.');
  }
}

function AuthCard() {
  const loc = useLocation();
  const [mode, setMode] = useState<'signin' | 'signup' | 'reset'>(new URLSearchParams(loc.search).get('mode') === 'signup' ? 'signup' : 'signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [sent, setSent] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr('');
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setErr($t('Enter a valid email.'));
    if (mode !== 'reset' && password.length < (mode === 'signup' ? 8 : 1)) return setErr(mode === 'signup' ? $t('Use at least 8 characters for your password.') : $t('Enter your password.'));
    setBusy(true);
    try {
      if (mode === 'signin') {
        await signIn(email, password);
        toast($t('Signed in'), { description: $t('Your data now syncs between your devices.') });
      } else if (mode === 'signup') {
        const res = await signUp(email, password);
        if (res.needsConfirmation) setSent($t('We sent a confirmation link to {email}. Open it on this device to finish.', { email: email.trim() }));
        else toast($t('Account created'), { description: $t('Your data now syncs between your devices.') });
      } else {
        await sendPasswordReset(email);
        setSent($t('If an account exists for {email}, a reset link is on its way.', { email: email.trim() }));
      }
    } catch (e2) {
      setErr(errorText(e2));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth panel">
      <div className="auth__head">
        <BrandMark size={44} />
        <div>
          <h2 className="display" style={{ fontSize: 26 }}>{mode === 'signup' ? $t('Create your account') : mode === 'reset' ? $t('Reset your password') : $t('Sign in to KROOPY')}</h2>
          <p className="subtle">{$t('One account, the same KROOPY on your laptop and your phone.')}</p>
        </div>
      </div>
      {mode !== 'reset' && (
        <Segmented
          label={$t('Account')}
          value={mode}
          onChange={(m) => {
            setMode(m as 'signin' | 'signup');
            setErr('');
            setSent('');
          }}
          options={[
            { value: 'signin', label: $t('Sign in') },
            { value: 'signup', label: $t('Create account') },
          ]}
        />
      )}
      {sent ? (
        <div className="auth__sent">
          <Mail />
          <p>{sent}</p>
          <Button variant="ghost" onClick={() => { setSent(''); setMode('signin'); }}>{$t('Back to sign in')}</Button>
        </div>
      ) : (
        <form className="auth__form" onSubmit={submit} noValidate>
          <Field label={$t('Email')} htmlFor="auth-email">
            <Input id="auth-email" type="email" autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={$t('you@example.com')} autoFocus />
          </Field>
          {mode !== 'reset' && (
            <Field label={$t('Password')} htmlFor="auth-pass" aside={mode === 'signin' ? <button type="button" className="link" onClick={() => { setMode('reset'); setErr(''); }}>{$t('Forgot password?')}</button> : undefined} hint={mode === 'signup' ? $t('At least 8 characters.') : undefined}>
              <Input id="auth-pass" type="password" autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} value={password} onChange={(e) => setPassword(e.target.value)} />
            </Field>
          )}
          {err && <p className="auth__err" role="alert">{err}</p>}
          <Button variant="primary" size="lg" type="submit" loading={busy} block>
            {mode === 'signup' ? $t('Create account') : mode === 'reset' ? $t('Send reset link') : $t('Sign in')}
          </Button>
          {mode === 'reset' && <button type="button" className="link" onClick={() => setMode('signin')}>{$t('Back to sign in')}</button>}
          {mode === 'signup' && (
            <p className="subtle auth__legal">
              {$t('By creating an account you accept the')} <Link to="/terms">{$t('Terms of Use')}</Link> {$t('and the')} <Link to="/privacy">{$t('Privacy Policy')}</Link>.
            </p>
          )}
        </form>
      )}
    </div>
  );
}

function RecoveryCard() {
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  return (
    <form
      className="auth panel"
      onSubmit={async (e) => {
        e.preventDefault();
        if (password.length < 8) return setErr($t('Use at least 8 characters for your password.'));
        setBusy(true);
        try {
          await updatePassword(password);
          toast($t('Password updated'));
        } catch (e2) {
          setErr(errorText(e2));
        } finally {
          setBusy(false);
        }
      }}
    >
      <div className="auth__head">
        <KeyRound />
        <h2 className="display" style={{ fontSize: 24 }}>{$t('Choose a new password')}</h2>
      </div>
      <Field label={$t('New password')} hint={$t('At least 8 characters.')}>
        <Input type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} autoFocus />
      </Field>
      {err && <p className="auth__err" role="alert">{err}</p>}
      <Button variant="primary" type="submit" loading={busy}>{$t('Save password')}</Button>
    </form>
  );
}

function SignedIn() {
  const { user, status, pending, lastSyncAt, live, error } = useSync();
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 15000);
    return () => clearInterval(t);
  }, []);
  const ago = lastSyncAt ? Math.max(0, Math.round((now - lastSyncAt) / 60000)) : null;
  return (
    <>
      <div className="panel sync-card">
        <div className={cn('sync-card__icon', `sync-card__icon--${status}`)}>{status === 'offline' ? <CloudOff /> : <Cloud />}</div>
        <div className="grow" style={{ minWidth: 0 }}>
          <div className="display" style={{ fontSize: 22 }}>{syncLabel(status, pending)}</div>
          <div className="subtle truncate">{user?.email}</div>
          <div className="subtle" style={{ fontSize: 12.5, marginTop: 4 }}>
            {ago === null ? '' : ago === 0 ? $t('Last sync: just now') : $t('Last sync: {n} min ago', { n: ago })}
            {live ? ` · ${$t('Live')}` : ''}
          </div>
          {error && <div className="auth__err" style={{ marginTop: 6 }}>{error}</div>}
        </div>
        <Button icon={<RefreshCw />} onClick={() => void syncNow()} loading={status === 'syncing'}>{$t('Sync now')}</Button>
      </div>
      <div className="sync-how panel">
        <div className="row gap-12"><Laptop /><Smartphone /></div>
        <p>{$t('Sign in with the same account on your laptop and your phone. Complete a task on one and it shows as done on the other in seconds — even if one of them was offline, it catches up as soon as it reconnects.')}</p>
      </div>
      <div className="panel account-actions">
        <Button
          icon={<LogOut />}
          onClick={async () => {
            const ok = await confirmDialog({
              title: $t('Sign out?'),
              description: pending ? $t('{n} changes haven’t reached the cloud yet. They stay on this device and sync when you sign in again.', { n: pending }) : $t('Your data stays on this device. Sign in again any time to keep syncing.'),
              confirmLabel: $t('Sign out'),
              tone: 'default',
            });
            if (ok) {
              await signOut();
              toast($t('Signed out'));
            }
          }}
        >
          {$t('Sign out')}
        </Button>
        <Button
          variant="danger"
          icon={<Trash2 />}
          onClick={async () => {
            const ok = await confirmDialog({
              title: $t('Delete your account?'),
              description: $t('Your account and everything stored in the cloud (records and files) are permanently deleted. This cannot be undone.'),
              confirmLabel: $t('Delete account'),
            });
            if (!ok) return;
            const wipe = await confirmDialog({
              title: $t('Also erase this device?'),
              description: $t('Choose “Erase” to remove the data stored on this device too, or “Keep” to keep a local copy.'),
              confirmLabel: $t('Erase'),
              cancelLabel: $t('Keep'),
            });
            try {
              await deleteAccount(wipe);
              toast($t('Account deleted'));
            } catch (e) {
              toast($t('Could not delete the account'), { tone: 'error', description: errorText(e) });
            }
          }}
        >
          {$t('Delete account')}
        </Button>
      </div>
    </>
  );
}

export default function AccountPage() {
  const { status, user, recovery } = useSync();
  return (
    <div className="page account">
      <header className="page-head">
        <div>
          <h1 className="page-title display">{$t('Account & sync')}<span className="stop" aria-hidden /></h1>
          <p className="page-sub">{$t('Use KROOPY on your laptop and your phone with the same data.')}</p>
        </div>
      </header>
      <div className="account__grid">
        <div className="col gap-16">
          {recovery ? <RecoveryCard /> : status === 'unconfigured' ? (
            <div className="panel sync-card">
              <div className="sync-card__icon"><CloudOff /></div>
              <div>
                <div className="display" style={{ fontSize: 22 }}>{$t('Cloud sync isn’t switched on yet')}</div>
                <p className="subtle">{$t('KROOPY keeps working on this device. Sync turns on once the KROOPY cloud is connected to this site.')}</p>
              </div>
            </div>
          ) : status === 'loading' ? null : user ? <SignedIn /> : <AuthCard />}
        </div>
        <aside className="col gap-16">
          <div className="panel account-perks">
            <div className="row gap-8"><ShieldCheck /> <b>{$t('Private by design')}</b></div>
            <ul>
              <li>{$t('Your data is only visible to you — every row is locked to your account.')}</li>
              <li>{$t('Works offline: changes wait on the device and sync later.')}</li>
              <li>{$t('No ads, no tracking, no selling of data.')}</li>
              <li>{$t('Export everything or delete your account at any time.')}</li>
            </ul>
            <div className="row gap-12 wrap" style={{ fontSize: 13 }}>
              <Link className="link" to="/privacy">{$t('Privacy Policy')}</Link>
              <Link className="link" to="/terms">{$t('Terms of Use')}</Link>
              <Link className="link" to="/cookies">{$t('Cookies & storage')}</Link>
            </div>
          </div>
          {!cloudConfigured && null}
        </aside>
      </div>
    </div>
  );
}
