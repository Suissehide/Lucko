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
import { GameForm } from '@/components/admin/GameForm'
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
 * Catalogue des jeux : ajouter ou modifier un jeu, ou fusionner un doublon dans le bon jeu. Formats, profils (LK), rooms,
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
  const [editingId, setEditingId] = useState<string | null>(null)
  const all = games.data ?? []
  const openId = mergingId ?? editingId
  const opened = all.find((g) => g.id === openId)

  const open = (game: AdminGame) => {
    mergeGames.reset()
    setEditingId(null)
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
    // Colonnes fixes resserrées : à 1024 px, la barre latérale ne laisse que ~700 px au tableau
    count('rooms', 'Rooms', 60),
    count('events', 'Événem.', 70),
    count('players', 'Joueurs', 65),
    {
      key: 'merge',
      label: '',
      width: 120,
      align: 'right',
      render: (g) => (
        <View style={{ alignItems: 'flex-end', gap: 6 }}>
          <Button
            small
            kind={editingId === g.id ? 'rating' : 'ghost'}
            label="Modifier"
            onPress={() => {
              setMergingId(null)
              setNotice(null)
              setEditingId(editingId === g.id ? null : g.id)
            }}
          />
          <Button
            small
            kind={mergingId === g.id ? 'rating' : 'ghost'}
            label="Fusionner…"
            onPress={() => open(g)}
          />
        </View>
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

  const editPanel = (game: AdminGame) => (
    <GameForm
      key={game.id}
      game={game}
      onCancel={() => setEditingId(null)}
      onDeleted={() => {
        setNotice(`« ${game.name} » a été supprimé du catalogue.`)
        setEditingId(null)
      }}
      onDone={(saved) => {
        setNotice(`« ${saved.name} » a été modifié.`)
        setEditingId(null)
      }}
    />
  )
  const panel = (g: AdminGame) =>
    g.id === mergingId ? mergePanel(g) : g.id === editingId ? editPanel(g) : null

  return (
    <AdminScreen
      section="games"
      note="Ajoute ou modifie un jeu avec ses formats, ou fusionne les doublons : les rooms, événements et profils de jeu sont déplacés vers le jeu cible."
    >
      {notice ? <Banner tone="ok" message={notice} /> : null}
      {adding ? (
        <GameForm
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
          selected={openId ? [openId] : []}
          expanded={panel}
          mobileCards={narrow}
          primary="name"
          cardKeys={['formats', 'merge']}
        />
      )}
      {narrow && opened ? panel(opened) : null}
    </AdminScreen>
  )
}
