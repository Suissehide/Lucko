import { config } from 'dotenv'

// Lit apps/api/.env s'il existe, sinon le .env à la racine du monorepo
config({ path: ['.env', '../../.env'], quiet: true })

import { PrismaPg } from '@prisma/adapter-pg'
import { hashPassword } from 'better-auth/crypto'
import type { PlayVibe, UserRole } from '../src/generated/prisma/client'
import { PrismaClient } from '../src/generated/prisma/client'
import { seedGames } from './games'

// Données de développement uniquement (fictives) : les vrais lieux bordelais sont saisis via le back-office.
// Relancer `pnpm db:seed` remet les dates par rapport au jour courant et réinitialise les comptes de test.

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
})

const BORDEAUX = { city: 'Bordeaux', latitude: 44.8378, longitude: -0.5792 }

type Account = {
  id: string
  email: string
  pseudo: string | null
  role?: UserRole
  /** Comptes de test : connexion par e-mail + mot de passe dans l'app. */
  password?: string
  birthDate?: Date
  name?: string
  city?: string | null
  xp?: number
  availability?: number[]
  vibes?: PlayVibe[]
}

// Ids fixes : en dev, l'en-tête `x-dev-user-id: joueur-demo` (ou `admin-demo`…) connecte le même compte
const accounts: Account[] = [
  {
    id: 'joueur-demo',
    email: 'player@lucko.dev',
    password: 'Player123!',
    pseudo: 'Lea',
    name: 'Léa Martin',
    xp: 1840,
    // Mardi, jeudi, vendredi soir, samedi après-midi et soir, dimanche matin et après-midi
    availability: [5, 11, 14, 16, 17, 18, 19],
    vibes: ['CHILL', 'COMPETITIVE'],
  },
  {
    id: 'admin-demo',
    email: 'admin@lucko.dev',
    password: 'Admin123!',
    pseudo: 'admin',
    name: 'Équipe Lucko',
    role: 'ADMIN',
  },
  {
    id: 'staff-demo',
    email: 'staff@lucko.dev',
    password: 'Staff123!',
    pseudo: 'gerant-de-fele',
    name: 'Karim Benali',
    role: 'VENUE_STAFF',
    xp: 620,
  },
  {
    id: 'mineur-demo',
    email: 'mineur@lucko.dev',
    password: 'Mineur123!',
    pseudo: 'Tom_16',
    name: 'Tom Leroy',
    birthDate: yearsAgo(16),
    xp: 240,
    availability: [17, 18],
    vibes: ['BEGINNER'],
  },
  {
    // Compte tout juste créé : l'app ouvre l'onboarding (pseudo, ville)
    id: 'nouveau-demo',
    email: 'nouveau@lucko.dev',
    password: 'Nouveau123!',
    pseudo: null,
    city: null,
  },
  ...(
    [
      ['maya', 980, ['COMPETITIVE'], [14, 17]],
      ['sam', 2650, ['COMPETITIVE', 'HOMEBREW'], [5, 11, 14]],
      ['theo', 410, ['CHILL', 'SOCIAL'], [8, 14]],
      ['alix', 3120, ['TEACHER', 'COMPETITIVE'], [11, 17, 20]],
      ['jade', 150, ['BEGINNER', 'SOCIAL'], [18, 19]],
      ['noah', 1330, ['HOMEBREW'], [2, 5]],
      ['hugo', 760, ['CHILL'], [17, 20]],
      ['ines', 2050, ['TEACHER', 'SOCIAL'], [11, 14, 17]],
    ] as const
  ).map(([pseudo, xp, vibes, availability]) => ({
    id: `demo-${pseudo}`,
    email: `${pseudo}@lucko.dev`,
    pseudo,
    xp,
    vibes: [...vibes],
    availability: [...availability],
  })),
]

