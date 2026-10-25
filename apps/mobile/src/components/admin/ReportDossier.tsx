import {
  Avatar,
  Button,
  DecisionCard,
  DetailCard,
  Quote,
  ReasonForm,
  SkeletonCard,
  StatStrip,
  Tag,
  Typography,
} from '@lucko/design-system'
import {
  type AdminReport,
  REPORT_REASON_LABELS,
  REPORT_RESOLUTIONS,
  type ReportResolution,
} from '@lucko/shared'
import { useState } from 'react'
import { View } from 'react-native'
import {
  DECISIONS,
  dateTime,
  dossierStats,
  openAdminUser,
  SUSPENSION_DURATIONS,
  suspensionDays,
} from '@/lib/admin'
import { shortDay } from '@/lib/explore'
import { openEvent } from '@/lib/navigation'
import { useAdminModerationMutations, useAdminUserQuery } from '@/queries/useAdminModeration'

/** Dossier d'un signalement : le joueur visé, ses antécédents, le motif et la décision. */
export function ReportDossier({ report, onDone }: { report: AdminReport; onDone: () => void }) {
  const user = useAdminUserQuery(report.target.id).data
  const { resolveReport } = useAdminModerationMutations()
  const [choice, setChoice] = useState<ReportResolution | null>(null)
  const decision = choice ? DECISIONS[choice] : null
  const pseudo = report.target.pseudo ?? 'Compte supprimé'

  return (
    <DetailCard
      sections={[
        {
          key: 'who',
          children: (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
              <Avatar
                name={pseudo}
                uri={user?.avatarStatus === 'APPROVED' ? user.avatarUrl : null}
                size={56}
              />
              <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Typography variant="h2">{pseudo}</Typography>
                  {report.target.minor ? <Tag label="-18" variant="alert" /> : null}
                </View>
                {user ? (
                  <Typography variant="small">
                    {report.event ? 'Organisateur de l’événement · ' : ''}
                    {user.email} · inscrit le {shortDay(user.createdAt)}
                  </Typography>
                ) : null}
              </View>
              <Button
                small
                kind="ghost"
                label="Fiche joueur"
                onPress={() => openAdminUser(report.target.id)}
              />
            </View>
          ),
        },
        {
          key: 'stats',
          flush: true,
          children: user ? <StatStrip items={dossierStats(user)} /> : <SkeletonCard />,
        },
        {
          key: 'reason',
          children: (
            <>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
                <Typography variant="title">{REPORT_REASON_LABELS[report.reason]}</Typography>
                <Typography variant="number" weight={400}>
                  {dateTime(report.createdAt)}
                </Typography>
              </View>
              <Typography variant="small">
                Signalé par {report.reporter.pseudo ?? 'un compte supprimé'}
              </Typography>
              {report.details ? <Quote text={report.details} /> : null}
            </>
          ),
        },
        ...(report.event
          ? [
              {
                key: 'event',
                label: 'Événement signalé',
                children: <ReportedEvent event={report.event} />,
              },
            ]
          : []),
        {
          key: 'decision',
          label: 'Décision',
          children: (
            <>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {REPORT_RESOLUTIONS.map((r) => (
                  <DecisionCard
                    key={r}
                    title={DECISIONS[r].title}
                    description={DECISIONS[r].description}
                    color={DECISIONS[r].color}
                    selected={choice === r}
                    onPress={() => {
                      resolveReport.reset()
                      setChoice(r)
                    }}
                  />
                ))}
              </View>
              {choice && decision ? (
                <ReasonForm
                  key={`${report.id}-${choice}`}
                  label={decision.field}
                  placeholder={decision.placeholder}
                  optional={decision.optional}
                  durations={decision.duration ? SUSPENSION_DURATIONS : undefined}
                  initialDuration="7"
                  consequence={decision.consequence}
                  confirmLabel={decision.confirm}
                  confirmKind={decision.confirmKind}
                  busy={resolveReport.isPending}
                  error={resolveReport.error?.message}
                  onCancel={() => setChoice(null)}
                  onConfirm={({ text, duration }) =>
                    resolveReport.mutate(
                      choice === 'SUSPENDED'
                        ? {
                            id: report.id,
                            resolution: choice,
                            reason: text,
                            days: suspensionDays(duration ?? ''),
                          }
                        : { id: report.id, resolution: choice, reason: text },
                      {
                        onSuccess: () => {
                          setChoice(null)
                          onDone()
                        },
                      },
                    )
                  }
                />
              ) : null}
            </>
          ),
        },
      ]}
    />
  )
}

/** Événement signalé (LKO-153) : lequel, et le masquer de l'app avec un motif (journal d'audit). */
function ReportedEvent({ event }: { event: NonNullable<AdminReport['event']> }) {
  const { hideEvent } = useAdminModerationMutations()
  const [hiding, setHiding] = useState(false)
  const hidden = event.status === 'HIDDEN'
  return (
    <View style={{ gap: 10 }}>
      <View style={{ gap: 2 }}>
        <Typography variant="title">{event.title}</Typography>
        <Typography variant="small">
          {`${event.venueName} · ${dateTime(event.startsAt)}${hidden ? ' · masqué' : ''}`}
        </Typography>
      </View>
      {hiding ? (
        <ReasonForm
          label="Masquer l’événement : pourquoi ?"
          placeholder="Ex. contenu trompeur, lieu inexistant"
          consequence="Il disparaît de l’app ; les inscrits sont prévenus comme d’une annulation."
          confirmLabel="Masquer"
          confirmKind="danger"
          busy={hideEvent.isPending}
          error={hideEvent.error?.message}
          onCancel={() => setHiding(false)}
          onConfirm={({ text }) =>
            hideEvent.mutate({ id: event.id, reason: text }, { onSuccess: () => setHiding(false) })
          }
        />
      ) : (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          <Button small kind="ghost" label="Voir l’événement" onPress={() => openEvent(event.id)} />
          {hidden ? null : (
            <Button
              small
              kind="danger"
              label="Masquer l’événement"
              onPress={() => setHiding(true)}
            />
          )}
        </View>
      )}
    </View>
  )
}
