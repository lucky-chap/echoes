import { residents, type Point, type ResidentId } from '../profiles';
/** Physical square bounds, not a claimed location or a planned invitation. */
export function inSquare(point:Point){return point[0]>=214&&point[0]<=270&&point[1]>=194&&point[1]<=242;}
export function squareOccupants(positions:Point[]):ResidentId[]{return residents.filter((_,i)=>inSquare(positions[i])).map(r=>r.id);}
