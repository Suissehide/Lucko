import {
  Banner,
  Chip,
  type Column,
  colors,
  DataTable,
  EmptyState,
  Inset,
  StatusPill,
  TextField,
  TextLink,
  Typography,
} from '@lucko/design-system'
import {
  type AdminFeedback as AdminFeedbackItem,
  FEEDBACK_CATEGORIES,
  FEEDBACK_STATUS_LABELS,
  FEEDBACK_STATUSES,
  type FeedbackCategory,
  type FeedbackStatus,
  updateFeedbackSchema,
} from '@lucko/shared'
import { Inbox, Search } from 'lucide-react-native'
import { useState } from 'react'
import { useWindowDimensions, View } from 'react-native'
import { useAppForm } from '@/hooks/formConfig'
import {
  dateTime,
  FEEDBACK_CATEGORY_SHORT,
  FEEDBACK_STATUS_TONE,
  feedbackAuthor,
  feedbackContext,
  openAdminUser,
} from '@/lib/admin'
import { useAdminFeedbackMutations, useAdminFeedbackQuery } from '@/queries/useAdminFeedback'
import { AdminScreen } from './AdminScreen'

const NARROW = 768

const columns: Column<AdminFeedbackItem>[] = [
  {
    key: 'category',
    label: 'Type',
    width: 80,
    render: (f) => (
      <Typography variant="small" weight={700} style={{ color: colors.ink }}>
        {FEEDBACK_CATEGORY_SHORT[f.category]}
      </Typography>
    ),
  },
  {
    key: 'message',
    label: 'Message',
    flex: 3,
    render: (f) => (
      <Typography variant="small" numberOfLines={2} style={{ color: colors.ink }}>
        {f.message}
      </Typography>
    ),
  },
  {
    key: 'author',
    label: 'Auteur',
    flex: 1,
    render: (f) => (
      <Typography
        variant="small"
        numberOfLines={1}
        style={{ color: f.author.deleted ? colors.inkMuted : colors.ink }}
      >
        {feedbackAuthor(f)}
      </Typography>
    ),
  },
  {
    key: 'status',
    label: 'Statut',
    width: 120,
    render: (f) => (
      <StatusPill label={FEEDBACK_STATUS_LABELS[f.status]} tone={FEEDBACK_STATUS_TONE[f.status]} />
    ),
  },
  {
    key: 'createdAt',
    label: 'Reçu',
    width: 150,
    render: (f) => (
      <Typography variant="number" weight={400} style={{ fontSize: 12 }}>
        {dateTime(f.createdAt)}
      </Typography>
    ),
  },
]

/** Détail d'un retour : message complet, auteur, contexte, statut et note interne. */
function FeedbackPanel({ feedback }: { feedback: AdminFeedbackItem }) {
  const { update } = useAdminFeedbackMutations()
  const form = useAppForm({
    defaultValues: { adminNote: feedback.adminNote },
    onSubmit: async ({ value, formApi }) => {
      try {
        const saved = await update.mutateAsync({ id: feedback.id, adminNote: value.adminNote })
        formApi.reset({ adminNote: saved.adminNote })
      } catch (error) {
        formApi.setErrorMap({
          onSubmit: { form: (error as Error).message, fields: {} },
        })
      }
    },
  })

  return (
    <Inset>
      <Typography style={{ color: colors.ink }}>{feedback.message}</Typography>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
        {feedback.author.deleted ? (
          <Typography variant="small" style={{ color: colors.inkMuted }}>
            Compte supprimé
          </Typography>
        ) : (
          <TextLink
            label={feedbackAuthor(feedback)}
            onPress={() => openAdminUser(feedback.author.id)}
          />
        )}
        {feedback.author.email && feedback.author.pseudo ? (
          <Typography variant="small" style={{ color: colors.muted }}>
            {feedback.author.email}
          </Typography>
        ) : null}
        <Typography variant="small" style={{ color: colors.muted }}>
          {feedbackContext(feedback)}
        </Typography>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        {FEEDBACK_STATUSES.map((status) => (
          <Chip
            key={status}
            label={FEEDBACK_STATUS_LABELS[status]}
            active={feedback.status === status}
            onPress={() => feedback.status !== status && update.mutate({ id: feedback.id, status })}
          />
        ))}
      </View>
      {update.isError ? <Banner tone="err" message={update.error.message} /> : null}
      <form.AppField
        name="adminNote"
        validators={{ onSubmit: updateFeedbackSchema.shape.adminNote.unwrap() }}
      >
        {(field) => (
          <field.Text
            label="Note interne"
            placeholder="Ticket Notion, correctif, réponse envoyée…"
            multiline
            maxLength={2000}
          />
        )}
      </form.AppField>
      <form.AppForm>
        <form.FormError />
        <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
          <form.SubmitButton label="Enregistrer la note" />
        </View>
      </form.AppForm>
    </Inset>
  )
}

