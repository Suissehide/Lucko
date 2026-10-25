import {
  AvailabilityGrid,
  Button,
  type ButtonKind,
  border,
  Chip,
  colors,
  font,
  ListCard,
  ListRow,
  Note,
  OptionCard,
  radius,
  Slider,
  Spinner,
  TextField,
  TextLink,
  Toggle,
  Typography,
} from '@lucko/design-system'
import {
  DECLARED_LEVEL_LABELS,
  DECLARED_LEVELS,
  type Game,
  LEVEL_QUESTIONS,
  levelFromAnswers,
} from '@lucko/shared'
import { createFormHook } from '@tanstack/react-form'
import { useQuery } from '@tanstack/react-query'
import * as Location from 'expo-location'
import { type ComponentProps, type RefObject, useState } from 'react'
import { Platform, Text, type TextInput, View } from 'react-native'
import { type FormatChoice, type GamesValue, NO_ANSWERS } from '@/forms/games.form'
import type { CityValue } from '@/lib/city'
import { citySuggestionsQueryOptions, findCityAt } from '@/queries/useGeocode'
import { fieldContext, formContext, useFieldContext, useFormContext } from './formContext'
import { useDebouncedValue } from './useDebouncedValue'

/** Premier message d'erreur d'un champ : chaîne d'un validateur, ou `{ message }` d'un schéma Zod. */
const firstError = (errors: unknown[]) => {
  const error = errors.find(Boolean)
  if (typeof error === 'string') return error
  const message = (error as { message?: unknown } | undefined)?.message
  return typeof message === 'string' ? message : undefined
}

/**
 * Champ courant, son erreur et un `onChange` qui efface l'erreur d'envoi du champ (validation à l'envoi
 * ou erreur de l'API posée par `form.setErrorMap`) : elle reviendra au prochain envoi si elle tient toujours.
 */
function useKwField<T>() {
  const field = useFieldContext<T>()
  const onChange = (value: T) => {
    field.handleChange(value)
    if (field.state.meta.errorMap.onSubmit)
      field.setMeta((meta) => ({ ...meta, errorMap: { ...meta.errorMap, onSubmit: undefined } }))
  }
  return { field, error: firstError(field.state.meta.errors), onChange }
}

// * CHAMPS

type TextProps = Omit<
  ComponentProps<typeof TextField>,
  'value' | 'onChangeText' | 'error' | 'onBlur'
>

const TextInputField = (props: TextProps) => {
  const { field, error, onChange } = useKwField<string>()
  return (
    <TextField
      {...props}
      value={field.state.value}
      onChangeText={onChange}
      onBlur={field.handleBlur}
      error={error}
    />
  )
}

/** Nombre à `length` chiffres (jour, mois, année) : garde les chiffres et passe au champ `next` une fois rempli. */
const DigitsField = ({
  length,
  next,
  ...props
}: Omit<TextProps, 'maxLength' | 'keyboardType'> & {
  length: number
  next?: RefObject<TextInput | null>
}) => {
  const { field, error, onChange } = useKwField<string>()
  return (
    <TextField
      {...props}
      value={field.state.value}
      onChangeText={(text) => {
        const digits = text.replace(/\D/g, '').slice(0, length)
        onChange(digits)
        if (digits.length === length) next?.current?.focus()
      }}
      onBlur={field.handleBlur}
      error={error}
      keyboardType="number-pad"
      maxLength={length}
      returnKeyType={next ? 'next' : 'done'}
      onSubmitEditing={next ? () => next.current?.focus() : props.onSubmitEditing}
    />
  )
}

