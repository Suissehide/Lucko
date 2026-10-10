import { describe, expect, it } from 'vitest'
import {
  acceptRefusal,
  createRoomRefusal,
  fillStatus,
  hostActionRefusal,
  type JoinableRoom,
  joinOutcome,
  lifecycleStatus,
  MAX_OPEN_ROOMS_PER_HOST,
  promotedStatus,
  type RoomContext,
  reminderContent,
  reminderTimes,
} from './rooms.rules'

const now = new Date('2026-10-05T12:00:00Z')
const room = {
  gameId: 'magic',
  formatId: 'commander',
  mode: 'CASUAL' as const,
  venueId: 'v1',
  startsAt: new Date('2026-10-06T18:00:00Z'),
  capacity: 4,
  minorsAllowed: false,
  autoAccept: false,
  vibes: [],
}
const ctx: RoomContext = {
  game: {
    kind: 'TCG',
    minPlayers: 2,
    maxPlayers: 4,
    formats: [
      { id: 'commander', minPlayers: 2, maxPlayers: 5, hasBrackets: true },
      { id: 'modern', minPlayers: 2, maxPlayers: 2, hasBrackets: false },
    ],
  },
  venueOpen: true,
  hostIsMinor: false,
  venueRefusesHost: false,
  hostOpenRooms: 0,
}
const boardGame: RoomContext = {
  ...ctx,
  game: { kind: 'BOARD_GAME', minPlayers: 2, maxPlayers: 8, formats: [] },
}

describe('createRoomRefusal', () => {
  it('accepte une room valide, y compris dans un lieu sans horaires', () => {
    expect(createRoomRefusal(room, ctx, now)).toBeNull()
    expect(createRoomRefusal({ ...room, mode: 'RANKED' }, ctx, now)).toBeNull()
    expect(createRoomRefusal(room, { ...ctx, venueOpen: null }, now)).toBeNull()
    expect(createRoomRefusal({ ...room, formatId: null }, boardGame, now)).toBeNull()
  })

  it('classée = TCG avec un format du jeu ; jeux de société toujours en normale', () => {
    expect(createRoomRefusal({ ...room, formatId: 'standard' }, ctx, now)).toMatch(/format/)
    expect(createRoomRefusal({ ...room, formatId: null }, ctx, now)).toBe('Choisis un format')
    expect(createRoomRefusal({ ...room, formatId: null, mode: 'RANKED' }, boardGame, now)).toMatch(
      /room normale/,
    )
  })

  it('catégorie pour les jeux de société seulement', () => {
    const party = { ...room, formatId: null, boardGameCategory: 'PARTY' as const }
    expect(createRoomRefusal(party, boardGame, now)).toBeNull()
    expect(createRoomRefusal({ ...room, boardGameCategory: 'PARTY' }, ctx, now)).toMatch(
      /jeux de société/,
    )
  })

  it('au moins le minimum de joueurs du format, bracket pour Commander seulement', () => {
    const draft: RoomContext = {
      ...ctx,
      game: {
        ...ctx.game,
        formats: [{ id: 'draft', minPlayers: 6, maxPlayers: 8, hasBrackets: false }],
      },
    }
    expect(createRoomRefusal({ ...room, formatId: 'draft', capacity: 4 }, draft, now)).toBe(
      'Il faut au moins 6 places pour ce format',
    )
    expect(createRoomRefusal({ ...room, formatId: 'draft', capacity: 8 }, draft, now)).toBeNull()
    // 4 joueurs qui enchaînent des duels, 8 joueurs pour 2 tables de Commander
    expect(createRoomRefusal({ ...room, formatId: 'modern', capacity: 4 }, ctx, now)).toBeNull()
    expect(createRoomRefusal({ ...room, capacity: 8 }, ctx, now)).toBeNull()
    expect(createRoomRefusal({ ...room, formatId: null, capacity: 8 }, boardGame, now)).toBeNull()
    expect(createRoomRefusal({ ...room, bracket: 3 }, ctx, now)).toBeNull()
    expect(
      createRoomRefusal({ ...room, formatId: 'modern', capacity: 2, bracket: 3 }, ctx, now),
    ).toMatch(/Commander/)
  })

  it('date à venir, au plus 60 jours, lieu ouvert', () => {
    expect(createRoomRefusal({ ...room, startsAt: now }, ctx, now)).toMatch(/à venir/)
    const later = new Date('2026-12-10T18:00:00Z')
    expect(createRoomRefusal({ ...room, startsAt: later }, ctx, now)).toMatch(/60 jours/)
    expect(createRoomRefusal(room, { ...ctx, venueOpen: false }, now)).toMatch(/fermé/)
  })

  it('hôte mineur : room ouverte aux mineurs ; limite de rooms à venir', () => {
    const minor = { ...ctx, hostIsMinor: true }
    expect(createRoomRefusal(room, minor, now)).toMatch(/mineurs/)
    expect(createRoomRefusal({ ...room, minorsAllowed: true }, minor, now)).toBeNull()
    const bar = { ...minor, venueRefusesHost: true }
    expect(createRoomRefusal({ ...room, minorsAllowed: true }, bar, now)).toMatch(/16 ans/)
    const busy = { ...ctx, hostOpenRooms: MAX_OPEN_ROOMS_PER_HOST }
    expect(createRoomRefusal(room, busy, now)).toMatch(/déjà/)
  })
})

