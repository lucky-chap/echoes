export function dropUnresolvedItems<T extends { entityId?: string | null }>(items: T[]) {
  return items.filter((item): item is T & { entityId: string } => Boolean(item.entityId?.trim()))
}
