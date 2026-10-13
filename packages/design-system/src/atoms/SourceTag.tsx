import { Text, View } from 'react-native'
import { border, colors, font, radius } from '../tokens'

export type DataSource = 'google' | 'osm' | 'ban' | 'lucko' | 'missing'
const sources: Record<DataSource, { label: string; bg: string }> = {
  google: { label: 'Google', bg: colors.eventSoft },
  osm: { label: 'OpenStreetMap', bg: colors.eventSoft },
  ban: { label: 'Base Adresse Nationale', bg: colors.eventSoft },
  lucko: { label: 'Lucko', bg: colors.venueSoft },
  missing: { label: 'À choisir', bg: colors.ratingSoft },
}

/** Origine d'une donnée pré-remplie (fiche lieu). Dans la ligne, une valeur `missing` passe en `colors.inactive`. */
export function SourceTag({ source }: { source: DataSource }) {
  const s = sources[source]
  return (
    <View
      style={{
        alignSelf: 'flex-start',
        backgroundColor: s.bg,
        borderWidth: border.thin,
        borderColor: colors.ink,
        borderRadius: radius.pill,
        paddingVertical: 1,
        paddingHorizontal: 8,
      }}
    >
      <Text style={{ ...font('body', 700), fontSize: 11, color: colors.ink }}>{s.label}</Text>
    </View>
  )
}
