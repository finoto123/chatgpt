import { Header } from '@/components/layout/Header'
import { TasksClient } from '@/components/crm/TasksClient'
import { requirePermission } from '@/lib/auth/require-user'
import { getMyTasks } from '@/lib/supabase/queries/crm'

export default async function TasksPage(){const context=await requirePermission('crm.view');const tasks=await getMyTasks(context.user.id);return <div><Header title="Minhas tarefas"/><main className="p-6"><TasksClient tasks={tasks}/></main></div>}
