import { Check, Download, MoreVertical, PlusSquare, Share, Smartphone, X } from 'lucide-react';
import { useState } from 'react';
import { isAndroid, isIOS, isSafari, promptInstall, usePWA } from '@/lib/pwa';
import { toast } from '@/lib/ui';
import { BrandMark } from './brand';
import { Button } from './ui';

const DISMISS_KEY = 'kroopy:install-hint-dismissed';

/** How to put KROOPY on the home screen, adapted to the current device. */
export function InstallGuide({ compact }: { compact?: boolean }) {
  const { installEvent, standalone, installed } = usePWA();

  if (standalone || installed)
    return (
      <div className="install install--done">
        <BrandMark size={40} />
        <div>
          <b>KROOPY is installed</b>
          <span>It opens full-screen from your home screen and works offline.</span>
        </div>
        <span className="badge badge--positive"><Check /> Installed</span>
      </div>
    );

  if (installEvent)
    return (
      <div className="install">
        <BrandMark size={40} />
        <div className="grow">
          <b>Install KROOPY</b>
          <span>Full-screen app with its own icon, offline access and shortcuts.</span>
        </div>
        <Button
          variant="lime"
          icon={<Download />}
          onClick={async () => {
            if (await promptInstall()) toast('Installing KROOPY…');
          }}
        >
          Install
        </Button>
      </div>
    );

  if (isIOS)
    return (
      <div className="install install--steps">
        <div className="row gap-12">
          <BrandMark size={40} />
          <div>
            <b>Add KROOPY to your Home Screen</b>
            <span>{isSafari ? 'Two taps in Safari:' : 'Open this page in Safari (or use your browser’s share menu), then:'}</span>
          </div>
        </div>
        <ol className="install__list">
          <li>
            <span className="install__icon"><Share /></span>
            <span className="install__text">Tap <b>Share</b> in the toolbar</span>
          </li>
          <li>
            <span className="install__icon"><PlusSquare /></span>
            <span className="install__text">Choose <b>Add to Home Screen</b></span>
          </li>
          {!compact && (
            <li>
              <span className="install__icon"><Smartphone /></span>
              <span className="install__text">Tap <b>Add</b> — KROOPY appears with its icon</span>
            </li>
          )}
        </ol>
      </div>
    );

  return (
    <div className="install install--steps">
      <div className="row gap-12">
        <BrandMark size={40} />
        <div>
          <b>Install KROOPY</b>
          <span>{isAndroid ? 'From your browser menu:' : 'From the address bar or browser menu:'}</span>
        </div>
      </div>
      <ol className="install__list">
        <li>
          <span className="install__icon">{isAndroid ? <MoreVertical /> : <Download />}</span>
          <span className="install__text">{isAndroid ? <>Open the <b>⋮ menu</b></> : <>Click the <b>install icon</b> in the address bar</>}</span>
        </li>
        <li>
          <span className="install__icon"><PlusSquare /></span>
          <span className="install__text">Choose <b>{isAndroid ? 'Add to Home screen / Install app' : 'Install KROOPY'}</b></span>
        </li>
      </ol>
    </div>
  );
}

/** One-time, dismissible hint shown on phones that are using KROOPY in the browser. */
export function InstallHint() {
  const standalone = usePWA((s) => s.standalone || s.installed);
  const [hidden, setHidden] = useState(() => {
    try {
      return localStorage.getItem(DISMISS_KEY) === '1';
    } catch {
      return false;
    }
  });
  if (standalone || hidden || !(isIOS || isAndroid)) return null;
  return (
    <div className="install-hint only-mobile">
      <InstallGuide compact />
      <button
        className="install-hint__x"
        aria-label="Dismiss"
        onClick={() => {
          setHidden(true);
          try {
            localStorage.setItem(DISMISS_KEY, '1');
          } catch {
            /* ignore */
          }
        }}
      >
        <X size={16} />
      </button>
    </div>
  );
}
