# EMS Dashboard - Frontend für Elektriker

## Überblick

Next.js Dashboard für Elektrikerbetriebe zur Verwaltung von Kundenstandorten mit Ladepark-Steuerung. Zeigt Live-Telemetrie vom Raspberry Pi via Supabase.

## Tech-Stack

| Komponente | Details |
|---|---|
| Framework | Next.js 15.5.13 (App Router, Server Components) |
| UI | shadcn/ui (Nova Preset), Tailwind CSS v4 |
| Auth | Supabase SSR (`@supabase/ssr`) |
| Hosting | Vercel (`wania-ems.vercel.app`) |
| GitHub | `git@github.com:benjiwald/Wania-EMS.git` |

## Supabase-Verbindung

```
Projekt: grdpcosbrvxuzgqigdwc.supabase.co
URL env: NEXT_PUBLIC_SUPABASE_URL
Key env: NEXT_PUBLIC_SUPABASE_ANON_KEY
```

Lokale `.env.local` ist gitignored — Werte auch in Vercel Environment Variables hinterlegen.

## Architektur

```
src/
├── app/
│   ├── page.tsx              — Dashboard (Server Component, Supabase-Daten)
│   ├── layout.tsx            — Root Layout
│   ├── login/page.tsx        — Login-Seite
│   └── actions/auth.ts       — signIn / signOut Server Actions
├── lib/supabase/
│   ├── client.ts             — Browser Client (createBrowserClient)
│   └── server.ts             — Server Client (createServerClient + cookies)
└── middleware.ts             — Auth-Schutz: redirect → /login wenn kein User
```

## Auth-Flow

1. Jeder Request → `middleware.ts` prüft Supabase Session
2. Kein User → redirect `/login`
3. Login via `signIn` Server Action → `supabase.auth.signInWithPassword()`
4. Erfolg → redirect `/`
5. Dashboard lädt Daten als Server Component (RLS greift automatisch)

## CI / Design

- **Primärfarbe**: `#C8D400` (Wania Energie Gelbgrün)
- **Hintergrund**: `bg-zinc-50` (Seite), `bg-white` (Karten)
- **Schrift**: Zinc-Palette, `uppercase tracking-widest` für Labels
- **Akzentlinie**: 3px links auf Karten (Wania-typisch)
- **Logo**: `WANIA` in `font-black tracking-[0.2em] uppercase`

## Bekannte Probleme & Fixes

### Dropbox zerstört Symlinks in node_modules/.bin/
Dropbox ersetzt Symlinks mit Kopien → `require()` schlägt fehl.
```bash
cd node_modules/.bin
rm next && ln -s ../next/dist/bin/next next
rm tsc && ln -s ../typescript/bin/tsc tsc
```

### Lokaler Dev-Server starten
```bash
cd "/Users/benjamin/BW Dropbox/BW Team/Server/Workspace/2026/_Coding/20260317 Wania Ladeparksteuerung/EMS Dashboard"
npm run dev
# → http://localhost:3000
```

### Git Push
HTTPS schlägt fehl (keine Credentials). Immer SSH remote verwenden:
```
git@github.com:benjiwald/Wania-EMS.git
```

### Vercel Deployment
Nach Projekt-Löschen und Neuanlegen funktioniert es. Env Vars beim Erstellen direkt eintragen.

## Datenbank-Zuordnung

Demo-Tenant: `a0000000-0000-0000-0000-000000000001` (Elektro Wania GmbH)

User mit Tenant verknüpfen (Supabase SQL Editor):
```sql
INSERT INTO user_tenants (user_id, tenant_id, role)
VALUES ('<user-uuid>', 'a0000000-0000-0000-0000-000000000001', 'owner');
```

Teststandort Benjamin: `b0000000-0000-0000-0000-000000000002`
Pi Device: hardware_id `ems-b827eb9c5858`

## Fortschritt

### Abgeschlossen
- [x] Next.js 15 Projekt mit shadcn/ui (Nova Preset)
- [x] Supabase Auth (Login/Logout, Middleware-Schutz)
- [x] Dashboard-Seite mit echten Supabase-Daten
- [x] Wania CI (#C8D400, Zinc-Palette, Clean Design)
- [x] Login-Seite (Wania Wordmark, Akzentlinie)
- [x] Deployed auf Vercel (wania-ems.vercel.app)
- [x] Telemetrie-Daten sichtbar (Netz, PV, Speicher, Wallboxen)

### Offen
- [ ] Realtime-Updates (Supabase Realtime WebSocket)
- [ ] Standort-Detailseite (Telemetrie-Verlauf, Wallbox-Details)
- [ ] Wallbox-Steuerung (Ladestrom setzen, Freigabe/Sperre)
- [ ] Alerting-Seite
- [ ] Multi-Tenant: Elektriker-Verwaltung (User anlegen, Standorte zuweisen)
