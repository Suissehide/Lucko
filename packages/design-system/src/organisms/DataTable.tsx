import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react-native'
import type { ReactNode } from 'react'
import {
  Pressable,
  type PressableStateCallbackType,
  Text,
  View,
  type ViewStyle,
} from 'react-native'
import { Checkbox } from '../atoms/Checkbox'
import { Skeleton } from '../atoms/Skeleton'
import { Typography } from '../atoms/Typography'
import { ContentCard } from '../molecules/ContentCard'
import { SkeletonCard } from '../molecules/SkeletonCard'
import { border, colors, font, radius, table } from '../tokens'

export type Column<T> = {
  key: string
  label: string
  width?: number
  flex?: number
  align?: 'left' | 'right'
  mono?: boolean
  sortable?: boolean
  render?: (row: T) => ReactNode
}
export type Sort = { key: string; dir: 'asc' | 'desc' } | null

// react-native-web ajoute `hovered` à l'état de Pressable (absent des types React Native).
type PressState = PressableStateCallbackType & { hovered?: boolean }

const cellText = { ...font('body', 400), fontSize: 14, color: colors.ink }
const cellMono = { ...font('mono', 700), fontSize: 13, color: colors.ink }

/**
 * Tableau de données. Avec `mobileCards` (sous 768 px), chaque ligne devient une carte :
 * colonne `primary` en titre, colonnes `cardKeys` en dessous, colonne `statusKey` en haut à droite.
 */
