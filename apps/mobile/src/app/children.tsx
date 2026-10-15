import {
  Banner,
  Button,
  ConfirmDialog,
  colors,
  EmptyState,
  ListRow,
  Note,
  PageTitle,
  Panel,
  ScreenHeader,
  SkeletonCard,
  StatusPill,
  Typography,
} from '@lucko/design-system'
import type { ChildActivity } from '@lucko/shared'
import { router } from 'expo-router'
import { Users } from 'lucide-react-native'
import { useState } from 'react'
import { useWindowDimensions, View } from 'react-native'
import { PlayerScreen } from '@/components/PlayerScreen'
import {
  childEventRow,
  childName,
  childReportRow,
  childRoomRow,
  childSummary,
} from '@/lib/children'
import { useMeQuery } from '@/queries/useMe'
import { useChildrenQuery, useWithdrawConsentMutation } from '@/queries/useParentalConsent'

const WIDE = 900

const backToSettings = () => (router.canGoBack() ? router.back() : router.replace('/settings'))

/**
 * Réglages → Mes enfants (LKO-49) : activité des enfants liés de moins de 15 ans (parties, soirées,
 * signalements, jamais leurs messages) et retrait de l'accord parental.
 */
export default function ChildrenScreen() {
  const wide = useWindowDimensions().width >= WIDE
  useMeQuery({ required: true })
  const children = useChildrenQuery()
  const withdraw = useWithdrawConsentMutation()
  const [confirm, setConfirm] = useState<ChildActivity | null>(null)

  const content = !children.data ? (
    children.isError ? (
      <Banner
        tone="err"
        message="Impossible de charger l’activité de tes enfants."
        action="Réessayer"
        onAction={() => void children.refetch()}
      />
    ) : (
      <SkeletonCard />
    )
  ) : children.data.length === 0 ? (
    <EmptyState
      dashed
      icon={<Users size={28} color={colors.ink} strokeWidth={2.5} />}
      title="Aucun enfant lié"
      text="Quand tu donnes ton accord depuis l’e-mail reçu, le compte de ton enfant apparaît ici."
    />
  ) : (
    <View style={{ gap: 20 }}>
      {withdraw.isError ? <Banner tone="err" message={withdraw.error.message} /> : null}
      {children.data.map((child) => (
        <Child key={child.id} child={child} onWithdraw={() => setConfirm(child)} />
      ))}
    </View>
  )

  return (
    <PlayerScreen
      tab="profil"
      wide={wide}
      pushed
      header={<ScreenHeader title="Mes enfants" onBack={backToSettings} />}
    >
      {wide ? (
        <View style={{ width: '100%', maxWidth: 720, alignSelf: 'center', gap: 20 }}>
          <PageTitle title="Mes enfants" />
          {content}
        </View>
      ) : (
        content
      )}
      <ConfirmDialog
        visible={confirm !== null}
        sheet={!wide}
        title="Retirer ton accord ?"
        message={`Le compte de ${confirm ? childName(confirm) : 'ton enfant'} et ses données seront supprimés tout de suite. Il ou elle sera prévenu·e par e-mail.`}
        confirmLabel="Retirer et supprimer"
        cancelLabel="Annuler"
        onConfirm={() => {
          if (confirm) withdraw.mutate(confirm.id)
          setConfirm(null)
        }}
        onCancel={() => setConfirm(null)}
      />
    </PlayerScreen>
  )
}

function Child({ child, onWithdraw }: { child: ChildActivity; onWithdraw: () => void }) {
  return (
    <Panel title={childName(child)}>
      <Typography variant="small">{childSummary(child)}</Typography>
      {child.autonomous ? (
        <Note>
          À 15 ans, son compte est autonome : tu ne vois plus son activité. Les protections des
          mineurs restent actives jusqu’à ses 18 ans.
        </Note>
      ) : (
        <>
          <Rows
            title="Parties"
            empty="Aucune partie pour l’instant."
            rows={child.rooms.map(childRoomRow)}
          />
          <Rows
            title="Soirées"
            empty="Aucune soirée pour l’instant."
            rows={child.events.map(childEventRow)}
          />
          <Rows
            title="Signalements"
            empty="Aucun signalement."
            rows={child.reports.map(childReportRow)}
          />
          <Typography variant="small">Ses messages restent privés : tu ne les vois pas.</Typography>
          <View style={{ alignSelf: 'flex-start' }}>
            <Button small kind="ghost" label="Retirer mon accord" onPress={onWithdraw} />
          </View>
        </>
      )}
    </Panel>
  )
}

function Rows({
  title,
  empty,
  rows,
}: {
  title: string
  empty: string
  rows: ReturnType<typeof childRoomRow>[]
}) {
  return (
    <View style={{ gap: 6 }}>
      <Typography variant="title">{title}</Typography>
      {rows.length === 0 ? (
        <Typography variant="small">{empty}</Typography>
      ) : (
        <View>
          {rows.map((row, i) => (
            <ListRow
              key={`${row.title}-${row.subtitle}`}
              title={row.title}
              subtitle={row.subtitle}
              last={i === rows.length - 1}
              right={row.status ? <StatusPill {...row.status} /> : undefined}
            />
          ))}
        </View>
      )}
    </View>
  )
}
