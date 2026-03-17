import { signIn } from "@/app/actions/auth";

export default function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center px-6">
      {/* Logo */}
      <div className="mb-10 text-center">
        <h1
          className="text-4xl font-black tracking-[0.25em] uppercase text-zinc-900"
          style={{ letterSpacing: "0.3em" }}
        >
          WANIA
        </h1>
        <p className="mt-2 text-xs tracking-[0.2em] uppercase text-zinc-400">
          EMS · Ladeparksteuerung
        </p>
        {/* Accent line – Wania Energie yellow-green */}
        <div className="mx-auto mt-4 h-0.5 w-12 bg-[#C8D400]" />
      </div>

      {/* Card */}
      <div className="w-full max-w-sm">
        <form action={signIn} className="flex flex-col gap-4">
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-widest text-zinc-400 mb-1.5">
              E-Mail
            </label>
            <input
              name="email"
              type="email"
              required
              autoComplete="email"
              className="w-full border border-zinc-200 rounded-lg px-4 py-3 text-sm text-zinc-900 placeholder:text-zinc-300 focus:outline-none focus:ring-2 focus:ring-[#C8D400] focus:border-transparent transition"
              placeholder="name@wania.at"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-widest text-zinc-400 mb-1.5">
              Passwort
            </label>
            <input
              name="password"
              type="password"
              required
              autoComplete="current-password"
              className="w-full border border-zinc-200 rounded-lg px-4 py-3 text-sm text-zinc-900 placeholder:text-zinc-300 focus:outline-none focus:ring-2 focus:ring-[#C8D400] focus:border-transparent transition"
              placeholder="••••••••"
            />
          </div>

          <ErrorMessage searchParams={searchParams} />

          <button
            type="submit"
            className="mt-2 w-full py-3 rounded-lg text-sm font-semibold uppercase tracking-widest text-zinc-900 transition hover:opacity-90 active:scale-[0.98]"
            style={{ backgroundColor: "#C8D400" }}
          >
            Anmelden
          </button>
        </form>
      </div>
    </div>
  );
}

async function ErrorMessage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  if (!params.error) return null;
  return (
    <p className="text-xs text-red-500 text-center">
      E-Mail oder Passwort falsch.
    </p>
  );
}
