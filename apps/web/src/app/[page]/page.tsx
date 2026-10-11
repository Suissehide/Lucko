import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { TextPage } from '../text-page'

// ponytail: page provisoire du pied de page, à remplacer par son contenu
const PAGES: Record<string, { title: string; text: string }> = {
  bordeaux: {
    title: 'Où jouer ce soir à Bordeaux',
    text: 'Les bars à jeux, boutiques et associations de Bordeaux arrivent bientôt sur Lucko.',
  },
}

type Props = { params: Promise<{ page: string }> }

export const dynamicParams = false
export const generateStaticParams = () => Object.keys(PAGES).map((page) => ({ page }))

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const page = PAGES[(await params).page]
  return { title: page?.title, robots: { index: false } }
}

export default async function FooterPage({ params }: Props) {
  const page = PAGES[(await params).page]
  if (!page) notFound()
  return (
    <TextPage title={page.title}>
      <p>{page.text}</p>
    </TextPage>
  )
}
