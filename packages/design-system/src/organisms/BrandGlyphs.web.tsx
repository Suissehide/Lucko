import { DISCORD_PATH, INSTAGRAM_PATH } from './brandGlyphPaths'

// react-native-svg ne compile pas dans le site Next : <svg> du DOM, rendu tel quel par react-native-web
export function InstagramGlyph({ color }: { color: string }) {
  return (
    <svg width={20} height={20} viewBox="0 0 24 24" aria-hidden="true">
      <path fill={color} d={INSTAGRAM_PATH} />
    </svg>
  )
}

export function DiscordGlyph({ color }: { color: string }) {
  return (
    <svg width={22} height={22} viewBox="0 0 24 24" aria-hidden="true">
      <path fill={color} d={DISCORD_PATH} />
    </svg>
  )
}
