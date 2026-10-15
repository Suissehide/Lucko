import Svg, { Path } from 'react-native-svg'
import { DISCORD_PATH, INSTAGRAM_PATH } from './brandGlyphPaths'

export function InstagramGlyph({ color }: { color: string }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24">
      <Path fill={color} d={INSTAGRAM_PATH} />
    </Svg>
  )
}

export function DiscordGlyph({ color }: { color: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24">
      <Path fill={color} d={DISCORD_PATH} />
    </Svg>
  )
}
