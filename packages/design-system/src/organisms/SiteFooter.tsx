import { Pressable, Text, useWindowDimensions, View } from 'react-native'
import Svg, { Path } from 'react-native-svg'
import { linkProps } from '../atoms/InlineLink'
import { useHover } from '../atoms/useHover'
import { Brand } from '../molecules/Brand'
import { border, colors, font, radius, sizes, space, transition, type } from '../tokens'

export type FooterLink = { label: string; href: string; short?: string }

// ponytail: adresse, comptes Instagram et Discord à confirmer avant la mise en ligne
export const CONTACT_EMAIL = 'contact@lucko.fr'

// Variable inlinée par Expo au bundle de l'app ; le design system n'a pas les types Node
declare const process: { env: { EXPO_PUBLIC_SITE_URL?: string } }

/** Site public : préfixe des liens du pied de page dans l'app (pages légales, aide, villes). Site local en dev. */
export const SITE_URL = process.env.EXPO_PUBLIC_SITE_URL ?? 'https://lucko.fr'

/** Liens identiques sur toutes les pages. Chemins relatifs au site public (voir `siteUrl`). */
export const FOOTER_LINKS = {
  lucko: [
    { label: 'À propos', href: '/about' },
    { label: 'Aide', href: '/help' },
    { label: 'Contact', href: `mailto:${CONTACT_EMAIL}` },
  ],
  lieux: [
    { label: 'Où jouer à Bordeaux', href: '/bordeaux' },
    {
      label: 'Devenir lieu partenaire',
      href: `mailto:${CONTACT_EMAIL}?subject=Devenir%20lieu%20partenaire`,
    },
  ],
  legal: [
    { label: "Conditions d'utilisation", href: '/terms' },
    { label: 'Politique de confidentialité', short: 'Confidentialité', href: '/privacy' },
    { label: 'Mentions légales', href: '/legal-notice' },
  ],
} satisfies Record<string, FooterLink[]>

export const SOCIAL_LINKS = [
  { label: 'Instagram', href: 'https://www.instagram.com/lucko.app' },
  { label: 'Discord', href: 'https://discord.gg/lucko' },
] satisfies FooterLink[]

const WIDE = 900
const PITCH = 'Où jouer ce soir ?'
const NO_TRACKING = 'Sans cookies ni traceurs publicitaires'

/**
 * Pied de page commun (site et app), sur fond ink. Variante `compact` sous 900 px.
 * `stores` : badges App Store / Google Play, à passer une fois l'app publiée.
 */
