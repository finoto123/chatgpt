import { Skeleton } from '@/components/ui/skeleton'

export function ModuleLoading() {
  return (
    <div className="space-y-5 p-6" aria-label="Carregando conteúdo">
      <div className="flex items-center justify-between">
        <Skeleton className="h-9 w-52" />
        <Skeleton className="h-9 w-32" />
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
      <Skeleton className="h-80 w-full" />
    </div>
  )
}
