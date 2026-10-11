import { CONTACT_EMAIL } from '@lucko/design-system'
import type { Metadata } from 'next'
import { TextPage } from '../text-page'

const description =
  'Lucko aide les joueurs à trouver où jouer ce soir et les lieux ludiques à remplir leurs tables : rooms, soirées et tournois TCG, à Bordeaux pour commencer.'

export const metadata: Metadata = {
  title: 'À propos',
  description,
  alternates: { canonical: '/about' },
  openGraph: { title: 'À propos de Lucko', description, url: '/about' },
}

export default function AboutPage() {
  return (
    <TextPage title="À propos">
      <p>
        Tu as envie de jouer ce soir, mais tu ne sais pas où, ni avec qui ? Lucko réunit au même
        endroit les bars à jeux, les boutiques, les associations et les joueurs qui cherchent une
        table. Les lieux, eux, remplissent leurs soirées sans y passer des heures.
      </p>

      <h2>Pour les joueurs</h2>
      <ul>
        <li>
          <strong>Où jouer ce soir</strong> : la carte et la liste des lieux ouverts, avec leurs
          soirées et leurs tournois.
        </li>
        <li>
          <strong>Les rooms</strong> : crée ta table (jeu, format, nombre de places, lieu) ou
          rejoins celle d’un autre joueur. L’hôte accepte les candidatures.
        </li>
        <li>
          <strong>Les tournois TCG</strong> : Magic, Pokémon, Lorcana, One Piece… inscris-toi en
          quelques secondes aux événements des boutiques.
        </li>
        <li>
          <strong>Ton profil</strong> : tes jeux, ton niveau (les LK en parties classées), ton XP
          gagnée en venant jouer et ta note de confiance auprès des autres joueurs.
        </li>
      </ul>

      <h2>Pour les lieux</h2>
      <p>
        Bar à jeux, boutique, ludothèque ou association : publie tes soirées et tes tournois
        gratuitement, et retrouve les joueurs qui cherchent une table près de chez toi. Les lieux
        partenaires sont mis en avant, proposent un avantage aux joueurs Lucko et accueillent les
        rooms de leur quartier.
      </p>
      <p>
        <a href={`mailto:${CONTACT_EMAIL}?subject=Devenir%20lieu%20partenaire`}>
          Devenir lieu partenaire
        </a>
      </p>

      <h2>Bordeaux d’abord</h2>
      <p>
        Lucko démarre à Bordeaux, ville par ville, pour que chaque soirée affichée soit vraie et
        chaque lieu vérifié. Ta ville n’y est pas encore ? Écris-nous, on regarde où aller ensuite.
      </p>

      <h2>Une question ?</h2>
      <p>
        La plupart des réponses sont dans l’<a href="/help">aide</a>.
      </p>
    </TextPage>
  )
}
