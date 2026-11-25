
export function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex min-h-[420px] w-full flex-col items-center justify-center px-6 py-16 text-center">
      <p className="font-sans text-2xl font-semibold tracking-tight text-white">
        {title}
      </p>

      <p className="mx-auto mt-2 max-w-md text-base font-medium text-gray-300">
        {body}
      </p>
    </div>
  )
}
