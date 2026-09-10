import { Header } from '@/components/layout/Header'
import { Skeleton } from '@/components/ui/skeleton'
export default function QuotesLoading(){return <div><Header title="Orçamentos"/><main className="crm-shell"><Skeleton className="h-11 w-96 max-w-full"/><Skeleton className="h-24 w-full"/><Skeleton className="h-16 w-full"/><Skeleton className="h-96 w-full"/></main></div>}
