import {
  destination,
  residents,
  type DestinationId,
  type Point,
} from "./profiles"
export type Route = Point[]
/** All transit uses the existing sandy lane network; the central square joins the south lane. */
export function routeToSquare(from: Point, index: number): Route {
  const end = residents[index].end
  if (from[1] > 250)
    return [from, [314, from[1]], [314, 266], [225, 266], [225, end[1]], end]
  if (from[1] < 202) return [from, [208, from[1]], [208, end[1]], end]
  return [from, end]
}
export function routeToDestination(
  from: Point,
  id: DestinationId,
  index: number
): Route {
  const base = destination(id).arrival
  const end: Point = [
    base[0] + (index - 1) * 12,
    base[1] + (index === 1 ? 4 : 0),
  ]
  if (id === "museum") return [from, [225, from[1]], [225, 268], end]
  // Go around the fountain on its western side, then follow the north lane.
  return [from, [208, from[1]], [208, 141], [end[0], 141], end]
}
export function routeLength(route: Route) {
  return route
    .slice(1)
    .reduce(
      (s, p, i) => s + Math.hypot(p[0] - route[i][0], p[1] - route[i][1]),
      0
    )
}
export function alongRoute(route: Route, progress: number): Point {
  let distance = routeLength(route) * Math.max(0, Math.min(1, progress))
  for (let i = 1; i < route.length; i++) {
    const a = route[i - 1],
      b = route[i],
      length = Math.hypot(b[0] - a[0], b[1] - a[1])
    if (length > 0 && distance < length) {
      const t = distance / length
      return [
        Math.round(a[0] + (b[0] - a[0]) * t),
        Math.round(a[1] + (b[1] - a[1]) * t),
      ]
    }
    distance -= length
  }
  return route.at(-1)!
}