/** Retours utilisateurs (LKO-166) : recherche, filtres par statut et catégorie, détail en dépliant une ligne. */
export function AdminFeedback() {
  const narrow = useWindowDimensions().width < NARROW
  const [q, setQ] = useState('')
  const [status, setStatus] = useState<FeedbackStatus | undefined>('NEW')
  const [category, setCategory] = useState<FeedbackCategory | undefined>()
  const [openId, setOpenId] = useState<string | null>(null)
  const feedback = useAdminFeedbackQuery({ q: q.trim(), status, category })
  const data = feedback.data
  const counts = data?.counts
  const opened = data?.items.find((f) => f.id === openId)
  const truncated = data ? data.matching > data.items.length : false
  const toggle = (f: AdminFeedbackItem) => setOpenId((id) => (id === f.id ? null : f.id))
  const panel = (f: AdminFeedbackItem) =>
    f.id === openId ? <FeedbackPanel key={f.id} feedback={f} /> : null

  return (
    <AdminScreen
      section="feedback"
      note="Bugs et idées envoyés depuis l’app par les joueurs et les lieux. Déplie un retour pour changer son statut ou noter ce qui a été fait."
    >
      <View style={{ gap: 14 }}>
        <TextField
          placeholder="Rechercher dans les messages, les notes ou les auteurs"
          value={q}
          onChangeText={setQ}
          autoCapitalize="none"
          right={<Search size={18} color={colors.muted} strokeWidth={2.5} />}
        />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          <Chip
            label="À suivre"
            count={
              counts
                ? (counts.NEW ?? 0) + (counts.IN_PROGRESS ?? 0) + (counts.DONE ?? 0)
                : undefined
            }
            active={status === undefined}
            onPress={() => setStatus(undefined)}
          />
          {FEEDBACK_STATUSES.map((s) => (
            <Chip
              key={s}
              label={FEEDBACK_STATUS_LABELS[s]}
              count={counts?.[s]}
              active={status === s}
              onPress={() => setStatus(s)}
            />
          ))}
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          <Chip
            label="Tous les types"
            active={category === undefined}
            onPress={() => setCategory(undefined)}
          />
          {FEEDBACK_CATEGORIES.map((c) => (
            <Chip
              key={c}
              label={FEEDBACK_CATEGORY_SHORT[c]}
              active={category === c}
              onPress={() => setCategory(c)}
            />
          ))}
        </View>
        <Typography variant="small" style={{ color: colors.muted }}>
          {data
            ? `${data.matching} retour${data.matching > 1 ? 's' : ''} pour ces filtres${
                truncated ? ` (les ${data.items.length} plus récents affichés)` : ''
              }`
            : ' '}
        </Typography>
        {feedback.isError ? (
          <Banner tone="err" message={feedback.error.message} />
        ) : (
          <DataTable
            columns={columns}
            rows={data?.items ?? []}
            loading={!data}
            selected={openId ? [openId] : []}
            onRowPress={toggle}
            expanded={panel}
            mobileCards={narrow}
            primary="message"
            cardKeys={['category', 'author', 'status', 'createdAt']}
            empty={
              <EmptyState
                dashed
                icon={<Inbox size={28} color={colors.ink} strokeWidth={2.5} />}
                title="Aucun retour"
                text={
                  status === 'NEW' && !q && !category
                    ? 'Rien de nouveau : les retours envoyés depuis l’app apparaîtront ici.'
                    : 'Aucun retour ne correspond à ces filtres.'
                }
              />
            }
          />
        )}
        {narrow && opened ? panel(opened) : null}
      </View>
    </AdminScreen>
  )
}
