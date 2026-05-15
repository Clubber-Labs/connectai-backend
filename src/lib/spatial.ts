import { Prisma } from '@prisma/client'
import { prisma } from './prisma'

export type Bbox = {
  north: number
  south: number
  east: number
  west: number
}

export type LatLng = { latitude: number; longitude: number }

export async function findEventIdsInBbox(bbox: Bbox): Promise<string[]> {
  const rows = await prisma.$queryRaw<{ id: string }[]>(
    Prisma.sql`
      SELECT id FROM events
      WHERE location && ST_MakeEnvelope(${bbox.west}, ${bbox.south}, ${bbox.east}, ${bbox.north}, 4326)::geography
    `,
  )
  return rows.map((r) => r.id)
}

export async function findEventIdsWithinRadius(
  center: LatLng,
  radiusKm: number,
): Promise<string[]> {
  const radiusMeters = radiusKm * 1000
  const rows = await prisma.$queryRaw<{ id: string }[]>(
    Prisma.sql`
      SELECT id FROM events
      WHERE ST_DWithin(
        location,
        ST_SetSRID(ST_MakePoint(${center.longitude}, ${center.latitude}), 4326)::geography,
        ${radiusMeters}
      )
    `,
  )
  return rows.map((r) => r.id)
}

export async function findEventIdsByDistance(
  center: LatLng,
  limit: number,
): Promise<string[]> {
  const rows = await prisma.$queryRaw<{ id: string }[]>(
    Prisma.sql`
      SELECT id FROM events
      ORDER BY location <-> ST_SetSRID(ST_MakePoint(${center.longitude}, ${center.latitude}), 4326)::geography
      LIMIT ${limit}
    `,
  )
  return rows.map((r) => r.id)
}
