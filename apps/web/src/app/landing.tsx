'use client'
import { useGSAP } from '@gsap/react'
import { RATING_START } from '@lucko/shared'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import dynamic from 'next/dynamic'
import { useRef } from 'react'
import s from './landing.module.css'
import { Footer } from './site-footer'
import { WaitlistForm } from './waitlist-form'

gsap.registerPlugin(ScrollTrigger, useGSAP)

// Three.js (~150 ko) chargé à part, après l'hydratation : le texte du hero reste le premier affichage
const HeroScene = dynamic(() => import('@lucko/design-system/scene'), { ssr: false })

const games = [
  'Magic: The Gathering',
  'Pokémon',
  'One Piece',
  'Lorcana',
  'Yu-Gi-Oh!',
  'Flesh and Blood',
  'Catan',
  'Dixit',
  'Les Aventuriers du Rail',
  'Codenames',
  '7 Wonders',
  'Échecs',
]

const steps = [
  {
    title: 'Dis-nous à quoi tu joues',
    text: 'Tes jeux, tes formats, ton niveau. Lucko s’en sert pour te proposer les bonnes soirées.',
  },
  {
    title: 'Choisis ta soirée',
    text: 'Carte et liste des lieux ouverts ce soir, avec les places restantes et le droit de jeu.',
  },
  {
    title: 'Viens jouer',
    text: 'Inscris-toi en un geste, passe au lieu et ta partie compte pour tes LK et ton XP.',
  },
]

