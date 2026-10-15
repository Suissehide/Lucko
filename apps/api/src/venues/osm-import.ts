import { loadEnv } from '../config/env'
import type { PrismaClient } from '../generated/prisma/client'
import {
  isSamePlace,
  OSM_ZONES,
  type OsmElement,
  type OsmZone,
  osmIdOf,
  osmZoneQuery,
  slugify,
  toVenue,
} from './osm.rules'

/**
 * Requête Overpass sur chaque serveur d'`urls` jusqu'au premier qui répond. Overpass répond parfois 200
 * avec une page d'erreur HTML : tout ce qui n'est pas du JSON propre compte comme un échec.
 */
export async function fetchOverpass(
  query: string,
  urls = loadEnv().OVERPASS_URLS,
): Promise<OsmElement[]> {
  const failures: string[] = []
  for (const url of urls) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'User-Agent': 'Lucko/1.0 (+https://github.com/Suissehide/Lucko)' },
        body: new URLSearchParams({ data: query }),
      })
      if (!res.ok || !res.headers.get('content-type')?.includes('json'))
        throw new Error(`HTTP ${res.status}`)
      const body = (await res.json()) as { elements: OsmElement[]; remark?: string }
      if (body.remark) throw new Error(body.remark)
      return body.elements
    } catch (error) {
      failures.push(`${new URL(url).host} : ${error instanceof Error ? error.message : error}`)
    }
  }
  throw new Error(`Overpass indisponible (${failures.join(' ; ')})`)
}

/**
 * Import et resynchronisation des lieux OSM des métropoles d'OSM_ZONES (LKO-74). Crée les lieux nouveaux (publiés), sauf doublon
 * d'un lieu saisi à la main (même nom à moins de 100 m), met à jour les fiches importées et masque
 * celles qui ont disparu d'OSM. Une fiche partenaire ou revendiquée (staff) n'est jamais modifiée.
 */
export async function importOsmVenues(
  prisma: PrismaClient,
  fetchZone = (zone: OsmZone) => fetchOverpass(osmZoneQuery(zone)),
) {
  // Toutes les zones avant la première écriture : une zone en échec relance tout, sans import partiel
  const elements: { element: OsmElement; city: string }[] = []
  for (const zone of OSM_ZONES)
    for (const element of await fetchZone(zone)) elements.push({ element, city: zone.city })
  const existing = await prisma.venue.findMany({
    select: {
      id: true,
      slug: true,
      name: true,
      latitude: true,
      longitude: true,
      osmId: true,
      status: true,
      isPartner: true,
      type: true,
      _count: { select: { staff: true } },
    },
  })
  const claimed = (v: (typeof existing)[number]) => v.isPartner || v._count.staff > 0
  const byOsmId = new Map(existing.flatMap((v) => (v.osmId ? [[v.osmId, v] as const] : [])))
  const slugs = new Set(existing.map((v) => v.slug))
  const seen = new Set<string>()
  const counts = { created: 0, updated: 0, duplicates: 0, hidden: 0 }

  for (const { element, city } of elements) {
    const parsed = toVenue(element, city)
    if (!parsed) continue
    const { venue, openingHours } = parsed
    const osmId = osmIdOf(element)
    seen.add(osmId)
    const current = byOsmId.get(osmId)
    if (!current) {
      if (existing.some((v) => !v.osmId && isSamePlace(v, venue))) {
        counts.duplicates++
        continue
      }
      let slug = slugify(venue.name) || 'lieu'
      if (slugs.has(slug)) slug = `${slug}-${element.id}`
      slugs.add(slug)
      await prisma.venue.create({
        data: {
          ...venue,
          slug,
          osmId,
          status: 'PUBLISHED',
          openingHours: { create: openingHours },
        },
      })
      counts.created++
      continue
    }
    if (claimed(current)) continue
    // Accueil des mineurs et type restent ceux qu'un admin a pu corriger ; un type OTHER vient d'un
    // import antérieur aux types Café / Bar : il est reclassé
    const { type, acceptsUnaccompaniedMinors: _minors, ...fields } = venue
    await prisma.$transaction([
      prisma.venue.update({
        where: { id: current.id },
        data: current.type === 'OTHER' ? { ...fields, type } : fields,
      }),
      prisma.venueOpeningHours.deleteMany({ where: { venueId: current.id } }),
      prisma.venueOpeningHours.createMany({
        data: openingHours.map((r) => ({ ...r, venueId: current.id })),
      }),
    ])
    counts.updated++
  }

  const gone = existing.filter(
    (v) => v.osmId && !seen.has(v.osmId) && v.status === 'PUBLISHED' && !claimed(v),
  )
  // Une réponse tronquée masquerait la moitié de la carte : on ne masque que si l'import paraît complet
  if (seen.size >= byOsmId.size * 0.8) {
    await prisma.venue.updateMany({
      where: { id: { in: gone.map((v) => v.id) } },
      data: { status: 'PENDING' },
    })
    counts.hidden = gone.length
  }
  return counts
}