describe('createRoomRefusal à domicile (LKO-72)', () => {
  const home = {
    ...room,
    venueId: null,
    home: { lat: 44.83, lng: -0.57, areaLabel: 'Bordeaux · Saint-Michel' },
  }
  const atHome = { ...ctx, venueOpen: null }

  it('réservée aux adultes, acceptation obligatoire', () => {
    expect(createRoomRefusal(home, atHome, now)).toBeNull()
    expect(createRoomRefusal(home, { ...atHome, hostIsMinor: true }, now)).toMatch(/adultes/)
    expect(createRoomRefusal({ ...home, autoAccept: true }, atHome, now)).toMatch(/acceptes/)
  })
})

describe('joinOutcome', () => {
  const open: JoinableRoom = {
    hostId: 'host',
    status: 'OPEN',
    startsAt: new Date('2026-10-06T18:00:00Z'),
    capacity: 4,
    autoAccept: false,
  }

  it('demande en attente de l’hôte, ou acceptée d’office en inscription automatique', () => {
    expect(joinOutcome(open, 2, 'lea', null, now)).toEqual({ status: 'PENDING' })
    expect(joinOutcome({ ...open, autoAccept: true }, 2, 'lea', null, now)).toEqual({
      status: 'ACCEPTED',
    })
    expect(joinOutcome(open, 2, 'lea', 'LEFT', now)).toEqual({ status: 'PENDING' })
  })

  it('room complète : liste d’attente, même en inscription automatique', () => {
    expect(joinOutcome({ ...open, autoAccept: true }, 4, 'lea', null, now)).toEqual({
      status: 'WAITLISTED',
    })
  })

  it('sans effet si déjà dedans ; refus pour l’hôte, un refusé, une room fermée ou commencée', () => {
    expect(joinOutcome(open, 2, 'lea', 'ACCEPTED', now)).toEqual({ status: 'ACCEPTED' })
    expect(joinOutcome(open, 2, 'host', null, now)).toHaveProperty('refused')
    expect(joinOutcome(open, 2, 'lea', 'DECLINED', now)).toHaveProperty('refused')
    expect(joinOutcome({ ...open, status: 'CANCELLED' }, 2, 'lea', null, now)).toHaveProperty(
      'refused',
    )
    expect(joinOutcome({ ...open, startsAt: now }, 2, 'lea', null, now)).toHaveProperty('refused')
  })
})

describe('acceptRefusal, promotedStatus, fillStatus', () => {
  it('accepte une demande ou un joueur en liste d’attente tant qu’il reste une place', () => {
    expect(acceptRefusal('PENDING', 3, 4)).toBeNull()
    expect(acceptRefusal('WAITLISTED', 3, 4)).toBeNull()
    expect(acceptRefusal('PENDING', 4, 4)).toMatch(/complète/)
    expect(acceptRefusal('ACCEPTED', 3, 4)).toMatch(/Pas de demande/)
    expect(acceptRefusal(null, 3, 4)).toMatch(/Pas de demande/)
  })

  it('place libérée et statut de la room', () => {
    expect(promotedStatus(true)).toBe('ACCEPTED')
    expect(promotedStatus(false)).toBe('PENDING')
    expect(fillStatus(4, 4)).toBe('FULL')
    expect(fillStatus(3, 4)).toBe('OPEN')
  })
})

describe('lifecycleStatus', () => {
  const startsAt = new Date('2026-10-05T18:00:00Z')
  it('en cours dès le début, terminée 3 h après ; annulée reste annulée', () => {
    expect(lifecycleStatus({ status: 'OPEN', startsAt }, now)).toBe('OPEN')
    expect(lifecycleStatus({ status: 'FULL', startsAt }, new Date('2026-10-05T19:00:00Z'))).toBe(
      'IN_PROGRESS',
    )
    expect(
      lifecycleStatus({ status: 'CONFIRMED', startsAt }, new Date('2026-10-05T21:00:00Z')),
    ).toBe('FINISHED')
    expect(
      lifecycleStatus({ status: 'CANCELLED', startsAt }, new Date('2026-10-05T21:00:00Z')),
    ).toBe('CANCELLED')
  })
})

