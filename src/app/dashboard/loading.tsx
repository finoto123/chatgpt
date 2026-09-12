export default function DashboardLoading() {
  return (
    <div className="p-6 space-y-6 animate-pulse">
      <div className="h-8 w-48 rounded-lg" style={{ background: 'var(--bg-surface)' }} />
      <div className="grid grid-cols-3 gap-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-28 rounded-xl" style={{ background: 'var(--bg-surface)' }} />
        ))}
      </div>
      <div className="h-64 rounded-xl" style={{ background: 'var(--bg-surface)' }} />
      <div className="grid grid-cols-2 gap-4">
        <div className="h-48 rounded-xl" style={{ background: 'var(--bg-surface)' }} />
        <div className="h-48 rounded-xl" style={{ background: 'var(--bg-surface)' }} />
      </div>
    </div>
  )
}
