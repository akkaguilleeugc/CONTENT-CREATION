# Publishing KROOPY on the App Store

KROOPY is a web app (PWA). To ship it on the App Store it is wrapped in a native shell with
[Capacitor](https://capacitorjs.com). Everything Apple asks for is already in the app; this is the checklist.

## 1. Before you start

- An Apple Developer account (99 USD/year) and a Mac with Xcode.
- Cloud sync switched on (see README → *Cuenta y sincronización*), so people can use the same account on iPhone and computer.
- Your real details in `src/lib/legal.ts` (owner name, contact email, country) — they appear in the Privacy Policy, Terms, Cookies and Support pages.

## 2. Wrap the app (on the Mac)

```bash
npm install @capacitor/core @capacitor/cli @capacitor/ios
npm run build
npx cap add ios          # uses capacitor.config.json (app id app.kroopy.studio, name KROOPY)
npx cap sync ios
npx cap open ios         # opens Xcode
```

In Xcode: set the Team, the bundle id (`app.kroopy.studio` or your own), version and build number;
App Icon → drag `public/icons/icon-512.png` into the 1024 slot (export a 1024×1024 version without transparency);
Launch screen → background `#0B0F14` with the OO symbol.

Add to `Info.plist`: `ITSAppUsesNonExemptEncryption` = `NO` (the app only uses standard HTTPS).

Supabase → Authentication → URL configuration: add `capacitor://localhost` and `https://kroopy.netlify.app` to the
redirect URLs so confirmation and password-reset emails open the app.

## 3. App Store Connect — listing

| Field | Value |
|---|---|
| Name | KROOPY |
| Subtitle | Your creator OS |
| Category | Productivity (secondary: Business) |
| Age rating | 4+ |
| Privacy Policy URL | https://kroopy.netlify.app/privacy |
| Support URL | https://kroopy.netlify.app/support |
| Marketing URL | https://kroopy.netlify.app/landing/ |
| Languages | English, Spanish, Portuguese (Brazil) |

Screenshots: 6.9" (1320×2868) and 6.5" (1284×2778) iPhone — Overview, Content Studio, Calendar, Tasks, Trackers.

## 4. App Privacy ("nutrition label")

Tracking: **No** (no ads, no analytics, no third-party trackers, no data sold).

| Data type | Collected | Linked to the person | Used for tracking | Purpose |
|---|---|---|---|---|
| Contact info → Email address | Yes (only with an account) | Yes | No | App functionality (sign-in, sync) |
| User content → Other user content (ideas, videos, tasks, notes, files) | Yes (only with an account) | Yes | No | App functionality (sync between devices) |
| Identifiers → User ID | Yes (only with an account) | Yes | No | App functionality |

Not collected: location, contacts, health, financial info, browsing history, usage data, diagnostics.

## 5. Review requirements already covered

- **Account deletion in the app** (guideline 5.1.1(v)): Account & sync → Delete account removes the account, synced records and files.
- **Sign in with Apple** is *not* required: KROOPY only offers email + password, no third-party social login (guideline 4.8).
- **Privacy Policy** reachable inside the app (Settings → Privacy & legal, Account page, welcome screen) and at a public URL.
- **Minimum functionality** (4.2): works fully offline, native-style navigation, home-screen badge, shortcuts, notifications.
- **Data export** at any time: Settings → Data → Export backup.

## 6. Review notes (paste into App Store Connect)

> KROOPY is a private workspace for content creators. It works without an account; an optional account syncs
> data between the user's devices. Test account: (create one and paste the email + password here).
> Account deletion: Account & sync → Delete account.
