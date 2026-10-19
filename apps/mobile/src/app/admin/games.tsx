import {
  Banner,
  Button,
  Chip,
  type Column,
  colors,
  DataTable,
  Inset,
  SkeletonCard,
  Tag,
  Typography,
} from '@lucko/design-system'
import type { AdminGame } from '@lucko/shared'
import { Plus } from 'lucide-react-native'
import { useState } from 'react'
import { useWindowDimensions, View } from 'react-native'
import { AdminScreen } from '@/components/admin/AdminScreen'
import { NewGame } from '@/components/admin/NewGame'
import { duplicateOf, mergeSummary } from '@/lib/admin'
import { useAdminCatalogMutations, useAdminGamesQuery } from '@/queries/useAdminCatalog'

const NARROW = 768

const count = (key: 'rooms' | 'events' | 'players', label: string, width: number) =>
  ({
    key,
    label,
    width,
    align: 'right',
    render: (g) => (
      <Typography variant="number" style={{ color: g[key] ? colors.ink : colors.inkMuted }}>
        {g[key]}
      </Typography>
    ),
  }) satisfies Column<AdminGame>

/**
 * Catalogue des jeux : ajouter un jeu, ou fusionner un doublon dans le bon jeu. Formats, profils (LK), rooms,
 * événements, lieux et joueurs passent au jeu cible, puis le doublon est supprimé.
 */
export default function AdminGamesScreen() {
  const narrow = useWindowDimensions().width < NARROW
  const games = useAdminGamesQuery()
  const { mergeGames } = useAdminCatalogMutations()
  const [mergingId, setMergingId] = useState<string | null>(null)
  const [intoId, setIntoId] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const all = games.data ?? []
  const merging = all.find((g) => g.id === mergingId)

  const open = (game: AdminGame) => {
    mergeGames.reset()
    setMergingId(mergingId === game.id ? null : game.id)
    setIntoId(duplicateOf(game, all)?.id ?? null)
  }

  const columns: Column<AdminGame>[] = [
    {
      key: 'name',
      label: 'Jeu',
      flex: 1.3,
      render: (g) => (
        <View style={{ gap: 2 }}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
            <Typography variant="title" style={{ fontSize: 15 }}>
              {g.name}
            </Typography>
            {duplicateOf(g, all) ? <Tag label="Doublon ?" variant="tonight" /> : null}
          </View>
          <Typography variant="number" weight={400} style={{ fontSize: 12 }}>
            {g.slug}
          </Typography>
        </View>
      ),
    },
    {
      key: 'formats',
      label: 'Formats',
      flex: 1.6,
      render: (g) => (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
          {g.formats.map((f) => (
            <Chip key={f.id} label={f.name} />
          ))}
        </View>
      ),
    },
    count('rooms', 'Rooms', 70),
    count('events', 'Événem.', 90),
    count('players', 'Joueurs', 80),
    {
      key: 'merge',
      label: '',
      width: 180,
      align: 'right',
      render: (g) => (
        <Button
          small
          kind={mergingId === g.id ? 'rating' : 'ghost'}
          label="Fusionner dans…"
          onPress={() => open(g)}
        />
      ),
    },
  ]

  const mergePanel = (source: AdminGame) => {
    const target = all.find((g) => g.id === intoId)
    return (
      <Inset>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
          <Typography variant="title" style={{ fontSize: 14 }}>
            Fusionner « {source.name} » dans
          </Typography>
          {all
            .filter((g) => g.id !== source.id)
            .map((g) => (
              <Chip
                key={g.id}
                label={g.name}
                active={g.id === intoId}
                onPress={() => setIntoId(g.id)}
              />
            ))}
        </View>
        {target ? (
          <View style={{ gap: 4 }}>
            {mergeSummary(source, target).map((line) => (
              <Typography key={line} variant="small" style={{ color: colors.ink }}>
                · {line}
              </Typography>
            ))}
            <Typography variant="small" weight={800} style={{ color: colors.room }}>
              « {source.name} » sera supprimé. Cette action est définitive.
            </Typography>
          </View>
        ) : null}
        {mergeGames.isError ? <Banner tone="err" message={mergeGames.error.message} /> : null}
        <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 8 }}>
          <Button small kind="ghost" label="Annuler" onPress={() => setMergingId(null)} />
          <Button
            small
            kind="room"
            label="Fusionner"
            disabled={!target || mergeGames.isPending}
            onPress={() =>
              target &&
              mergeGames.mutate(
                { id: source.id, intoId: target.id },
                {
                  onSuccess: () => {
                    setNotice(`« ${source.name} » a été fusionné dans « ${target.name} ».`)
                    setMergingId(null)
                  },
                },
              )
            }
          />
        </View>
      </Inset>
    )
  }

  return (
    <AdminScreen
      section="games"
      note="Ajoute un jeu avec ses formats, ou fusionne les doublons : les rooms, événements et profils de jeu sont déplacés vers le jeu cible."
    >
      {notice ? <Banner tone="ok" message={notice} /> : null}
      {adding ? (
        <NewGame
          onCancel={() => setAdding(false)}
          onDone={(game) => {
            setNotice(`« ${game.name} » a été ajouté au catalogue.`)
            setAdding(false)
          }}
        />
      ) : (
        <View style={{ flexDirection: 'row' }}>
          <Button
            small
            kind="venue"
            icon={Plus}
            label="Ajouter un jeu"
            onPress={() => {
              setNotice(null)
              setAdding(true)
            }}
          />
        </View>
      )}
      {games.isError ? (
        <Banner tone="err" message={games.error.message} />
      ) : !games.data ? (
        <SkeletonCard />
      ) : (
        <DataTable
          columns={columns}
          rows={all}
          selected={mergingId ? [mergingId] : []}
          expanded={(g) => (g.id === mergingId ? mergePanel(g) : null)}
          mobileCards={narrow}
          primary="name"
          cardKeys={['formats', 'merge']}
        />
      )}
      {narrow && merging ? mergePanel(merging) : null}
    </AdminScreen>
  )
}
