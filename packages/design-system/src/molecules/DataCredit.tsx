import { Info } from 'lucide-react-native'
import { useState } from 'react'
import { View } from 'react-native'
import { IconButton } from '../atoms/IconButton'
import { InlineLink } from '../atoms/InlineLink'
import { Typography } from '../atoms/Typography'
import { colors, sizes } from '../tokens'

/** Bouton « i » qui affiche la source des données et le lien vers sa licence (ex. OpenStreetMap, ODbL). */
export function DataCredit({ source, href }: { source: string; href: string }) {
  const [open, setOpen] = useState(false)
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <IconButton
        icon={<Info size={16} color={colors.ink} />}
        label={open ? 'Masquer la source des données' : 'Source des données'}
        size={sizes.iconBtnSm}
        onPress={() => setOpen(!open)}
      />
      {open ? (
        <Typography variant="small">
          Données <InlineLink href={href}>{source}</InlineLink>
        </Typography>
      ) : null}
    </View>
  )
}
