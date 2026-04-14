import Link from 'next/link'

export default function Home() {
  return (
    <main className="min-h-screen bg-bg flex items-center justify-center">
      <div className="text-center space-y-6">
        <div className="space-y-2">
          <h1 className="font-brand text-6xl font-black tracking-widest text-text-primary">SENTRY</h1>
          <p className="font-ui text-text-muted text-sm uppercase tracking-widest">Multi-Hazard Disaster Intelligence</p>
        </div>
        <div className="flex gap-3 justify-center flex-wrap">
          <Link
            href="/live"
            className="px-6 py-2.5 bg-threat-red text-white font-ui font-semibold text-sm rounded border border-threat-red/40 hover:bg-threat-red/90 transition-colors"
          >
            LIVE DASHBOARD
          </Link>
          <Link
            href="/analytics"
            className="px-6 py-2.5 bg-surface text-text-primary font-ui font-semibold text-sm rounded border border-border hover:bg-border/50 transition-colors"
          >
            ANALYTICS
          </Link>
          <Link
            href="/incidents"
            className="px-6 py-2.5 bg-surface text-text-primary font-ui font-semibold text-sm rounded border border-border hover:bg-border/50 transition-colors"
          >
            INCIDENTS
          </Link>
          <Link
            href="/settings"
            className="px-6 py-2.5 bg-surface text-text-primary font-ui font-semibold text-sm rounded border border-border hover:bg-border/50 transition-colors"
          >
            SETTINGS
          </Link>
        </div>
      </div>
    </main>
  )
}