export function SiteFooter({
  compact,
  siteUrl = '',
  stores = [],
}: {
  compact?: boolean
  /** Préfixe des liens relatifs : vide sur le site, URL du site dans l'app. */
  siteUrl?: string
  stores?: FooterLink[]
}) {
  const width = useWindowDimensions().width
  const small = compact ?? width < WIDE
  const url = (href: string) => (href.startsWith('/') ? siteUrl + href : href)
  const year = new Date().getFullYear()

  const column = (title: string, links: FooterLink[]) => (
    <View style={{ flex: 1, minWidth: 0, gap: small ? 10 : 12 }}>
      <Text style={{ ...type.label, color: colors.rating }}>{title}</Text>
      {links.map((l) => (
        <FooterTextLink
          key={l.href}
          label={(small && l.short) || l.label}
          href={url(l.href)}
          fontSize={small ? 14 : 15}
        />
      ))}
    </View>
  )
  const extras = (
    <>
      <View style={{ flexDirection: 'row', gap: 12 }}>
        {SOCIAL_LINKS.map((s) => (
          <SocialLink key={s.label} label={s.label} href={s.href} />
        ))}
      </View>
      {stores.length ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
          {stores.map((s) => (
            <StoreBadge key={s.href} label={s.label} href={s.href} />
          ))}
        </View>
      ) : null}
    </>
  )
  const copyright = <Text style={{ ...type.small, color: colors.creamMuted }}>© {year} Lucko</Text>
  const noTracking = <Text style={{ ...type.small, color: colors.creamMuted }}>{NO_TRACKING}</Text>

  if (small) {
    return (
      <View
        role="contentinfo"
        style={{
          backgroundColor: colors.ink,
          paddingHorizontal: space.screen,
          paddingVertical: 28,
          gap: 20,
        }}
      >
        <Brand onDark />
        <Text style={{ ...type.h1, color: colors.white }}>{PITCH}</Text>
        <View style={{ flexDirection: 'row', gap: 16 }}>
          {column('Lucko', [...FOOTER_LINKS.lucko, ...FOOTER_LINKS.lieux])}
          {column('Légal', FOOTER_LINKS.legal)}
        </View>
        {extras}
        <View
          style={{
            borderTopWidth: border.thin,
            borderColor: colors.muted,
            paddingTop: 14,
            gap: 4,
          }}
        >
          {copyright}
          {noTracking}
        </View>
      </View>
    )
  }

  return (
    <View role="contentinfo" style={{ backgroundColor: colors.ink }}>
      <View
        style={{
          width: '100%',
          maxWidth: 1200,
          alignSelf: 'center',
          paddingHorizontal: space.page,
        }}
      >
        <View style={{ flexDirection: 'row', gap: 48, paddingTop: 64, paddingBottom: 40 }}>
          <View style={{ flex: 2, minWidth: 0, gap: 20 }}>
            <Brand onDark size={44} fontSize={32} />
            <Text
              style={{
                ...font('display'),
                fontSize: 40,
                lineHeight: 40,
                textTransform: 'uppercase',
                color: colors.white,
                maxWidth: 420,
              }}
            >
              {PITCH}
            </Text>
            <Text
              style={{
                ...font('body', 500),
                fontSize: 15,
                lineHeight: 22,
                color: colors.creamMuted,
                maxWidth: 340,
              }}
            >
              Trouver des joueurs et des lieux pour jouer aux TCG et aux jeux de société, près de
              chez soi.
            </Text>
            {extras}
          </View>
          {column('Lucko', FOOTER_LINKS.lucko)}
          {column('Lieux', FOOTER_LINKS.lieux)}
          {column('Légal', FOOTER_LINKS.legal)}
        </View>
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 16,
            borderTopWidth: border.thin,
            borderColor: colors.muted,
            paddingTop: 20,
            paddingBottom: 28,
          }}
        >
          <Text style={{ ...type.small, color: colors.creamMuted }}>
            © {year} Lucko · {NO_TRACKING}
          </Text>
          <Text style={{ ...type.label, letterSpacing: 0, color: colors.creamMuted }}>
            Bordeaux · France
          </Text>
        </View>
      </View>
    </View>
  )
}

function FooterTextLink({
  label,
  href,
  fontSize,
}: {
  label: string
  href: string
  fontSize: number
}) {
  const { hovered, hoverProps } = useHover()
  return (
    <Pressable
      role="link"
      {...linkProps(href)}
      {...hoverProps}
      hitSlop={{ top: 13, bottom: 13 }}
      style={{ alignSelf: 'flex-start' }}
    >
      <Text
        style={{
          ...font('body', 600),
          fontSize,
          color: hovered ? colors.rating : colors.white,
          ...transition(['color']),
        }}
      >
        {label}
      </Text>
    </Pressable>
  )
}

function SocialLink({ label, href }: { label: string; href: string }) {
  const { hovered, hoverProps } = useHover()
  const color = hovered ? colors.rating : colors.white
  return (
    <Pressable
      role="link"
      aria-label={label}
      {...linkProps(href)}
      {...hoverProps}
      style={{
        width: sizes.touch,
        height: sizes.touch,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: border.thin,
        borderColor: color,
        borderRadius: radius.field,
        ...transition(['border-color']),
      }}
    >
      {label === 'Instagram' ? <InstagramGlyph color={color} /> : <DiscordGlyph color={color} />}
    </Pressable>
  )
}

