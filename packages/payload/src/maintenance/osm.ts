import { execFileSync } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { Point, Ring } from './nta.ts';

// Local OSM PBF tooling shared by the place importer and the tag enrichment
// pass. Overpass rate-limited this project to 504s, so everything reads a
// downloaded Geofabrik extract through osmium.

export type OsmFeature = {
  id?: string;
  properties: Record<string, string>;
  geometry: { type: 'Point' | 'LineString' | 'Polygon' | 'MultiPolygon'; coordinates: unknown };
};

export function representativePoint(geometry: OsmFeature['geometry']): Point | undefined {
  if (geometry.type === 'Point') return geometry.coordinates as Point;
  if (geometry.type === 'LineString') {
    const points = geometry.coordinates as Point[];
    return points[Math.floor(points.length / 2)];
  }
  const polygons = geometry.type === 'Polygon' ? [geometry.coordinates as Ring[]] : geometry.coordinates as Ring[][];
  let largest: { area: number; point: Point } | undefined;
  for (const [ring] of polygons) {
    if (!ring || ring.length < 4) continue;
    let twiceArea = 0;
    let x = 0;
    let y = 0;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i]!;
      const [xj, yj] = ring[j]!;
      const cross = xj * yi - xi * yj;
      twiceArea += cross;
      x += (xj + xi) * cross;
      y += (yj + yi) * cross;
    }
    if (twiceArea === 0) continue;
    const area = Math.abs(twiceArea);
    if (!largest || area > largest.area) largest = { area, point: [x / (3 * twiceArea), y / (3 * twiceArea)] };
  }
  return largest?.point;
}

export async function readOsmFeatures(pbfPath: string, bbox: string): Promise<OsmFeature[]> {
  const tempDir = await mkdtemp(path.join(tmpdir(), 'harlem-might-osm-'));
  const clipped = path.join(tempDir, 'harlem.osm.pbf');
  const filtered = path.join(tempDir, 'named-places.osm.pbf');
  try {
    execFileSync('osmium', ['extract', '--bbox', bbox, '--strategy=complete_ways', '--no-progress', pbfPath, '--output', clipped, '--overwrite'], { stdio: 'ignore' });
    execFileSync('osmium', ['tags-filter', '--no-progress', clipped, 'nwr/amenity', 'nwr/tourism', 'nwr/historic', 'nwr/leisure', 'nwr/shop', 'nwr/craft', 'nwr/office', '--output', filtered, '--overwrite'], { stdio: 'ignore' });
    const info = execFileSync('osmium', ['fileinfo', '-e', filtered], { encoding: 'utf8' });
    console.info(info.split('\n').filter((line) => line.includes('Number of nodes:') || line.includes('Number of ways:') || line.includes('Number of relations:')).join('; '));
    const output = execFileSync('osmium', ['export', '--no-progress', '--add-unique-id=type_id', '--attributes=type,id', '--output-format=geojsonseq', '--output=-', filtered], {
      encoding: 'utf8', maxBuffer: 512 * 1024 * 1024, stdio: ['ignore', 'pipe', 'inherit'],
    });
    const features = output.split(/\r?\n/).flatMap((line) => {
      const value = line.trim().replace(/^\u001e/, '');
      return value ? [JSON.parse(value) as OsmFeature] : [];
    });
    if (!features.length) throw new Error(`osmium produced no GeoJSON features (${output.length} characters).`);
    return features;
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}
