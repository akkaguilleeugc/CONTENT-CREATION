import { Check, Download, MoreVertical, PlusSquare, Share, Smartphone, X } from 'lucide-react';
import { useState } from 'react';
import { isAndroid, isIOS, isSafari, promptInstall, usePWA } from '@/lib/pwa';
import { toast } from '@/lib/ui';
import { BrandMark } from './brand';
import { Button } from './ui';

import { $t } from '@/lib/i18n';
const DISMISS_KEY = 'kroopy:install-hint-dismissed';

/** How to put KROOPY on the home screen, adapted to the current device. */
export function InstallGuide({ compact }: { compact?: boolean }) {
  const { installEvent, standalone, installed } = usePWA();

  if (standalone || installed)
    return (
      <div className="install install--done">
        <BrandMark size={40} />
        <div>
          <b>{$t("KROOPY is installed")}</b>
          <span>{$t("It opens full-screen from your home screen and works offline.")}</span>
        </div>
        <span className="badge badge--positive"><Check /> {$t("Installed")}</span>
      </div>
    );

  if (installEvent)
    return (
      <div className="install">
        <BrandMark size={40} />
        <div className="grow">
          <b>{$t("Install KROOPY")}</b>
          <span>{$t("Full-screen app with its own icon, offline access and shortcuts.")}</span>
        </div>
        <Button
          variant="lime"
          icon={<Download />}
          onClick={async () => {
            if (await promptInstall()) toast($t("Installing KROOPY…"));
          }}
        >
          {$t("Install")}
        </Button>
      </div>
    );

  if (isIOS)
    return (
      <div className="install install--steps">
        <div className="row gap-12">
          <BrandMark size={40} />
          <div>
            <b>{$t("Add KROOPY to your Home Screen")}</b>
            <span>{isSafari ? $t("Two taps in Safari:") : $t("Open this page in Safari (or use your browser’s share menu), then:")}</span>
          </div>
        </div>
        <ol className="install__list">
          <li>
            <span className="install__icon"><Share /></span>
            <span className="install__text">{$t("Tap")} <b>{$t("Share")}</b> {$t("in the toolbar")}</span>
          </li>
          <li>
            <span className="install__icon"><PlusSquare /></span>
            <span className="install__text">{$t("Choose")} <b>{$t("Add to Home Screen")}</b></span>
          </li>
          {!compact && (
            <li>
              <span className="install__icon"><Smartphone /></span>
              <span className="install__text">{$t("Tap")} <b>{$t("Add")}</b> {$t("— KROOPY appears with its icon")}</span>
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
          <b>{$t("Install KROOPY")}</b>
          <span>{isAndroid ? $t("From your browser menu:") : $t("From the address bar or browser menu:")}</span>
        </div>
      </div>
      <ol className="install__list">
        <li>
          <span className="install__icon">{isAndroid ? <MoreVertical /> : <Download />}</span>
          <span className="install__text">{isAndroid ? <>{$t("Open the")} <b>{$t("⋮ menu")}</b></> : <>{$t("Click the")} <b>{$t("install icon")}</b> {$t("in the address bar")}</>}</span>
        </li>
        <li>
          <span className="install__icon"><PlusSquare /></span>
          <span className="install__text">{$t("Choose")} <b>{isAndroid ? $t("Add to Home screen / Install app") : $t("Install KROOPY")}</b></span>
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
        aria-label={$t("Dismiss")}
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