export function DataTable<T extends { id: string }>({
  columns,
  rows,
  dense,
  sort,
  onSort,
  selectable,
  selected = [],
  onSelect,
  onRowPress,
  expanded,
  rowActions,
  toolbar,
  bulkActions,
  footer,
  loading,
  empty,
  mobileCards,
  primary,
  cardKeys = [],
  statusKey,
}: {
  columns: Column<T>[]
  rows: T[]
  dense?: boolean
  sort?: Sort
  onSort?: (s: Sort) => void
  selectable?: boolean
  selected?: string[]
  onSelect?: (ids: string[]) => void
  onRowPress?: (r: T) => void
  /** Contenu déplié sous une ligne (null : repliée). */
  expanded?: (r: T) => ReactNode
  rowActions?: (r: T) => ReactNode
  toolbar?: ReactNode
  bulkActions?: ReactNode
  footer?: ReactNode
  loading?: boolean
  empty?: ReactNode
  mobileCards?: boolean
  primary?: string
  cardKeys?: string[]
  statusKey?: string
}) {
  const pad = dense ? table.paddingCompact : table.paddingComfort
  const byKey = new Map(columns.map((c) => [c.key, c]))
  const cell = (c: Column<T> | undefined, r: T) => {
    if (!c) return null
    if (c.render) return c.render(r)
    const value = (r as Record<string, unknown>)[c.key]
    return (
      <Text
        numberOfLines={1}
        style={[c.mono ? cellMono : cellText, { textAlign: c.align ?? 'left' }]}
      >
        {value == null ? '—' : String(value)}
      </Text>
    )
  }
  const colStyle = (c: Column<T>): ViewStyle =>
    c.width ? { width: c.width } : { flex: c.flex ?? 1, minWidth: 0 }
  const toggle = (id: string) =>
    onSelect?.(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id])

  if (mobileCards) {
    return (
      <View style={{ gap: 10 }}>
        {loading ? (
          <SkeletonCard />
        ) : rows.length === 0 ? (
          empty
        ) : (
          rows.map((r) => (
            <Pressable
              key={r.id}
              onPress={() => onRowPress?.(r)}
              onLongPress={() => selectable && toggle(r.id)}
            >
              <ContentCard>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
                  <View style={{ flex: 1 }}>{primary ? cell(byKey.get(primary), r) : null}</View>
                  {statusKey ? cell(byKey.get(statusKey), r) : null}
                </View>
                <View
                  style={{
                    flexDirection: 'row',
                    flexWrap: 'wrap',
                    justifyContent: 'space-between',
                    gap: 8,
                  }}
                >
                  {cardKeys.map((k) => (
                    <View key={k} style={{ flexShrink: 1 }}>
                      {cell(byKey.get(k), r)}
                    </View>
                  ))}
                  {rowActions?.(r)}
                </View>
              </ContentCard>
            </Pressable>
          ))
        )}
      </View>
    )
  }

  return (
    <View
      role="table"
      style={{
        backgroundColor: colors.white,
        borderWidth: border.base,
        borderColor: colors.ink,
        borderRadius: radius.card,
        overflow: 'hidden',
      }}
    >
      {toolbar ? (
        <View
          style={{
            padding: 12,
            paddingHorizontal: 16,
            borderBottomWidth: border.base,
            borderColor: colors.ink,
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: 12,
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          {toolbar}
        </View>
      ) : null}
      {selectable && selected.length > 0 && bulkActions ? (
        <View
          style={{
            backgroundColor: table.bulkBarBg,
            paddingVertical: 10,
            paddingHorizontal: 16,
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <Text style={{ ...font('body', 700), fontSize: 13, color: colors.white }}>
            {selected.length} sélectionné{selected.length > 1 ? 's' : ''}
          </Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>{bulkActions}</View>
        </View>
      ) : null}
      <View
        role="row"
        style={{
          flexDirection: 'row',
          gap: 12,
          alignItems: 'center',
          backgroundColor: table.headerBg,
          borderBottomWidth: border.base,
          borderColor: colors.ink,
          paddingVertical: 10,
          paddingHorizontal: pad.h,
        }}
      >
        {selectable ? (
          <View style={{ width: 28 }}>
            <Checkbox
              label="Tout sélectionner"
              hideLabel
              value={rows.length > 0 && selected.length === rows.length}
              onChange={(v) => onSelect?.(v ? rows.map((r) => r.id) : [])}
            />
          </View>
        ) : null}
        {columns.map((c) => {
          const active = sort?.key === c.key
          const SortIcon = !active ? ArrowUpDown : sort?.dir === 'desc' ? ArrowDown : ArrowUp
          return (
            <Pressable
              key={c.key}
              role="columnheader"
              disabled={!c.sortable}
              aria-sort={
                !c.sortable
                  ? undefined
                  : active
                    ? sort?.dir === 'desc'
                      ? 'descending'
                      : 'ascending'
                    : 'none'
              }
              onPress={() =>
                onSort?.({ key: c.key, dir: active && sort?.dir === 'desc' ? 'asc' : 'desc' })
              }
              style={[
                colStyle(c),
                {
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 4,
                  justifyContent: c.align === 'right' ? 'flex-end' : 'flex-start',
                },
              ]}
            >
              <Typography variant="label">{c.label}</Typography>
              {c.sortable ? (
                <SortIcon size={13} color={active ? colors.ink : '#B9AB92'} strokeWidth={2.5} />
              ) : null}
            </Pressable>
          )
        })}
        {rowActions ? <View style={{ width: 32 }} /> : null}
      </View>
      {loading ? (
        Array.from({ length: 5 }, (_, i) => `chargement-${i}`).map((row) => (
          <View
            key={row}
            style={{
              flexDirection: 'row',
              gap: 10,
              paddingVertical: pad.v + 2,
              paddingHorizontal: pad.h,
              borderBottomWidth: border.thin,
              borderColor: colors.line,
            }}
          >
            <Skeleton width="60%" height={12} />
            <Skeleton width="20%" height={12} />
          </View>
        ))
      ) : rows.length === 0 ? (
        <View style={{ padding: 20 }}>{empty}</View>
      ) : (
        rows.map((r) => {
          const on = selected.includes(r.id)
          const detail = expanded?.(r)
          return (
            <View key={r.id}>
              <Pressable
                role="row"
                aria-selected={on}
                onPress={() => onRowPress?.(r)}
                style={({ hovered }: PressState) => ({
                  flexDirection: 'row',
                  gap: 12,
                  alignItems: 'center',
                  paddingVertical: pad.v,
                  paddingHorizontal: pad.h,
                  borderBottomWidth: border.thin,
                  borderColor: table.rowBorder,
                  backgroundColor: on ? table.rowSelected : hovered ? table.rowHover : colors.white,
                })}
              >
                {selectable ? (
                  <View style={{ width: 28 }}>
                    <Checkbox
                      label="Sélectionner"
                      hideLabel
                      value={on}
                      onChange={() => toggle(r.id)}
                    />
                  </View>
                ) : null}
                {columns.map((c) => (
                  <View
                    key={c.key}
                    role="cell"
                    style={[
                      colStyle(c),
                      { alignItems: c.align === 'right' ? 'flex-end' : 'flex-start' },
                    ]}
                  >
                    {cell(c, r)}
                  </View>
                ))}
                {rowActions ? (
                  <View style={{ width: 32, alignItems: 'flex-end' }}>{rowActions(r)}</View>
                ) : null}
              </Pressable>
              {detail ? (
                <View
                  style={{
                    paddingHorizontal: pad.h,
                    paddingBottom: pad.v,
                    backgroundColor: colors.white,
                    borderBottomWidth: border.thin,
                    borderColor: table.rowBorder,
                  }}
                >
                  {detail}
                </View>
              ) : null}
            </View>
          )
        })
      )}
      {footer}
    </View>
  )
}
