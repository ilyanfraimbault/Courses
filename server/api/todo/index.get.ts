import type { TodoItem } from '~~/shared/types/resultats'

export default defineEventHandler(async (event): Promise<TodoItem[]> => {
  const uid = await idUtilisateur(event)
  return listerTodo(useBase(), uid)
})