const SliderField = ({
  label,
  min,
  max,
  unit,
  bounds,
}: {
  label: string
  min: number
  max: number
  unit: string
  bounds?: boolean
}) => {
  const { field, onChange } = useKwField<number>()
  const mono = { ...font('mono', 400), fontSize: 12, color: colors.muted }
  return (
    <View style={{ gap: 8 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="label">{label}</Typography>
        <Text style={{ ...font('mono', 700), fontSize: 15, color: colors.ink }}>
          {field.state.value} {unit}
        </Text>
      </View>
      <Slider label={label} value={field.state.value} min={min} max={max} onChange={onChange} />
      {bounds ? (
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text style={mono}>
            {min} {unit}
          </Text>
          <Text style={mono}>
            {max} {unit}
          </Text>
        </View>
      ) : null}
    </View>
  )
}

const AvailabilityField = ({ compact }: { compact?: boolean }) => {
  const { field, onChange } = useKwField<number[]>()
  const slots = field.state.value
  return (
    <AvailabilityGrid
      compact={compact}
      value={slots}
      onToggle={(slot) =>
        onChange(
          slots.includes(slot)
            ? slots.filter((s) => s !== slot)
            : [...slots, slot].sort((a, b) => a - b),
        )
      }
    />
  )
}

/** Choix multiple : cartes avec description (desktop) ou pastilles de 44 px (téléphone). */
const MultiChoiceField = <K extends string>({
  options,
  compact,
}: {
  options: { key: K; label: string; description?: string }[]
  compact?: boolean
}) => {
  const { field, onChange } = useKwField<K[]>()
  const selected = field.state.value
  const toggle = (key: K) =>
    onChange(selected.includes(key) ? selected.filter((k) => k !== key) : [...selected, key])
  if (compact)
    return (
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {options.map((o) => (
          <Chip
            key={o.key}
            tall
            label={o.label}
            active={selected.includes(o.key)}
            onPress={() => toggle(o.key)}
          />
        ))}
      </View>
    )
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
      {options.map((o) => (
        <View key={o.key} style={{ width: '48%', flexGrow: 1 }}>
          <OptionCard
            label={o.label}
            description={o.description}
            value={selected.includes(o.key)}
            onChange={() => toggle(o.key)}
          />
        </View>
      ))}
    </View>
  )
}

/** Choix unique en pastilles de 44 px (jeu, format, jour…). */
const ChoiceField = <K extends string>({
  label,
  options,
}: {
  label?: string
  options: { key: K; label: string }[]
}) => {
  const { field, error, onChange } = useKwField<K>()
  return (
    <View style={{ gap: 8 }}>
      {label ? <Typography variant="label">{label}</Typography> : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {options.map((o) => (
          <Chip
            key={o.key}
            tall
            label={o.label}
            active={field.state.value === o.key}
            onPress={() => onChange(o.key)}
          />
        ))}
      </View>
      {error ? <Note tone="room">{error}</Note> : null}
    </View>
  )
}

/** Oui / non avec son explication (mineurs acceptés, inscription automatique). */
const SwitchField = ({ label, description }: { label: string; description?: string }) => {
  const { field, onChange } = useKwField<boolean>()
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <View style={{ flex: 1, gap: 2 }}>
        <Typography variant="label">{label}</Typography>
        {description ? <Typography variant="small">{description}</Typography> : null}
      </View>
      <Toggle label={label} value={field.state.value} onChange={onChange} />
    </View>
  )
}

// Position arrondie à ~1 km : assez pour chercher autour, sans garder l'adresse exacte du joueur
const round = (value: number) => Math.round(value * 100) / 100

/**
 * Ville saisie avec suggestions de communes, ou trouvée par « Me localiser » (position de l'appareil
 * puis commune). `locateButton` : grand bouton « Utiliser ma position » au-dessus du champ (onboarding sur téléphone).
 */
const CityField = ({ compact, locateButton }: { compact?: boolean; locateButton?: boolean }) => {
  const { field, error, onChange } = useKwField<CityValue>()
  const [locating, setLocating] = useState(false)
  const [locateError, setLocateError] = useState<string>()
  const value = field.state.value
  const query = useDebouncedValue(value.name.trim())
  // Une commune choisie (suggestion, position ou profil enregistré) a sa position : plus rien à proposer
  const open = value.lat === null && query.length >= 2
  const suggestions = useQuery({ ...citySuggestionsQueryOptions(query), enabled: open })

  const locate = async () => {
    setLocating(true)
    setLocateError(undefined)
    try {
      const { granted } = await Location.requestForegroundPermissionsAsync()
      if (!granted) return setLocateError('Position refusée : saisis ta ville.')
      const { coords } = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      })
      const lat = round(coords.latitude)
      const lng = round(coords.longitude)
      const name = await findCityAt(lat, lng)
      if (!name) return setLocateError('Aucune ville trouvée à ta position : saisis-la.')
      onChange({ name, lat, lng })
    } catch {
      setLocateError('Position indisponible : saisis ta ville.')
    } finally {
      setLocating(false)
    }
  }

  const input = (
    <TextField
      label="Ville"
      placeholder="Ex. Bordeaux"
      value={value.name}
      onChangeText={(name) => {
        setLocateError(undefined)
        onChange({ name, lat: null, lng: null })
      }}
      onBlur={field.handleBlur}
      error={locateError ?? error}
      autoComplete="postal-address-locality"
      right={
        locating ? (
          <Spinner />
        ) : locateButton ? undefined : (
          <TextLink label={compact ? 'Localiser' : 'Me localiser'} onPress={() => void locate()} />
        )
      }
    />
  )
  const list =
    open && suggestions.data?.length ? (
      <ListCard>
        {suggestions.data.map((c, i, all) => (
          <ListRow
            key={`${c.lat},${c.lng}`}
            inset={14}
            last={i === all.length - 1}
            title={c.name}
            right={<Typography variant="number">{c.department}</Typography>}
            onPress={() => onChange({ name: c.name, lat: c.lat, lng: c.lng })}
          />
        ))}
      </ListCard>
    ) : null

  return (
    <View style={{ gap: locateButton ? 16 : 8 }}>
      {locateButton ? (
        <Button
          kind="ghost"
          label={locating ? 'Localisation…' : 'Utiliser ma position'}
          disabled={locating}
          onPress={() => void locate()}
        />
      ) : null}
      {input}
      {list}
    </View>
  )
}