/** Landing joueurs : promesse, fonctionnement, inscription à la liste d'attente (LKO-3). */
export function Landing() {
  const root = useRef<HTMLDivElement>(null)

  useGSAP(
    () => {
      const mm = gsap.matchMedia()
      mm.add('(prefers-reduced-motion: no-preference)', () => {
        gsap
          .timeline({ defaults: { ease: 'power3.out', duration: 0.5 } })
          .from('[data-hero-line]', { yPercent: 20, opacity: 0, stagger: 0.06 })
          .from(
            '[data-hero-card]',
            { y: 40, opacity: 0, stagger: 0.06, clearProps: 'transform,opacity' },
            '-=0.35',
          )

        for (const step of gsap.utils.toArray<HTMLElement>('[data-reveal]')) {
          gsap.from(step, {
            y: 30,
            opacity: 0,
            duration: 0.5,
            ease: 'power3.out',
            scrollTrigger: { trigger: step, start: 'top 85%' },
          })
        }
      })
    },
    { scope: root },
  )

  return (
    <div ref={root} className={s.page}>
      <nav className={s.nav} aria-label="Principale">
        <span className={s.logo}>Lucko</span>
        <a className="lk-btn lk-btn--sm lk-btn--ink" href="#liste">
          Rejoindre la liste
        </a>
      </nav>

      <main>
        <header className={`${s.wrap} ${s.hero}`}>
          <h1 data-hero-line className={s.heroTitle}>
            Trouve une table ce soir, près de chez toi.
          </h1>
          <div className={s.heroSplit}>
            <div className={s.heroText}>
              <p data-hero-line className={s.lead}>
                Soirées jeux, tournois TCG, joueurs qui cherchent un adversaire : Lucko réunit les
                bars à jeux, boutiques et associations de toute la France dans une seule app.
              </p>
              <div data-hero-line className={s.ctas}>
                <a className="lk-btn lk-btn--room" href="#liste">
                  Rejoindre la liste
                </a>
                <a className="lk-btn lk-btn--ghost" href="#comment">
                  Comment ça marche
                </a>
              </div>
            </div>
            <div className={s.stack} aria-hidden="true">
              <HeroScene className={s.scene} />
              <article data-hero-card className={`lk-card lk-card--raised ${s.mock} ${s.mock1}`}>
                <div className="lk-card__stripe" style={{ background: 'var(--lk-event)' }} />
                <div className="lk-card__body">
                  <span className="lk-label">Soirée · jeudi 20 h</span>
                  <span className="lk-title">Commander entre amis</span>
                  <span className="lk-small">Bar à jeux · 1,2 km · 4 places</span>
                </div>
              </article>
              <article data-hero-card className={`lk-card lk-card--raised ${s.mock} ${s.mock2}`}>
                <div className="lk-card__stripe" style={{ background: 'var(--lk-room)' }} />
                <div className="lk-card__body">
                  <span className="lk-label">Partie classée · Pokémon</span>
                  <span className="lk-title">Il manque 2 joueurs</span>
                  <span>
                    <span className="lk-rating">1 180 - 1 260</span>
                  </span>
                </div>
              </article>
              <article data-hero-card className={`lk-card lk-card--raised ${s.mock} ${s.mock3}`}>
                <div className="lk-card__stripe" style={{ background: 'var(--lk-venue)' }} />
                <div className="lk-card__body">
                  <span>
                    <span className="lk-tag lk-tag--partner">Partenaire</span>
                  </span>
                  <span className="lk-title">-10 % sur les boosters</span>
                  <span className="lk-small">Boutique TCG · 800 m</span>
                </div>
              </article>
            </div>
          </div>
        </header>

        <section className={s.marquee} aria-label="Jeux">
          <div className={s.marqueeTrack}>
            {[0, 1].map((copy) => (
              <ul key={copy} aria-hidden={copy === 1 || undefined}>
                {games.map((game) => (
                  <li key={game}>{game}</li>
                ))}
              </ul>
            ))}
          </div>
        </section>

        <section className={`${s.wrap} ${s.section}`}>
          <h2 className={s.h2}>De quoi remplir tes soirées</h2>
          <div className={s.bento}>
            <article data-reveal className={`${s.tile} ${s.tileEvent}`}>
              <span className={s.tileMeta}>Ce soir</span>
              <h3 className={s.tileTitle}>Une soirée jeux à deux pas.</h3>
              <p className={s.tileText}>
                Tournoi, initiation ou partie libre. Tu choisis, tu t’inscris, tu viens.
              </p>
            </article>
            <article data-reveal className={`${s.tile} ${s.tileRating}`}>
              <span className={s.tileNumber}>{RATING_START.toLocaleString('fr-FR')}</span>
              <h3 className={s.tileTitle}>Tes LK de départ.</h3>
              <p className={s.tileText}>
                Tu gagnes, elle monte. Tu perds, elle descend. En face, des joueurs de ton niveau.
              </p>
            </article>
            <article data-reveal className={`${s.tile} ${s.tileRoom}`}>
              <h3 className={s.tileTitle}>Il vous manque un quatrième ?</h3>
              <p className={s.tileText}>Ouvre ta table. Les joueurs du coin la voient.</p>
            </article>
            <article data-reveal className={`${s.tile} ${s.tileVenue}`}>
              <h3 className={s.tileTitle}>Un bonus en venant avec Lucko.</h3>
              <p className={s.tileText}>
                Une boisson, une réduc sur les boosters : chaque lieu partenaire choisit le sien.
              </p>
            </article>
          </div>
        </section>

        <section id="comment" className={`${s.wrap} ${s.section} ${s.how}`}>
          <h2 className={`${s.h2} ${s.pinned}`}>Trois gestes et tu joues.</h2>
          <ol className={s.steps}>
            {steps.map((step) => (
              <li key={step.title} data-reveal className={`lk-card lk-card--raised ${s.step}`}>
                <h3 className={s.stepTitle}>{step.title}</h3>
                <p>{step.text}</p>
              </li>
            ))}
          </ol>
        </section>

        <section id="liste" className={s.action}>
          <div className={`${s.wrap} ${s.actionGrid}`}>
            <div>
              <h2 className={s.actionTitle}>Sois là au lancement.</h2>
              <p className={s.actionLead}>
                Lucko ouvre ville par ville. Laisse ton e-mail, on te prévient dès que l’app arrive
                près de chez toi.
              </p>
            </div>
            <div className={`lk-card ${s.formCard}`}>
              <WaitlistForm />
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  )
}
