import {
  residents,
  destination,
  type DestinationId,
  type Point,
  type ResidentId,
} from "../profiles"
export function atVenue(point: Point, venue: DestinationId | "square") {
  if (venue === "square") return inSquare(point)
  const arrival = destination(venue).arrival
  return (
    Math.abs(point[0] - arrival[0]) <= 14 &&
    Math.abs(point[1] - arrival[1]) <= 6
  )
}
/** Physical square bounds, not a claimed location or a planned invitation. */
export function inSquare(point: Point) {
  return (
    point[0] >= 214 && point[0] <= 270 && point[1] >= 194 && point[1] <= 242
  )
}
export function squareOccupants(positions: Point[]): ResidentId[] {
  return residents.filter((_, i) => inSquare(positions[i])).map((r) => r.id)
}
