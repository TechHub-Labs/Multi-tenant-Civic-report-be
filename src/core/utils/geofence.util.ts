/**
 * Helper to check if a point is inside a single polygon (exterior boundary and holes)
 * Uses ray-casting algorithm.
 */
function isPointInSinglePolygon(point: [number, number], polygonCoords: number[][][]): boolean {
  const [lng, lat] = point;
  let inside = false;

  // The first ring is the exterior ring
  const exterior = polygonCoords[0];
  if (!exterior || exterior.length < 3) {
    return false;
  }

  for (let i = 0, j = exterior.length - 1; i < exterior.length; j = i++) {
    const xi = exterior[i][0], yi = exterior[i][1];
    const xj = exterior[j][0], yj = exterior[j][1];

    const intersect = ((yi > lat) !== (yj > lat))
        && (lng < (xj - xi) * (lat - yi) / (yj - yi) + xi);
    if (intersect) {
      inside = !inside;
    }
  }

  // If inside the exterior, verify it is NOT inside any interior holes (if any exist)
  if (inside && polygonCoords.length > 1) {
    for (let k = 1; k < polygonCoords.length; k++) {
      const hole = polygonCoords[k];
      let insideHole = false;
      for (let i = 0, j = hole.length - 1; i < hole.length; j = i++) {
        const xi = hole[i][0], yi = hole[i][1];
        const xj = hole[j][0], yj = hole[j][1];
        const intersect = ((yi > lat) !== (yj > lat))
            && (lng < (xj - xi) * (lat - yi) / (yj - yi) + xi);
        if (intersect) {
          insideHole = !insideHole;
        }
      }
      if (insideHole) {
        return false; // Point is inside a hole, so it's outside the polygon
      }
    }
  }

  return inside;
}

/**
 * Validates whether a [longitude, latitude] point lies inside a GeoJSON Polygon or MultiPolygon.
 */
export function isPointInGeofence(point: [number, number], geofence: any): boolean {
  if (!geofence || !geofence.type || !geofence.coordinates) {
    return false;
  }

  if (geofence.type === 'Polygon') {
    return isPointInSinglePolygon(point, geofence.coordinates);
  } else if (geofence.type === 'MultiPolygon') {
    // MultiPolygon coordinates is an array of Polygons
    for (const polygonCoords of geofence.coordinates) {
      if (isPointInSinglePolygon(point, polygonCoords)) {
        return true; // Point is inside at least one of the polygons
      }
    }
  }

  return false;
}
