import {
  Banner,
  colors,
  EmptyState,
  LevelCard,
  ListCard,
  ListRow,
  PageTitle,
  Section,
  SkeletonCard,
  StatusPill,
} from '@lucko/design-system'
import {
  formatDayMonth,
  XP_BONUS_LABELS,
  XP_LEVEL_NAMES,
  XP_PARTNER_BONUS,
  XP_PER_LEVEL,
  XP_PER_PRESENCE,
  XP_ROOMS_PER_EVENING,
} from '@lucko/shared'
import { Sparkles } from 'lucide-react-native'
import { DetailScreen } from '@/components/DetailScreen'
import { useMeQuery } from '@/queries/useMe'
import { useMyXpQuery } from '@/queries/useXp'

/**
 * Mon XP (LKO-89, archi §14) : niveau nommé, derniers gains et paliers. L'XP récompense la présence,
 * pas la victoire : même barème pour les jeux de société et les TCG, normal ou classé.
 */
export default function XpScreen() {
  useMeQuery({ required: true })
  const xp = useMyXpQuery()
  const data = xp.data

  return (
    <DetailScreen title="Mon XP">
      <PageTitle eyebrow="Profil" title="Mon XP" />
      {xp.isError ? (
        <Banner
          tone="err"
          message={xp.error.message}
          action="Réessayer"
          onAction={() => void xp.refetch()}
        />
      ) : !data ? (
        <SkeletonCard />
      ) : (
        <>
          <LevelCard level={data.level} name={data.name} current={data.current} max={data.max} />

          <Section title="Derniers gains">
            {data.recent.length === 0 ? (
              <EmptyState
                dashed
                icon={<Sparkles size={28} color={colors.ink} strokeWidth={2.5} />}
                title="Pas encore d’XP"
                text="Viens jouer : ta présence, scannée au comptoir ou pointée par l’hôte, te rapporte de l’XP."
              />
            ) : (
              <ListCard>
                {data.recent.map((gain, i) => {
                  const { day, month } = formatDayMonth(gain.createdAt)
                  return (
                    <ListRow
                      key={gain.id}
                      inset={16}
                      last={i === data.recent.length - 1}
                      title={`+${gain.amount} XP · ${gain.label}`}
                      subtitle={`${day} ${month}`}
                      right={
                        gain.bonuses.length ? (
                          <StatusPill
                            tone="ok"
                            label={gain.bonuses.map((b) => XP_BONUS_LABELS[b]).join(', ')}
                          />
                        ) : null
                      }
                    />
                  )
                })}
              </ListCard>
            )}
          </Section>

          <Section title="Comment gagner de l’XP">
            <ListCard>
              <ListRow
                inset={16}
                title={`+${XP_PER_PRESENCE} XP par room où tu étais là`}
                subtitle="Même XP pour tous les jeux, gagnant ou non"
              />
              <ListRow
                inset={16}
                title={`+${XP_PARTNER_BONUS} XP dans un lieu partenaire`}
                subtitle="Quand ta venue y est enregistrée (scan ou pointage)"
              />
              <ListRow
                inset={16}
                last
                title={`${XP_ROOMS_PER_EVENING} rooms comptées par soirée au plus`}
              />
            </ListCard>
          </Section>

          <Section title="Les niveaux">
            <ListCard>
              {XP_LEVEL_NAMES.map((name, i) => (
                <ListRow
                  key={name}
                  inset={16}
                  last={i === XP_LEVEL_NAMES.length - 1}
                  selected={Math.min(data.level, XP_LEVEL_NAMES.length) === i + 1}
                  title={`Niveau ${i + 1}${i === XP_LEVEL_NAMES.length - 1 ? ' et plus' : ''} · ${name}`}
                  subtitle={`À partir de ${i * XP_PER_LEVEL} XP`}
                />
              ))}
            </ListCard>
          </Section>
        </>
      )}
    </DetailScreen>
  )
}
