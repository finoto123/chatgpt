import { Skeleton } from '@/components/ui/skeleton'

export default function AuditLoading() {
  return <div className="space-y-4 p-6"><Skeleton className="h-9 w-52" /><Skeleton className="h-24 w-full" /><Skeleton className="h-96 w-full" /></div>
}
