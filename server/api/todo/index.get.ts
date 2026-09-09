import type { TodoItem } from '~~/shared/types/resultats'

export default defineEventHandler(async (event): Promise<TodoItem[]> => {
  await requireUserSession(event)
  return listerTodo(useBase())
})
