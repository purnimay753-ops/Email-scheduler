import { cn } from '../../lib/cn'

type Tab = { id: string; label: string }

export function Tabs({ tabs, value, onChange }: { tabs: Tab[]; value: string; onChange: (id: string) => void }) {
  return (
    <div className="inline-flex rounded-full bg-paper p-1">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          className={cn(
            'rounded-full px-4 py-2 text-sm font-semibold',
            value === tab.id ? 'bg-ink text-paper' : 'text-mute hover:text-ink',
          )}
          onClick={() => onChange(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}
