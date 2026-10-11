import type { Metadata } from 'next'
import { TextPage } from '../text-page'
import s from '../text-page.module.css'

const description =
  'Les réponses aux questions sur Lucko : compte, âge minimum, rooms, sécurité, inscriptions aux événements, LK et XP, lieux partenaires.'

export const metadata: Metadata = {
  title: 'Aide',
  description,
  alternates: { canonical: '/help' },
  openGraph: { title: 'Aide — Lucko', description, url: '/help' },
}

/** FAQ par thème ; l'id sert d'ancre (/help#rooms) pour lier un thème depuis l'app. */
const FAQ: { id: string; title: string; items: { q: string; a: string }[] }[] = [
  {
    id: 'compte',
    title: 'Compte et connexion',
    items: [
      {
        q: 'Comment créer un compte ?',
        a: 'Avec ton adresse e-mail, ou en un clic avec Apple ou Google. On te demande ta date de naissance à l’inscription, puis tes jeux, ta ville et ton pseudo.',
      },
      {
        q: 'Je n’arrive plus à me connecter, que faire ?',
        a: 'Vérifie que tu utilises la même méthode qu’à l’inscription (e-mail, Apple ou Google). Si ça bloque toujours, écris-nous depuis l’adresse de ton compte.',
      },
    ],
  },
  {
    id: 'age',
    title: 'Âge minimum et mineurs',
    items: [
      {
        q: 'À partir de quel âge peut-on utiliser Lucko ?',
        a: 'Dès 13 ans. La date de naissance est obligatoire à l’inscription.',
      },
      {
        q: 'Quelles règles pour les 13-17 ans ?',
        a: 'Un profil mineur n’apparaît pas dans les listes de joueurs, ne peut pas échanger de messages privés avec un adulte en dehors d’une room, et n’a pas accès aux rooms à domicile. Les soirées réservées aux majeurs ne lui sont pas proposées.',
      },
    ],
  },
  {
    id: 'rooms',
    title: 'Rooms',
    items: [
      {
        q: 'C’est quoi une room ?',
        a: 'Une table ouverte par un joueur : un jeu, un format, un lieu, une date et un nombre de places. Tu candidates, l’hôte accepte, et vous vous retrouvez sur place.',
      },
      {
        q: 'Quelle différence entre une room classée et une room normale ?',
        a: 'En room classée (TCG), les résultats comptent pour tes LK. En room normale, on joue pour le plaisir : seule ta présence compte, pour ton XP.',
      },
      {
        q: 'Je ne peux plus venir, comment annuler ?',
        a: 'Retire-toi de la room depuis l’app le plus tôt possible : ta place revient à la liste d’attente. Les annulations de dernière minute et les absences comptent dans ta fiabilité.',
      },
    ],
  },
  {
    id: 'securite',
    title: 'Sécurité',
    items: [
      {
        q: 'Comment fonctionnent les rooms à domicile ?',
        a: 'Avant d’être accepté, tu ne vois qu’une zone approximative d’environ 500 m. L’adresse exacte n’est révélée qu’aux joueurs acceptés, 24 h avant la partie, puis supprimée après. L’hôte doit accepter chaque joueur.',
      },
      {
        q: 'Qui peut rejoindre une room à domicile ?',
        a: 'Uniquement des joueurs majeurs (sauf un mineur accompagné de son parent lié) avec une note de confiance suffisante. Si tu ne te sens pas à l’aise, choisis plutôt une room dans un lieu public.',
      },
      {
        q: 'Un joueur pose problème, que faire ?',
        a: 'Depuis son profil ou un message, tu peux le bloquer et le signaler. Les signalements sont traités par l’équipe Lucko.',
      },
    ],
  },
  {
    id: 'evenements',
    title: 'Inscriptions aux événements',
    items: [
      {
        q: 'Comment m’inscrire à une soirée ou un tournoi ?',
        a: 'Ouvre l’événement depuis la fiche du lieu ou l’agenda et appuie sur « S’inscrire ». Certains lieux gèrent les inscriptions sur leur propre site : le bouton t’y emmène.',
      },
      {
        q: 'Je ne peux plus venir à un événement, que faire ?',
        a: 'Désinscris-toi depuis l’événement dans l’app, pour libérer ta place. Pour un tournoi payant, le remboursement dépend du lieu organisateur.',
      },
    ],
  },
  {
    id: 'lk-xp',
    title: 'LK et XP',
    items: [
      {
        q: 'C’est quoi les LK ?',
        a: 'Ton niveau en parties classées, calculé à partir de tes résultats. Tout le monde démarre autour de 1000, et ton niveau bouge plus vite pendant tes 20 premières parties classées.',
      },
      {
        q: 'Comment gagner de l’XP ?',
        a: 'En venant jouer : chaque présence vérifiée (scan au comptoir ou pointage par l’hôte) te rapporte de l’XP, avec des bonus dans les lieux partenaires et certains soirs.',
      },
    ],
  },
  {
    id: 'partenaires',
    title: 'Lieux partenaires',
    items: [
      {
        q: 'C’est quoi un lieu partenaire ?',
        a: 'Un lieu qui travaille avec Lucko : il affiche un badge, propose un avantage aux joueurs Lucko et accueille volontiers les rooms.',
      },
      {
        q: 'Comment profiter de l’avantage partenaire ?',
        a: 'Montre ton QR Lucko au comptoir (depuis ton profil) : le lieu le scanne, ta présence est validée et l’avantage s’applique.',
      },
      {
        q: 'Je gère un lieu, comment le rejoindre ?',
        a: 'Publier tes soirées sur Lucko est gratuit. Pour devenir partenaire, écris-nous : on te rappelle pour en parler.',
      },
    ],
  },
  {
    id: 'suppression',
    title: 'Suppression du compte',
    items: [
      {
        q: 'Comment supprimer mon compte ?',
        a: 'Dans l’app : Réglages, section Compte, « Supprimer mon compte ». La suppression est définitive.',
      },
    ],
  },
]

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: FAQ.flatMap(({ items }) =>
    items.map(({ q, a }) => ({
      '@type': 'Question',
      name: q,
      acceptedAnswer: { '@type': 'Answer', text: a },
    })),
  ),
}

export default function HelpPage() {
  return (
    <TextPage title="Aide">
      <script
        type="application/ld+json"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD statique, `<` échappé
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }}
      />
      <nav aria-label="Thèmes">
        <ul>
          {FAQ.map(({ id, title }) => (
            <li key={id}>
              <a href={`#${id}`}>{title}</a>
            </li>
          ))}
        </ul>
      </nav>
      {FAQ.map(({ id, title, items }) => (
        <section key={id} id={id} className={s.anchor}>
          <h2>{title}</h2>
          {/* <details> natif : clavier, lecteur d'écran et texte indexé sans JS */}
          <div className={s.faq}>
            {items.map(({ q, a }) => (
              <details key={q}>
                <summary>{q}</summary>
                <p>{a}</p>
              </details>
            ))}
          </div>
        </section>
      ))}
    </TextPage>
  )
}
