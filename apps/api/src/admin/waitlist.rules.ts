import type { WaitlistPeriod } from '@lucko/shared'

const DAY = 24 * 60 * 60 * 1000
const PERIOD_DAYS: Record<WaitlistPeriod, number | null> = { all: null, '30d': 30, '7d': 7 }

/** Début de la période (null : depuis toujours). */
export function periodStart(period: WaitlistPeriod, now: Date): Date | null {
  const days = PERIOD_DAYS[period]
  return days === null ? null : new Date(now.getTime() - days * DAY)
}

/**
 * Regroupe les villes saisies librement (« Bordeaux », « bordeaux ») : une ligne par ville, écrite
 * comme la majorité des inscrits l'ont écrite, la plus fréquente en tête ; les inscrits sans ville
 * forment une ligne `city: null`.
 */
export function groupCities(rows: { city: string | null; count: number }[]) {
  const groups = new Map<string, { count: number; spellings: Map<string, number> }>()
  let none = 0
  for (const { city, count } of rows) {
    const label = city?.trim()
    if (!label) {
      none += count
      continue
    }
    const key = label.toLocaleLowerCase('fr')
    const group = groups.get(key) ?? { count: 0, spellings: new Map() }
    group.count += count
    group.spellings.set(label, (group.spellings.get(label) ?? 0) + count)
    groups.set(key, group)
  }
  const cities: { city: string | null; count: number }[] = [...groups.values()].map((g) => ({
    city: [...g.spellings].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null,
    count: g.count,
  }))
  if (none) cities.push({ city: null, count: none })
  return cities.sort(
    (a, b) => b.count - a.count || (a.city ?? '￿').localeCompare(b.city ?? '￿', 'fr'),
  )
}
