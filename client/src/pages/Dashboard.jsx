import { useAuth } from "../contexts/AuthContext";

export default function Dashboard() {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto flex min-h-screen max-w-4xl flex-col px-6 py-10">
        <header className="mb-10 flex items-center justify-between rounded-3xl border border-slate-700 bg-slate-900/90 px-6 py-5 shadow-xl shadow-slate-950/20">
          <div>
            <p className="text-sm uppercase tracking-[0.24em] text-sky-300">
              TrackerHub Dashboard
            </p>
            <h1 className="mt-2 text-3xl font-semibold text-white">
              Welcome, {user || "admin"}
            </h1>
          </div>
          <button
            onClick={logout}
            className="rounded-2xl bg-rose-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-rose-400"
          >
            Logout
          </button>
        </header>

        <main className="rounded-3xl border border-slate-700 bg-slate-900/90 p-8 shadow-xl shadow-slate-950/20">
          <p className="text-slate-300">
            You are now authenticated and can extend this dashboard with tracker
            state, MQTT controls, and live WebSocket updates.
          </p>
          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <div className="rounded-3xl border border-slate-700 bg-slate-950/70 p-6">
              <h2 className="text-xl font-semibold text-white">
                Ready for extension
              </h2>
              <p className="mt-3 text-slate-400">
                Use this page to show tracker summary, map status, and system
                health.
              </p>
            </div>
            <div className="rounded-3xl border border-slate-700 bg-slate-950/70 p-6">
              <h2 className="text-xl font-semibold text-white">
                Logout support
              </h2>
              <p className="mt-3 text-slate-400">
                Click Logout to clear the token and return to the login screen.
              </p>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
