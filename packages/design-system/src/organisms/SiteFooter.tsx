import { Pressable, Text, useWindowDimensions, View } from 'react-native'
import { linkProps } from '../atoms/InlineLink'
import { useHover } from '../atoms/useHover'
import { Brand } from '../molecules/Brand'
import { border, colors, font, radius, sizes, space, transition, type } from '../tokens'
import { DiscordGlyph, InstagramGlyph } from './BrandGlyphs'

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