// Logos officiels (Simple Icons, CC0) : Lucide n'a pas les marques
function InstagramGlyph({ color }: { color: string }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24">
      <Path
        fill={color}
        d="M7.0301.084c-1.2768.0602-2.1487.264-2.911.5634-.7888.3075-1.4575.72-2.1228 1.3877-.6652.6677-1.075 1.3368-1.3802 2.127-.2954.7638-.4956 1.6365-.552 2.914-.0564 1.2775-.0689 1.6882-.0626 4.947.0062 3.2586.0206 3.6671.0825 4.9473.061 1.2765.264 2.1482.5635 2.9107.308.7889.72 1.4573 1.388 2.1228.6679.6655 1.3365 1.0743 2.1285 1.38.7632.295 1.6361.4961 2.9134.552 1.2773.056 1.6884.069 4.9462.0627 3.2578-.0062 3.668-.0207 4.9478-.0814 1.28-.0607 2.147-.2652 2.9098-.5633.7889-.3086 1.4578-.72 2.1228-1.3881.665-.6682 1.0745-1.3378 1.3795-2.1284.2957-.7632.4966-1.636.552-2.9124.056-1.2809.0692-1.6898.063-4.948-.0063-3.2583-.021-3.6668-.0817-4.9465-.0607-1.2797-.264-2.1487-.5633-2.9117-.3084-.7889-.72-1.4568-1.3876-2.1228C21.2982 1.33 20.628.9208 19.8378.6165 19.074.321 18.2017.1197 16.9244.0645 15.6471.0093 15.236-.005 11.977.0014 8.718.0076 8.31.0215 7.0301.0839m.1402 21.6932c-1.17-.0509-1.8053-.2453-2.2287-.408-.5606-.216-.96-.4771-1.3819-.895-.422-.4178-.6811-.8186-.9-1.378-.1644-.4234-.3624-1.058-.4171-2.228-.0595-1.2645-.072-1.6442-.079-4.848-.007-3.2037.0053-3.583.0607-4.848.05-1.169.2456-1.805.408-2.2282.216-.5613.4762-.96.895-1.3816.4188-.4217.8184-.6814 1.3783-.9003.423-.1651 1.0575-.3614 2.227-.4171 1.2655-.06 1.6447-.072 4.848-.079 3.2033-.007 3.5835.005 4.8495.0608 1.169.0508 1.8053.2445 2.228.408.5608.216.96.4754 1.3816.895.4217.4194.6816.8176.9005 1.3787.1653.4217.3617 1.056.4169 2.2263.0602 1.2655.0739 1.645.0796 4.848.0058 3.203-.0055 3.5834-.061 4.848-.051 1.17-.245 1.8055-.408 2.2294-.216.5604-.4763.96-.8954 1.3814-.419.4215-.8181.6811-1.3783.9-.4224.1649-1.0577.3617-2.2262.4174-1.2656.0595-1.6448.072-4.8493.079-3.2045.007-3.5825-.006-4.848-.0608M16.953 5.5864A1.44 1.44 0 1 0 18.39 4.144a1.44 1.44 0 0 0-1.437 1.4424M5.8385 12.012c.0067 3.4032 2.7706 6.1557 6.173 6.1493 3.4026-.0065 6.157-2.7701 6.1506-6.1733-.0065-3.4032-2.771-6.1565-6.174-6.1498-3.403.0067-6.156 2.771-6.1496 6.1738M8 12.0077a4 4 0 1 1 4.008 3.9921A3.9996 3.9996 0 0 1 8 12.0077"
      />
    </Svg>
  )
}

function DiscordGlyph({ color }: { color: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24">
      <Path
        fill={color}
        d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189Z"
      />
    </Svg>
  )
}

function StoreBadge({ label, href }: { label: string; href: string }) {
  const { hovered, hoverProps } = useHover()
  return (
    <Pressable
      role="link"
      {...linkProps(href)}
      {...hoverProps}
      style={{
        minHeight: sizes.touch,
        paddingHorizontal: 14,
        justifyContent: 'center',
        borderWidth: border.thin,
        borderColor: hovered ? colors.rating : colors.white,
        borderRadius: radius.button,
        ...transition(['border-color']),
      }}
    >
      <Text style={{ ...font('body', 700), fontSize: 14, color: colors.white }}>{label}</Text>
    </Pressable>
  )
}