describe('hostActionRefusal', () => {
  const room = {
    hostId: 'host',
    status: 'OPEN' as const,
    startsAt: new Date('2026-10-06T18:00:00Z'),
  }

  it('retirer ou transférer : seulement un joueur accepté, pas l’hôte lui-même', () => {
    expect(hostActionRefusal(room, { type: 'remove', userId: 'lea' }, 'ACCEPTED', now)).toBeNull()
    expect(hostActionRefusal(room, { type: 'transfer', userId: 'lea' }, 'ACCEPTED', now)).toBeNull()
    expect(hostActionRefusal(room, { type: 'remove', userId: 'lea' }, 'PENDING', now)).toMatch(
      /ne fait pas partie/,
    )
    expect(hostActionRefusal(room, { type: 'transfer', userId: 'host' }, 'ACCEPTED', now)).toMatch(
      /déjà l’hôte/,
    )
  })

  it('fermer une room ouverte ou complète, rouvrir une room confirmée', () => {
    const confirmed = { ...room, status: 'CONFIRMED' as const }
    expect(hostActionRefusal(room, { type: 'close' }, null, now)).toBeNull()
    expect(hostActionRefusal(confirmed, { type: 'close' }, null, now)).toMatch(/déjà fermées/)
    expect(hostActionRefusal(confirmed, { type: 'reopen' }, null, now)).toBeNull()
    expect(hostActionRefusal(room, { type: 'reopen' }, null, now)).toMatch(/déjà ouvertes/)
  })

  it('rien après le début de la partie ni sur une room annulée', () => {
    const started = { ...room, startsAt: new Date('2026-10-05T11:00:00Z') }
    expect(hostActionRefusal(started, { type: 'cancel' }, null, now)).toMatch(/commencé/)
    const cancelled = { ...room, status: 'CANCELLED' as const }
    expect(hostActionRefusal(cancelled, { type: 'cancel' }, null, now)).toMatch(/annulée/)
    expect(hostActionRefusal(room, { type: 'cancel' }, null, now)).toBeNull()
  })
})

describe('reminderTimes (LKO-59)', () => {
  it('la veille à 18 h (heure de Paris) et 2 h avant', () => {
    expect(reminderTimes(new Date('2026-10-10T18:00:00Z'), now)).toEqual([
      ['eve', new Date('2026-10-09T16:00:00Z')],
      ['soon', new Date('2026-10-10T16:00:00Z')],
    ])
  })

  it('suit le changement d’heure (heure d’hiver le 25 octobre)', () => {
    const [eve] = reminderTimes(new Date('2026-10-26T19:00:00Z'), now)
    expect(eve).toEqual(['eve', new Date('2026-10-25T17:00:00Z')])
  })

  it('saute les rappels déjà passés', () => {
    // Room ce soir à 20 h (Paris) créée à 14 h : plus de veille
    expect(reminderTimes(new Date('2026-10-05T18:00:00Z'), now)).toEqual([
      ['soon', new Date('2026-10-05T16:00:00Z')],
    ])
    expect(reminderTimes(new Date('2026-10-05T13:00:00Z'), now)).toEqual([])
  })
})

describe('reminderContent (LKO-59)', () => {
  const base = {
    startsAt: new Date('2026-10-10T18:00:00Z'),
    game: { name: 'Magic' },
    venue: { name: 'Le Dé Bordelais' },
    homeAreaLabel: null,
    addressVisible: null,
  }

  it('jeu, heure et lieu', () => {
    expect(reminderContent('eve', base)).toEqual({
      title: 'Demain : Magic à 20:00',
      body: 'Le Dé Bordelais · 20:00.',
    })
    expect(reminderContent('soon', base).title).toBe('Magic dans 2 h')
  })

  it('à domicile : où trouver l’adresse, jamais l’adresse elle-même', () => {
    const home = { ...base, venue: null, homeAreaLabel: 'Chartrons' }
    expect(reminderContent('eve', { ...home, addressVisible: false }).body).toBe(
      'À domicile · Chartrons · 20:00. L’adresse sera visible dans la room 24 h avant.',
    )
    expect(reminderContent('soon', { ...home, addressVisible: true }).body).toMatch(
      /adresse est visible/,
    )
  })
})
