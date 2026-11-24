export function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="px-6 py-16 text-center">
      <p className="font-serif text-3xl">{title}</p>
      <p className="mx-auto mt-2 max-w-md text-sm text-mute">{body}</p>
    </div>
  )
}
