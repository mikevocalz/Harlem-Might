// NYC Neighborhood Tabulation Area boundaries for Harlem, fetched from NYC
// Open Data. Shared by the seed importers so places and events are bounded by
// exactly the same geography.

export const NTA_CODES = ['MN0902', 'MN1001', 'MN1002', 'MN1101', 'MN1102'];
export const NTA_URL = `https://data.cityofnewyork.us/resource/9nt8-h7nd.geojson?$where=${encodeURIComponent(`nta2020 in(${NTA_CODES.map((code) => `'${code}'`).join(',')})`)}&$limit=5`;

export type Point = [number, number];
export type Ring = Point[];
export type Boundary = { type: 'MultiPolygon' | 'Polygon'; coordinates: Ring[][] | Ring[] };
export type Nta = { geometry: Boundary; properties: { ntaname: string; nta2020: string } };

export function insideRing([x, y]: Point, ring: Ring): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]!;
    const [xj, yj] = ring[j]!;
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export function containingNta(point: Point, ntas: Nta[]): Nta | undefined {
  return ntas.find((nta) => {
    const polygons = nta.geometry.type === 'Polygon' ? [nta.geometry.coordinates as Ring[]] : nta.geometry.coordinates as Ring[][];
    return polygons.some(([shell, ...holes]) => shell && insideRing(point, shell) && !holes.some((hole) => insideRing(point, hole)));
  });
}

export function boundaryRings(ntas: Nta[]): Ring[] {
  return ntas.flatMap((nta) =>
    (nta.geometry.type === 'Polygon' ? [nta.geometry.coordinates as Ring[]] : nta.geometry.coordinates as Ring[][]).flatMap(
      (rings) => (rings[0] ? [rings[0]] : []),
    ),
  );
}

export function bboxOf(ntas: Nta[]): string {
  const points = boundaryRings(ntas).flat();
  return [
    Math.min(...points.map((p) => p[0])),
    Math.min(...points.map((p) => p[1])),
    Math.max(...points.map((p) => p[0])),
    Math.max(...points.map((p) => p[1])),
  ].join(',');
}

export async function fetchNtaBoundaries(): Promise<Nta[]> {
  const response = await fetch(NTA_URL, { signal: AbortSignal.timeout(90_000) });
  if (!response.ok) throw new Error(`NTA boundary request failed (${response.status}).`);
  const boundaries = (await response.json()) as { features: Nta[] };
  if (
    boundaries.features.length !== NTA_CODES.length ||
    boundaries.features.some((nta) => !NTA_CODES.includes(nta.properties.nta2020))
  ) {
    throw new Error('NYC Harlem NTA boundary response is incomplete.');
  }
  return boundaries.features;
}
