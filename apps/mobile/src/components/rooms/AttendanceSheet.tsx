import {
  Banner,
  Button,
  colors,
  ListCard,
  PersonCell,
  PresenceToggle,
  TextField,
  Typography,
} from '@lucko/design-system'
import { parseTicketCents, type AttendanceSheet as Sheet } from '@lucko/shared'
import { useState } from 'react'
import { View } from 'react-native'
import { useMarkAttendanceMutation } from '@/queries/useAttendance'

const SOURCE_LABELS = {
  SCAN: 'Scan du QR Lucko',
  VENUE: 'Pointé par le lieu',
  HOST: 'Pointé par l’hôte',
} as const

const euros = (cents: number | null) =>
  cents === null ? '' : (cents / 100).toFixed(2).replace('.', ',')

/**
 * Pointage d'une room (LKO-78) : Là / Absent par joueur. L'hôte peut tout valider d'un coup ; le lieu
 * saisit en plus, s'il le veut, le montant du ticket de chaque présent (visible de lui seul).
 * `filter` : recherche par pseudo (back-office lieu).
 */
export function AttendanceSheet({ sheet, filter = '' }: { sheet: Sheet; filter?: string }) {
  const mark = useMarkAttendanceMutation(sheet.roomId)
  const [tickets, setTickets] = useState<Record<string, string>>({})
  const [ticketError, setTicketError] = useState<string | null>(null)
  const players = sheet.players.filter((p) =>
    (p.pseudo ?? '').toLowerCase().includes(filter.trim().toLowerCase()),
  )
  const editable = sheet.players.filter((p) => !p.locked)
  const isVenue = sheet.role === 'VENUE'

  const saveTicket = (userId: string) => {
    const text = tickets[userId]
    if (text === undefined) return
    const cents = parseTicketCents(text)
    if (cents === undefined) return setTicketError('Montant du ticket : entre 0 et 500 €')
    setTicketError(null)
    mark.mutate([{ userId, present: true, ticketCents: cents }])
  }

  return (
    <View style={{ gap: 12 }}>
      {sheet.closed ? <Banner tone="warn" message={sheet.closed} /> : null}
      {mark.error ? (
        <Banner tone="err" message={mark.error.message} onClose={() => mark.reset()} />
      ) : null}
      {ticketError ? (
        <Banner tone="err" message={ticketError} onClose={() => setTicketError(null)} />
      ) : null}

      <ListCard>
        {players.map((p, i) => (
          <View
            key={p.userId}
            style={{
              padding: 12,
              gap: 10,
              borderTopWidth: i ? 1 : 0,
              borderColor: colors.line,
            }}
          >
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
                flexWrap: 'wrap',
              }}
            >
              <PersonCell
                name={`${p.pseudo ?? 'Joueur'}${p.isHost ? ' · hôte' : ''}`}
                subtitle={p.locked ?? (p.source ? SOURCE_LABELS[p.source] : 'Pas encore pointé')}
              />
              <PresenceToggle
                label={p.pseudo ?? undefined}
                value={p.present === null ? null : p.present ? 'present' : 'absent'}
                onChange={
                  sheet.closed || p.locked || mark.isPending
                    ? undefined
                    : (v) => mark.mutate([{ userId: p.userId, present: v === 'present' }])
                }
              />
            </View>
            {isVenue && p.present && !sheet.closed ? (
              <TextField
                label="Ticket (facultatif)"
                placeholder="0,00"
                keyboardType="decimal-pad"
                right={<Typography variant="small">€</Typography>}
                value={tickets[p.userId] ?? euros(p.ticketCents)}
                onChangeText={(text) => setTickets((t) => ({ ...t, [p.userId]: text }))}
                onBlur={() => saveTicket(p.userId)}
                onSubmitEditing={() => saveTicket(p.userId)}
              />
            ) : null}
          </View>
        ))}
      </ListCard>

      {!isVenue && !sheet.closed && editable.length ? (
        <View style={{ alignSelf: 'flex-start' }}>
          <Button
            kind="room"
            label="Tout le monde est là"
            disabled={mark.isPending}
            onPress={() => mark.mutate(editable.map((p) => ({ userId: p.userId, present: true })))}
          />
        </View>
      ) : null}
    </View>
  )
}