async function main() {
  await seedGames(prisma)

  // ---------- Lieux ----------

  const tuesdayToSaturday = (opens: number, closes: number) =>
    [2, 3, 4, 5, 6].map((weekday) => ({ weekday, opensAtMinute: opens, closesAtMinute: closes }))

  const bar = await upsertVenue(
    {
      slug: 'lieu-de-demo-bordeaux',
      name: 'Le Dé Fêlé',
      type: 'GAME_BAR',
      address: '1 place de la Bourse',
      city: 'Bordeaux',
      latitude: 44.8412,
      longitude: -0.5697,
      isPartner: true,
      pricePerVisitCents: 150,
      description: 'Bar à jeux : ludothèque de 400 jeux, tables TCG, soirées à thème.',
      playFeeCents: 300,
      minSpendCents: 500,
      luckoPerk: 'Droit de jeu offert sur présentation du QR Lucko',
      quarter: 'Saint-Pierre',
      phone: '05 56 00 00 00',
      website: 'https://example.com',
      transitInfo: 'Tram C · Place de la Bourse, 2 min à pied',
      accessibility: [
        { label: 'Accès de plain-pied', status: 'YES', note: "Pas de marche à l'entrée" },
        { label: 'Toilettes adaptées', status: 'YES', note: 'Au rez-de-chaussée' },
        { label: "Salle TCG à l'étage", status: 'NO', note: 'Accès par escalier uniquement' },
        { label: 'Chaises avec dossier', status: 'YES', note: 'Sur toutes les tables' },
        { label: 'Niveau sonore', status: 'INFO', note: 'Calme en semaine, animé le samedi soir' },
        { label: "Chiens d'assistance", status: 'YES', note: 'Acceptés' },
      ],
      tcgNote:
        'Salle TCG de 12 tables. Apporte ton deck ; tapis et sleeves disponibles au comptoir.',
      boardGames: ['Cascadia', 'Codenames', 'Azul', 'Les Aventuriers du Rail', 'Dixit', 'Skyjo'],
      boardGameCount: 300,
      boardGameNote:
        "Ludothèque en libre accès, comprise dans le droit de jeu. Demande conseil à l'équipe.",
    },
    ['magic', 'pokemon', 'lorcana', 'jeux-de-societe'],
    [
      ...tuesdayToSaturday(17 * 60, 60),
      { weekday: 7, opensAtMinute: 14 * 60, closesAtMinute: 20 * 60 },
    ],
    {
      photos: ['salle', 'ludotheque', 'comptoir', 'tournoi', 'terrasse'].map((name, order) => ({
        url: `https://picsum.photos/seed/lucko-${name}/1200/800`,
        caption: name,
        order,
      })),
      closures: [
        {
          startsOn: nextWeekday(3, 0, 0, 1),
          label: 'Fermé (inventaire)',
          note: 'Réouverture le lendemain à 17 h',
        },
        {
          startsOn: nextWeekday(3, 0, 0, 2),
          kind: 'SPECIAL_HOURS',
          label: 'Ouverture à 14 h',
          note: 'Horaires du samedi',
          opensAtMinute: 14 * 60,
          closesAtMinute: 60,
        },
        {
          startsOn: nextWeekday(2, 0, 0, 6),
          endsOn: nextWeekday(6, 0, 0, 6),
          label: 'Congés',
          note: 'Fermé 5 jours',
        },
      ],
    },
  )
  const shop = await upsertVenue(
    {
      slug: 'boutique-tcg-demo-bordeaux',
      name: 'Carte Blanche',
      type: 'TCG_SHOP',
      address: '10 cours Victor Hugo',
      city: 'Bordeaux',
      latitude: 44.8352,
      longitude: -0.5712,
      isPartner: false,
      acceptsUnaccompaniedMinors: true,
      description: 'Boutique TCG non partenaire (pour tester le tri : partenaires en premier).',
    },
    ['magic', 'pokemon', 'one-piece', 'yugioh'],
    [1, 2, 3, 4, 5, 6].map((weekday) => ({
      weekday,
      opensAtMinute: 10 * 60,
      closesAtMinute: 19 * 60,
    })),
  )
  const ludotheque = await upsertVenue(
    {
      slug: 'ludotheque-chartrons-demo',
      name: 'Ludothèque des Chartrons',
      type: 'LUDOTHEQUE',
      address: '25 rue Notre-Dame',
      city: 'Bordeaux',
      latitude: 44.853,
      longitude: -0.57,
      isPartner: false,
      acceptsUnaccompaniedMinors: true,
      description: 'Ludothèque de quartier : prêt de jeux et soirées ouvertes à tous.',
      playFeeCents: 0,
    },
    ['jeux-de-societe'],
    [3, 5, 6].map((weekday) => ({ weekday, opensAtMinute: 14 * 60, closesAtMinute: 22 * 60 })),
  )
  const pixel = await upsertVenue(
    {
      slug: 'pixel-et-pions-demo',
      name: 'Pixel & Pions',
      type: 'GAME_BAR',
      address: '8 rue Sainte-Catherine',
      city: 'Bordeaux',
      latitude: 44.832,
      longitude: -0.583,
      isPartner: true,
      pricePerVisitCents: 150,
      description: 'Bar à jeux et arcade, tournois TCG le week-end.',
      playFeeCents: 400,
      luckoPerk: '-10 % sur les boosters avec le QR Lucko',
    },
    ['one-piece', 'lorcana', 'riftbound', 'jeux-de-societe'],
    tuesdayToSaturday(16 * 60, 2 * 60),
  )
  const gobelin = await upsertVenue(
    {
      slug: 'repaire-du-gobelin-demo',
      name: 'Le Repaire du Gobelin',
      type: 'ASSOCIATION',
      address: '3 quai des Queyries',
      city: 'Bordeaux',
      latitude: 44.8445,
      longitude: -0.5545,
      isPartner: false,
      acceptsUnaccompaniedMinors: true,
      description: 'Association de joueurs de la rive droite : Yu-Gi-Oh!, Magic, jeux de rôle.',
    },
    ['yugioh', 'magic', 'jeux-de-societe'],
    [5, 6].map((weekday) => ({ weekday, opensAtMinute: 19 * 60, closesAtMinute: 24 * 60 - 1 })),
  )

  // ---------- Comptes ----------

  for (const { password, ...account } of accounts) {
    const data = {
      ...account,
      name: account.name ?? '',
      emailVerified: true,
      role: account.role ?? 'PLAYER',
      birthDate: account.birthDate ?? new Date('1995-06-15'),
      city: account.city === undefined ? BORDEAUX.city : account.city,
      latitude: account.city === null ? null : BORDEAUX.latitude,
      longitude: account.city === null ? null : BORDEAUX.longitude,
      searchRadiusKm: 10,
      xp: account.xp ?? 0,
      availability: account.availability ?? [],
      vibes: account.vibes ?? [],
    }
    await prisma.user.upsert({ where: { id: account.id }, update: data, create: data })
    if (password) {
      // Compte e-mail + mot de passe de Better Auth (même hachage que l'inscription)
      const credential = {
        accountId: account.id,
        providerId: 'credential',
        userId: account.id,
        password: await hashPassword(password),
      }
      await prisma.account.upsert({
        where: { id: `${account.id}-credential` },
        update: credential,
        create: { id: `${account.id}-credential`, ...credential },
      })
    }
  }
  await prisma.venueStaff.upsert({
    where: { userId_venueId: { userId: 'staff-demo', venueId: bar.id } },
    update: { role: 'MANAGER' },
    create: { userId: 'staff-demo', venueId: bar.id, role: 'MANAGER' },
  })

  // « Je veux jouer à… » (LKO-17) : Magic attendu par 4 joueurs (compteur visible), Lorcana par 2 (masqué)
  const intentExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  for (const [game, pseudos] of [
    ['magic', ['maya', 'sam', 'alix', 'noah']],
    ['lorcana', ['jade', 'theo']],
  ] as const) {
    const { id: gameId } = await prisma.game.findUniqueOrThrow({ where: { slug: game } })
    for (const pseudo of pseudos) {
      const userId = `demo-${pseudo}`
      await prisma.playIntent.upsert({
        where: { userId_gameId: { userId, gameId } },
        update: { expiresAt: intentExpiresAt },
        create: { userId, gameId, expiresAt: intentExpiresAt },
      })
    }
  }

  const format = (game: string, slug: string) =>
    prisma.gameFormat.findFirstOrThrow({ where: { slug, game: { slug: game } } })
  const commander = await format('magic', 'commander')
  const pioneer = await format('magic', 'pioneer')
  const pokemon = await format('pokemon', 'standard')
  const lorcana = await format('lorcana', 'core')
  const onePiece = await format('one-piece', 'standard')
  const yugioh = await format('yugioh', 'advanced')
  const boardGames = await prisma.game.findUniqueOrThrow({ where: { slug: 'jeux-de-societe' } })

  // LK par format : moins de 5 parties classées = provisoire
  for (const [userId, f, rating, rankedGames, reliabilityPct] of [
    ['joueur-demo', commander, 1214, 38, 82],
    ['joueur-demo', lorcana, 1310, 12, 54],
    ['joueur-demo', pokemon, 1092, 21, 66],
    ['joueur-demo', onePiece, 1000, 3, 12],
    ['mineur-demo', pokemon, 1000, 2, 8],
    ['staff-demo', commander, 1150, 9, 40],
    ['demo-maya', pokemon, 1180, 8, 35],
    ['demo-sam', pokemon, 1260, 15, 58],
    ['demo-sam', onePiece, 1050, 6, 30],
    ['demo-theo', commander, 1120, 9, 40],
    ['demo-alix', commander, 1305, 22, 70],
    ['demo-alix', pioneer, 1188, 11, 48],
    ['demo-jade', commander, 980, 4, 15],
    ['demo-noah', lorcana, 1240, 14, 55],
    ['demo-ines', yugioh, 1275, 19, 62],
  ] as const) {
    await prisma.playerGameProfile.upsert({
      where: { userId_formatId: { userId, formatId: f.id } },
      update: { rating, rankedGames, reliabilityPct },
      create: { userId, formatId: f.id, rating, rankedGames, reliabilityPct },
    })
  }

  // ---------- Événements ----------

  // Série du mardi (LKO-61) : le job de nuit crée les dates suivantes, 3 mois à l'avance
  const commanderSeries = {
    venueId: bar.id,
    createdById: 'staff-demo',
    rrule: 'FREQ=WEEKLY;INTERVAL=1;BYDAY=TU',
    startDate: localDate(nextWeekday(2, 19, 30, 0)),
    untilDate: null,
    startMinute: 19 * 60 + 30,
    materializedUntil: localDate(nextWeekday(2, 19, 30, 11)),
    type: 'GAME_NIGHT' as const,
    title: 'Soirée Commander',
    capacity: 12,
  }
  await prisma.eventSeries.upsert({
    where: { id: 'demo-serie-commander-mardi' },
    update: commanderSeries,
    create: {
      id: 'demo-serie-commander-mardi',
      ...commanderSeries,
      games: { connect: [{ slug: 'magic' }] },
    },
  })

  const events = [
    // Ce soir (accueil)
    {
      id: 'demo-ce-soir-commander',
      venueId: bar.id,
      type: 'GAME_NIGHT' as const,
      title: 'Soirée Commander',
      startsAt: today(19, 30),
      capacity: 12,
      games: ['magic'],
    },
    {
      id: 'demo-ce-soir-lorcana',
      venueId: shop.id,
      type: 'PRERELEASE' as const,
      title: 'Avant-première Lorcana',
      startsAt: today(20, 0),
      capacity: 16,
      priceCents: 3000,
      games: ['lorcana'],
    },
    {
      id: 'demo-ce-soir-jeux-libre',
      venueId: bar.id,
      type: 'GAME_NIGHT' as const,
      title: 'Jeux de société en accès libre',
      startsAt: today(19, 0),
      registrationMode: 'NONE' as const,
      games: ['jeux-de-societe'],
    },
    {
      id: 'demo-ce-soir-pokemon',
      venueId: shop.id,
      type: 'TOURNAMENT' as const,
      title: 'Tournoi Standard',
      startsAt: today(20, 0),
      capacity: 16,
      priceCents: 500,
      games: ['pokemon'],
    },
    {
      id: 'demo-ce-soir-initiation-one-piece',
      venueId: pixel.id,
      type: 'INITIATION' as const,
      title: 'Initiation One Piece',
      description: 'Decks prêtés, règles expliquées en 20 minutes.',
      startsAt: today(18, 30),
      capacity: 8,
      games: ['one-piece'],
    },
    {
      id: 'demo-ce-soir-ludotheque',
      venueId: ludotheque.id,
      type: 'GAME_NIGHT' as const,
      title: 'Soirée jeux en famille',
      startsAt: today(18, 0),
      registrationMode: 'NONE' as const,
      minAge: 8,
      games: [],
    },
    // Les prochaines semaines (soirée annulée pendant les congés, semaine 6)
    ...[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((week) => ({
      id: `demo-commander-${week + 1}`,
      venueId: bar.id,
      type: 'GAME_NIGHT' as const,
      title: 'Soirée Commander',
      startsAt: nextWeekday(2, 19, 30, week),
      capacity: 12,
      status: week === 6 ? ('CANCELLED' as const) : ('PUBLISHED' as const),
      seriesId: 'demo-serie-commander-mardi',
      occurrenceDate: localDate(nextWeekday(2, 19, 30, week)),
      createdById: 'staff-demo',
      games: ['magic'],
    })),
    {
      id: 'demo-tournoi-pioneer',
      venueId: shop.id,
      type: 'TOURNAMENT' as const,
      title: 'Tournoi Pioneer',
      description: 'Suisse en 4 rondes, decklist obligatoire.',
      startsAt: nextWeekday(6, 14, 0, 1),
      capacity: 16,
      priceCents: 500,
      minAge: 13,
      games: ['magic'],
    },
    {
      id: 'demo-soiree-jeux-libre',
      venueId: bar.id,
      type: 'GAME_NIGHT' as const,
      title: 'Soirée jeux de société en accès libre',
      startsAt: nextWeekday(5, 19, 0, 0),
      registrationMode: 'NONE' as const,
      games: ['jeux-de-societe'],
    },
    {
      id: 'demo-avant-premiere-lorcana',
      venueId: shop.id,
      type: 'PRERELEASE' as const,
      title: 'Avant-première Lorcana',
      startsAt: nextWeekday(7, 13, 0, 2),
      priceCents: 3000,
      registrationMode: 'EXTERNAL' as const,
      externalUrl: 'https://example.com/avant-premiere-lorcana',
      games: ['lorcana'],
    },
    ...[
      ['TOURNAMENT', 'Tournoi Standard', 6, 1, 'pokemon', 800],
      ['INITIATION', 'Découvrir Lorcana', 4, 1, 'lorcana', 0],
      ['TOURNAMENT', 'Tournoi mensuel', 6, 3, 'one-piece', 1000],
      ['INITIATION', 'Apprendre Magic en 1 h', 5, 4, 'magic', 0],
      ['THEMED', "Soirée Halloween : jeux d'enquête", 5, 5, 'jeux-de-societe', null],
      ['TOURNAMENT', 'Tournoi Standard', 6, 7, 'pokemon', 800],
      ['PRERELEASE', 'Avant-première Lorcana', 5, 9, 'lorcana', 2800],
      ['THEMED', 'Soirée de Noël', 5, 11, 'jeux-de-societe', null],
    ].map(([type, title, weekday, week, game, priceCents], i) => ({
      id: `demo-agenda-${i + 1}`,
      venueId: bar.id,
      type: type as 'TOURNAMENT' | 'INITIATION' | 'THEMED' | 'PRERELEASE',
      title: title as string,
      startsAt: nextWeekday(weekday as number, type === 'INITIATION' ? 18 : 19, 30, week as number),
      capacity: type === 'THEMED' ? 40 : type === 'INITIATION' ? 8 : 16,
      priceCents: priceCents as number | null,
      games: [game as string],
    })),
    {
      id: 'demo-halloween',
      venueId: pixel.id,
      type: 'THEMED' as const,
      title: 'Soirée Halloween : jeux d’ambiance',
      startsAt: nextWeekday(6, 20, 0, 3),
      capacity: 40,
      priceCents: 800,
      minAge: 18,
      games: ['jeux-de-societe'],
    },
    {
      id: 'demo-tournoi-yugioh',
      venueId: gobelin.id,
      type: 'TOURNAMENT' as const,
      title: 'Tournoi Yu-Gi-Oh! Advanced',
      startsAt: nextWeekday(6, 15, 0, 0),
      capacity: 24,
      priceCents: 300,
      games: ['yugioh'],
    },
    {
      id: 'demo-initiation-magic',
      venueId: ludotheque.id,
      type: 'INITIATION' as const,
      title: 'Découvrir Magic',
      startsAt: nextWeekday(3, 18, 0, 1),
      capacity: 10,
      games: ['magic'],
    },
    // Les deux prochaines semaines : chaque soir, plusieurs rendez-vous dans des lieux et des formats variés
    ...(
      [
        [
          0,
          ludotheque,
          'THEMED',
          'Quiz musical et jeux de rapidité',
          20,
          30,
          30,
          0,
          'jeux-de-societe',
        ],
        [1, gobelin, 'GAME_NIGHT', 'Soirée Flesh and Blood', 19, 0, 10, 0, 'flesh-and-blood'],
        [
          1,
          pixel,
          'INITIATION',
          'Initiation Star Wars Unlimited',
          18,
          30,
          8,
          0,
          'star-wars-unlimited',
        ],
        [2, shop, 'TOURNAMENT', 'Tournoi Lorcana Core', 19, 0, 6, 500, 'lorcana'],
        [2, bar, 'THEMED', 'Soirée jeux coopératifs', 20, 0, 20, 0, 'jeux-de-societe'],
        [3, pixel, 'GAME_NIGHT', 'Soirée Pokémon pour tous', 18, 0, 16, 0, 'pokemon'],
        [3, gobelin, 'TOURNAMENT', 'Tournoi Riftbound', 19, 30, 16, 600, 'riftbound'],
        [4, ludotheque, 'GAME_NIGHT', 'Grands jeux en famille', 17, 0, 24, 0, 'jeux-de-societe'],
        [4, shop, 'GAME_NIGHT', 'Draft du vendredi', 19, 30, 8, 1500, 'magic'],
        [5, pixel, 'TOURNAMENT', 'Tournoi Altered', 14, 0, 20, 800, 'altered'],
        [5, bar, 'THEMED', 'Murder party', 20, 30, 12, 1200, 'jeux-de-societe'],
        [6, gobelin, 'INITIATION', 'Découvrir Digimon', 15, 0, 8, 0, 'digimon'],
        [6, ludotheque, 'GAME_NIGHT', 'Dimanche jeux de société', 14, 30, 30, 0, 'jeux-de-societe'],
        [
          8,
          shop,
          'PRERELEASE',
          'Avant-première Flesh and Blood',
          19,
          0,
          24,
          3500,
          'flesh-and-blood',
        ],
        [9, pixel, 'GAME_NIGHT', 'Soirée One Piece', 19, 0, 12, 0, 'one-piece'],
        [10, bar, 'INITIATION', 'Initiation aux jeux experts', 19, 0, 10, 0, 'jeux-de-societe'],
        [11, gobelin, 'TOURNAMENT', 'Tournoi Yu-Gi-Oh! locaux', 19, 30, 24, 400, 'yugioh'],
        [12, shop, 'TOURNAMENT', 'Tournoi Pokémon Étendu', 14, 0, 32, 800, 'pokemon'],
        [12, ludotheque, 'THEMED', 'Soirée jeux de bluff', 20, 0, 20, 0, 'jeux-de-societe'],
        [13, pixel, 'GAME_NIGHT', 'Soirée Lorcana', 15, 0, 12, 0, 'lorcana'],
      ] as const
    ).map(([days, venue, type, title, hours, minutes, capacity, priceCents, game], i) => ({
      id: `demo-quinzaine-${i + 1}`,
      venueId: venue.id,
      type,
      title,
      startsAt: daysLater(days, hours, minutes),
      capacity,
      priceCents: priceCents || null,
      minAge: title === 'Murder party' ? 18 : null,
      games: [game] as string[],
    })),
    // Passé (historique de Mes parties)
    {
      id: 'demo-passe-tournoi-lorcana',
      venueId: shop.id,
      type: 'TOURNAMENT' as const,
      title: 'Tournoi Core',
      startsAt: daysAgo(8, 19, 0),
      capacity: 16,
      games: ['lorcana'],
    },
    {
      id: 'demo-passe-soiree-commander',
      venueId: bar.id,
      type: 'GAME_NIGHT' as const,
      title: 'Soirée Commander',
      startsAt: daysAgo(15, 19, 30),
      capacity: 12,
      games: ['magic'],
    },
  ]
  // Dates relatives au jour du seed : relancé un autre jour, une occurrence prendrait la date de la suivante
  await prisma.event.deleteMany({ where: { seriesId: 'demo-serie-commander-mardi' } })
  for (const { games: slugs, ...event } of events) {
    const games = { set: slugs.map((slug) => ({ slug })) }
    await prisma.event.upsert({
      where: { id: event.id },
      update: { ...event, games },
      create: { ...event, games: { connect: slugs.map((slug) => ({ slug })) } },
    })
  }

  const registrations: [string, string, 'REGISTERED' | 'WAITLISTED'][] = [
    ['demo-commander-1', 'joueur-demo', 'REGISTERED'],
    ['demo-tournoi-pioneer', 'joueur-demo', 'WAITLISTED'],
    ['demo-passe-tournoi-lorcana', 'joueur-demo', 'REGISTERED'],
    ['demo-passe-soiree-commander', 'joueur-demo', 'REGISTERED'],
    ['demo-ce-soir-pokemon', 'mineur-demo', 'REGISTERED'],
    ...['demo-alix', 'demo-theo', 'demo-jade', 'staff-demo'].map(
      (userId) => ['demo-ce-soir-commander', userId, 'REGISTERED'] as const,
    ),
    ...['demo-maya', 'demo-sam'].map(
      (userId) => ['demo-ce-soir-pokemon', userId, 'REGISTERED'] as const,
    ),
    ...['demo-noah', 'demo-hugo'].map(
      (userId) => ['demo-ce-soir-lorcana', userId, 'REGISTERED'] as const,
    ),
    ...['demo-alix', 'demo-sam', 'demo-ines'].map(
      (userId) => ['demo-tournoi-pioneer', userId, 'REGISTERED'] as const,
    ),
    ['demo-tournoi-yugioh', 'demo-ines', 'REGISTERED'],
    // Léa : inscrite ce soir et à plusieurs soirées de la quinzaine, en liste d'attente d'un tournoi complet
    ...[
      'demo-ce-soir-commander',
      'demo-quinzaine-2',
      'demo-quinzaine-6',
      'demo-quinzaine-9',
      'demo-quinzaine-11',
      'demo-quinzaine-14',
      'demo-quinzaine-17',
    ].map((eventId) => [eventId, 'joueur-demo', 'REGISTERED'] as const),
    ['demo-quinzaine-4', 'joueur-demo', 'WAITLISTED'],
    ...['demo-alix', 'demo-theo', 'demo-jade', 'demo-maya', 'demo-noah', 'demo-hugo'].map(
      (userId) => ['demo-quinzaine-4', userId, 'REGISTERED'] as const,
    ),
    ...['demo-sam', 'demo-ines', 'demo-theo'].map(
      (userId) => ['demo-quinzaine-9', userId, 'REGISTERED'] as const,
    ),
    ...['demo-alix', 'demo-jade', 'demo-noah', 'demo-hugo', 'demo-maya'].map(
      (userId) => ['demo-quinzaine-11', userId, 'REGISTERED'] as const,
    ),
    ...['demo-sam', 'demo-ines'].map(
      (userId) => ['demo-quinzaine-2', userId, 'REGISTERED'] as const,
    ),
  ]
  for (const [eventId, userId, status] of registrations) {
    await prisma.eventRegistration.upsert({
      where: { eventId_userId: { eventId, userId } },
      update: { status },
      create: { eventId, userId, status },
    })
  }

  // ---------- Rooms ----------

  const rooms = [
    {
      id: 'demo-room-pokemon',
      hostId: 'demo-maya',
      gameId: pokemon.gameId,
      formatId: pokemon.id,
      mode: 'RANKED' as const,
      venueId: bar.id,
      startsAt: today(21, 0),
      capacity: 4,
      players: ['demo-maya', 'demo-sam', 'joueur-demo'],
    },
    {
      id: 'demo-room-commander',
      hostId: 'demo-theo',
      gameId: commander.gameId,
      formatId: commander.id,
      mode: 'CASUAL' as const,
      venueId: shop.id,
      startsAt: today(20, 30),
      capacity: 4,
      bracket: 3,
      players: ['demo-theo', 'demo-alix', 'demo-jade'],
    },
    {
      id: 'demo-room-lorcana',
      hostId: 'demo-noah',
      gameId: lorcana.gameId,
      formatId: lorcana.id,
      mode: 'RANKED' as const,
      venueId: pixel.id,
      startsAt: daysLater(1, 20, 0),
      capacity: 2,
      minorsAllowed: true,
      players: ['demo-noah'],
    },
    {
      id: 'demo-room-one-piece',
      hostId: 'demo-sam',
      gameId: onePiece.gameId,
      formatId: onePiece.id,
      mode: 'CASUAL' as const,
      venueId: gobelin.id,
      startsAt: daysLater(5, 19, 30),
      capacity: 4,
      minorsAllowed: true,
      players: ['demo-sam', 'mineur-demo'],
      // Candidature de Léa en attente d'acceptation par l'hôte
      pending: ['joueur-demo'],
    },
    {
      id: 'demo-room-domicile',
      hostId: 'demo-jade',
      gameId: boardGames.id,
      mode: 'CASUAL' as const,
      atHome: true,
      homeAreaLabel: 'Bordeaux · Saint-Michel',
      // Zone floue seulement : pas d'adresse chiffrée dans le seed (« je la donnerai dans le chat »)
      fuzzyLat: 44.8327,
      fuzzyLng: -0.5672,
      startsAt: daysLater(3, 20, 0),
      capacity: 5,
      description: 'Soirée Cascadia et Azul, débutants bienvenus.',
      players: ['demo-jade', 'demo-hugo'],
    },
    {
      id: 'demo-room-pioneer',
      hostId: 'demo-alix',
      gameId: pioneer.gameId,
      formatId: pioneer.id,
      mode: 'RANKED' as const,
      venueId: shop.id,
      startsAt: daysLater(2, 18, 0),
      capacity: 2,
      status: 'FULL' as const,
      players: ['demo-alix', 'demo-ines'],
    },
    // Passées
    {
      id: 'demo-room-passee-commander',
      hostId: 'joueur-demo',
      gameId: commander.gameId,
      formatId: commander.id,
      mode: 'RANKED' as const,
      status: 'FINISHED' as const,
      venueId: bar.id,
      startsAt: daysAgo(3, 20, 0),
      capacity: 4,
      players: ['joueur-demo', 'demo-theo', 'demo-alix', 'demo-jade'],
    },
    {
      id: 'demo-room-passee-jeux',
      hostId: 'demo-maya',
      gameId: boardGames.id,
      mode: 'CASUAL' as const,
      status: 'FINISHED' as const,
      venueId: bar.id,
      startsAt: daysAgo(12, 19, 30),
      capacity: 6,
      players: ['demo-maya', 'joueur-demo', 'demo-sam'],
    },
    {
      id: 'demo-room-passee-pokemon',
      hostId: 'demo-sam',
      gameId: pokemon.gameId,
      formatId: pokemon.id,
      mode: 'RANKED' as const,
      status: 'FINISHED' as const,
      venueId: pixel.id,
      startsAt: daysAgo(18, 20, 0),
      capacity: 2,
      players: ['demo-sam', 'joueur-demo'],
    },
  ]
  for (const { players, pending = [], ...room } of rooms) {
    await prisma.room.upsert({ where: { id: room.id }, update: room, create: room })
    for (const [userId, status] of [
      ...players.map((id) => [id, 'ACCEPTED'] as const),
      ...pending.map((id) => [id, 'PENDING'] as const),
    ]) {
      await prisma.roomParticipant.upsert({
        where: { roomId_userId: { roomId: room.id, userId } },
        update: { status },
        create: { roomId: room.id, userId, status },
      })
    }
  }

  // ---------- Back-office admin (LKO-20) ----------

  // Lieu proposé, en attente de validation : absent d'Explorer tant qu'un admin ne l'a pas publié
  await upsertVenue(
    {
      slug: 'taverne-des-des-demo',
      name: 'La Taverne des Dés',
      type: 'GAME_BAR',
      status: 'PENDING',
      address: '21 cours de la Somme',
      city: 'Bordeaux',
      latitude: 44.8268,
      longitude: -0.5701,
      description: 'Bar à jeux proposé par un joueur, à vérifier.',
    },
    ['jeux-de-societe'],
    tuesdayToSaturday(18 * 60, 1 * 60),
  )
  // Photo de profil à valider
  await prisma.user.update({
    where: { id: 'demo-jade' },
    data: { avatarUrl: 'https://picsum.photos/seed/lucko-jade/400/400', avatarStatus: 'PENDING' },
  })
  // Doublon de Magic à fusionner, avec un joueur et un profil Commander
  const duplicate = await prisma.game.upsert({
    where: { slug: 'mtg-demo' },
    update: {},
    create: { slug: 'mtg-demo', name: 'MTG', kind: 'TCG' },
  })
  const duplicateCommander = await prisma.gameFormat.upsert({
    where: { gameId_slug: { gameId: duplicate.id, slug: 'commander' } },
    update: {},
    create: { slug: 'commander', name: 'Commander', gameId: duplicate.id, maxPlayers: 5 },
  })
  await prisma.user.update({
    where: { id: 'demo-hugo' },
    data: { playedGames: { connect: { id: duplicate.id } } },
  })
  await prisma.playerGameProfile.upsert({
    where: { userId_formatId: { userId: 'demo-hugo', formatId: duplicateCommander.id } },
    update: {},
    create: { userId: 'demo-hugo', formatId: duplicateCommander.id, rating: 1090, rankedGames: 6 },
  })
  // Signalements ouverts, dont un sur un mineur (en tête de file)
  for (const report of [
    {
      id: 'demo-signalement-mineur',
      reporterId: 'demo-hugo',
      targetId: 'mineur-demo',
      reason: 'INAPPROPRIATE_CONTENT' as const,
      details: 'Pseudo limite dans le chat de la room.',
    },
    {
      id: 'demo-signalement-noah',
      reporterId: 'joueur-demo',
      targetId: 'demo-noah',
      reason: 'HARASSMENT' as const,
      details: 'Insultes après la partie de Lorcana.',
    },
  ]) {
    await prisma.report.upsert({
      where: { id: report.id },
      update: { resolvedAt: null, resolution: null },
      create: report,
    })
  }

  console.log('Seed terminé')
  console.log('Comptes de test (e-mail / mot de passe) :')
  for (const { email, password, role } of accounts.filter((a) => a.password)) {
    console.log(`  ${email.padEnd(22)} ${password?.padEnd(13)} ${role ?? 'PLAYER'}`)
  }
}

type VenueData = Parameters<typeof prisma.venue.create>[0]['data'] & { slug: string }
type Hours = { weekday: number; opensAtMinute: number; closesAtMinute: number }
type Closure = {
  startsOn: Date
  endsOn?: Date
  kind?: 'CLOSED' | 'SPECIAL_HOURS'
  label: string
  note?: string
  opensAtMinute?: number
  closesAtMinute?: number
}

/** Crée ou met à jour un lieu, ses jeux sur place, horaires, photos et fermetures (remplacés à chaque seed). */
async function upsertVenue(
  data: VenueData,
  gameSlugs: string[],
  hours: Hours[],
  {
    photos = [],
    closures = [],
  }: { photos?: { url: string; caption: string; order: number }[]; closures?: Closure[] } = {},
) {
  const games = gameSlugs.map((slug) => ({ slug }))
  const venue = await prisma.venue.upsert({
    where: { slug: data.slug },
    update: { ...data, games: { set: games } },
    create: { ...data, games: { connect: games } },
  })
  await prisma.venueOpeningHours.deleteMany({ where: { venueId: venue.id } })
  await prisma.venueOpeningHours.createMany({
    data: hours.map((h) => ({ ...h, venueId: venue.id })),
  })
  await prisma.venuePhoto.deleteMany({ where: { venueId: venue.id } })
  await prisma.venuePhoto.createMany({ data: photos.map((p) => ({ ...p, venueId: venue.id })) })
  await prisma.venueClosure.deleteMany({ where: { venueId: venue.id } })
  await prisma.venueClosure.createMany({
    data: closures.map((c) => ({
      ...c,
      startsOn: localDate(c.startsOn),
      endsOn: localDate(c.endsOn ?? c.startsOn),
      venueId: venue.id,
    })),
  })
  return venue
}

/** Prochain jour ISO `weekday` (1 = lundi) à hh:mm, décalé de `weeksLater` semaines. Heure locale de la machine. */
function nextWeekday(weekday: number, hours: number, minutes: number, weeksLater: number) {
  const date = new Date()
  const today = date.getDay() || 7
  date.setDate(date.getDate() + ((weekday - today + 7) % 7 || 7) + weeksLater * 7)
  date.setHours(hours, minutes, 0, 0)
  return date
}

function daysLater(days: number, hours: number, minutes: number) {
  const date = today(hours, minutes)
  date.setDate(date.getDate() + days)
  return date
}

function daysAgo(days: number, hours: number, minutes: number) {
  return daysLater(-days, hours, minutes)
}

/** Colonne `@db.Date` : la date locale de la machine, à minuit UTC. */
function localDate(date: Date) {
  return new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
}

function today(hours: number, minutes: number) {
  const date = new Date()
  date.setHours(hours, minutes, 0, 0)
  return date
}

function yearsAgo(years: number) {
  const date = new Date()
  date.setFullYear(date.getFullYear() - years)
  return new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