/**
 * Mes jeux (A6, F3) : jeux joués ; pour un TCG, ses formats, et pour chaque format les 3 questions
 * qui donnent le niveau déclaré (LK de départ). Jeux de société : pas de niveau.
 */
const GamesField = ({ catalog }: { catalog: Game[] }) => {
  const { field, error, onChange } = useKwField<GamesValue>()
  const { gameIds, formats } = field.state.value
  const toggleGame = (game: Game) => {
    const on = gameIds.includes(game.id)
    const formatIds = game.formats.map((f) => f.id)
    onChange({
      gameIds: on ? gameIds.filter((id) => id !== game.id) : [...gameIds, game.id],
      // Décocher un jeu retire ses formats
      formats: on ? formats.filter((f) => !formatIds.includes(f.formatId)) : formats,
    })
  }
  const toggleFormat = (formatId: string) =>
    onChange({
      gameIds,
      formats: formats.some((f) => f.formatId === formatId)
        ? formats.filter((f) => f.formatId !== formatId)
        : [...formats, { formatId, level: null, answers: NO_ANSWERS }],
    })
  const answer = (formatId: string, question: number, value: number) =>
    onChange({
      gameIds,
      formats: formats.map((f) => {
        if (f.formatId !== formatId) return f
        const answers = f.answers.map((a, i) => (i === question ? value : a))
        const complete = answers.every((a): a is number => a !== null)
        return { ...f, answers, level: complete ? levelFromAnswers(answers) : f.level }
      }),
    })

  return (
    <View style={{ gap: 16 }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {catalog.map((g) => (
          <Chip
            key={g.id}
            tall
            label={g.name}
            active={gameIds.includes(g.id)}
            onPress={() => toggleGame(g)}
          />
        ))}
      </View>
      {catalog
        .filter((g) => g.kind === 'TCG' && gameIds.includes(g.id))
        .map((game) => (
          <View key={game.id} style={{ gap: 10 }}>
            <Typography variant="label">{game.name} : tes formats</Typography>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {game.formats.map((f) => (
                <Chip
                  key={f.id}
                  tall
                  label={f.name}
                  active={formats.some((c) => c.formatId === f.id)}
                  onPress={() => toggleFormat(f.id)}
                />
              ))}
            </View>
            {game.formats.flatMap((f) => {
              const choice = formats.find((c) => c.formatId === f.id)
              return choice
                ? [<LevelQuestions key={f.id} name={f.name} choice={choice} onAnswer={answer} />]
                : []
            })}
          </View>
        ))}
      {error ? <Note tone="room">{error}</Note> : null}
    </View>
  )
}

/** Les 3 questions d'un format et le niveau qui en découle. */
function LevelQuestions({
  name,
  choice,
  onAnswer,
}: {
  name: string
  choice: FormatChoice
  onAnswer: (formatId: string, question: number, value: number) => void
}) {
  return (
    <View
      style={{
        gap: 10,
        padding: 14,
        borderWidth: border.thin,
        borderColor: colors.ink,
        borderRadius: radius.card,
        backgroundColor: colors.white,
      }}
    >
      <Typography variant="title">
        {name}
        {choice.level
          ? ` · ${DECLARED_LEVEL_LABELS[choice.level]} (LK de départ ${DECLARED_LEVELS[choice.level]})`
          : ''}
      </Typography>
      {LEVEL_QUESTIONS.map((q, i) => (
        <View key={q.key} style={{ gap: 6 }}>
          <Typography variant="small">{q.label}</Typography>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {q.answers.map((label, value) => (
              <Chip
                key={label}
                label={label}
                active={choice.answers[i] === value}
                onPress={() => onAnswer(choice.formatId, i, value)}
              />
            ))}
          </View>
        </View>
      ))}
    </View>
  )
}

// * FORMULAIRE

/** Bouton d'envoi : grisé pendant l'envoi (validation asynchrone comprise). */
/**
 * Envoi refusé : sur le web, le premier champ en erreur (TextField `aria-invalid`) revient à l'écran,
 * sinon un long formulaire semble ne rien faire (LKO-151). Sur téléphone, l'erreur reste à sa place.
 */
function showFirstError() {
  if (Platform.OS !== 'web') return
  // Après le rendu des messages d'erreur
  setTimeout(() => {
    const field = document.querySelector<HTMLElement>('[aria-invalid="true"]')
    field?.scrollIntoView({ block: 'center' })
    field?.focus({ preventScroll: true })
  }, 0)
}

function SubmitButton({
  label,
  kind,
  small,
}: {
  label: string
  kind?: ButtonKind
  small?: boolean
}) {
  const form = useFormContext()
  return (
    <form.Subscribe selector={(state) => state.isSubmitting}>
      {(isSubmitting) => (
        <Button
          label={label}
          kind={kind}
          small={small}
          disabled={isSubmitting}
          onPress={() => void form.handleSubmit().then(showFirstError)}
        />
      )}
    </form.Subscribe>
  )
}

/** Erreur de tout le formulaire (ex. API injoignable), posée par `form.setErrorMap({ onSubmit: { form } })`. */
function FormError() {
  const form = useFormContext()
  return (
    <form.Subscribe selector={(state) => firstError(state.errors)}>
      {(error) => (error ? <Note tone="room">{error}</Note> : null)}
    </form.Subscribe>
  )
}

export const { useAppForm, withForm } = createFormHook({
  fieldComponents: {
    Text: TextInputField,
    Digits: DigitsField,
    Slider: SliderField,
    Availability: AvailabilityField,
    MultiChoice: MultiChoiceField,
    Choice: ChoiceField,
    Switch: SwitchField,
    Games: GamesField,
    City: CityField,
  },
  formComponents: {
    SubmitButton,
    FormError,
  },
  fieldContext,
  formContext,
})
