import { CONTACT_EMAIL } from '@lucko/design-system'
import type { Metadata } from 'next'
import { TextPage, ToFill } from '../text-page'

export const metadata: Metadata = {
  title: 'Politique de confidentialité',
  alternates: { canonical: '/privacy' },
}

export default function PrivacyPage() {
  return (
    <TextPage title="Politique de confidentialité" updated="15 octobre 2026">
      <p>
        Cette page explique quelles données Lucko collecte, pourquoi, combien de temps elles sont
        gardées ainsi que tes droits. Version courte : on collecte le strict nécessaire pour te
        trouver une table, on ne vend rien à personne, aucun cookie publicitaire.
      </p>

      <h2>Responsable du traitement</h2>
      <p>
        <ToFill>Raison sociale</ToFill>, éditeur de Lucko (voir les{' '}
        <a href="/legal-notice">mentions légales</a>). Pour toute question ou pour exercer tes
        droits : <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
      </p>

      <h2>Données collectées et usages</h2>

      <h3>Ton compte</h3>
      <ul>
        <li>
          E-mail, mot de passe chiffré ou identifiant Apple / Google, nom transmis par Apple ou
          Google : pour te connecter. Base légale : exécution du contrat (les conditions
          d’utilisation).
        </li>
        <li>
          Date de naissance : pour vérifier l’âge minimum du service ainsi que celui de certains
          événements. Base légale : obligation légale (âge de consentement numérique) et exécution
          du contrat.
        </li>
        <li>
          Pour les 13-14 ans : l’e-mail du parent à qui la demande est envoyée, le lien avec son
          compte et la preuve de son accord (date, version de cette politique, adresse IP et
          navigateur utilisés pour le donner). Base légale : obligation légale.
        </li>
      </ul>

      <h3>Ton profil</h3>
      <ul>
        <li>
          Pseudo, photo, jeux pratiqués, ambiance recherchée, disponibilités habituelles : pour que
          les autres joueurs sachent avec qui ils jouent. Ta photo est analysée automatiquement
          puis, si besoin, vérifiée par l’équipe avant d’être visible.
        </li>
        <li>
          Ville, position (centre de la ville choisie ou position de ton appareil si tu la partages)
          et rayon de recherche : pour te montrer les lieux et soirées proches. Ta position n’est
          jamais suivie en continu.
        </li>
      </ul>
      <p>Base légale : exécution du contrat.</p>

      <h3>Ton activité</h3>
      <ul>
        <li>
          Rooms créées ou rejointes, inscriptions aux événements, passages dans les lieux
          partenaires, points d’expérience : pour faire fonctionner les parties, prévenir les
          organisateurs ainsi que pour ta progression.
        </li>
        <li>
          Jeux que tu attends (« Je veux jouer à… ») et moment préféré : pour te prévenir quand une
          room s’ouvre près de chez toi. Les autres joueurs et les hôtes ne voient qu’un nombre de
          joueurs par jeu, jamais qui, et seulement à partir de 3 joueurs.
        </li>
        <li>
          Sessions de connexion (adresse IP, type d’appareil et de navigateur) : pour garder ton
          compte sécurisé. Base légale : intérêt légitime (sécurité).
        </li>
      </ul>

      <h3>Les rooms à domicile</h3>
      <p>
        Si tu organises une room chez toi, ton adresse sert uniquement aux joueurs que tu as
        acceptés pour venir jouer. Les autres joueurs ne voient qu’une zone d’environ 500 m, décalée
        au hasard autour de chez toi, et le nom de ton quartier. L’adresse est chiffrée, montrée aux
        joueurs acceptés à partir de 24 h avant la partie, puis supprimée. Tu peux aussi ne pas
        l’enregistrer et la donner dans le chat de la room. Pendant la saisie, l’adresse est envoyée
        au service de géocodage de l’IGN pour te proposer des adresses. Base légale : exécution du
        contrat.
      </p>

      <h3>Les messages</h3>
      <p>
        Les messages des chats de rooms et d’événements, pour échanger entre joueurs inscrits. Il
        n’y a pas de messages privés. Les messages signalés sont lus par l’équipe de modération.
        Base légale : exécution du contrat.
      </p>

      <h3>Les notifications</h3>
      <p>
        Si tu les autorises sur ton téléphone, un identifiant de notification par appareil : pour te
        prévenir (candidature acceptée, room annulée, adresse disponible, messages). Tu peux couper
        chaque type de notification dans les réglages. Base légale : ton consentement.
      </p>

      <h3>La sécurité et la modération</h3>
      <p>
        Joueurs bloqués, signalements (motif, précisions), avertissements et suspensions : pour
        protéger les joueurs et traiter les comportements inappropriés. Base légale : intérêt
        légitime (sécurité des joueurs).
      </p>

      <h3>La liste d’attente du site</h3>
      <p>
        E-mail et ville (facultative) : uniquement pour te prévenir du lancement de Lucko près de
        chez toi. Base légale : ton consentement, retirable à tout moment.
      </p>

      <h2>Ce que voient les autres</h2>
      <p>
        Les autres joueurs voient ton pseudo, ta photo une fois validée (sinon ton initiale), tes
        jeux, ton ambiance ainsi que ta participation aux rooms et événements publics. Ils ne voient
        jamais ton e-mail, ton nom, ta date de naissance ni ta position.
      </p>

      <h2>Durées de conservation</h2>
      <ul>
        <li>
          Compte : tant qu’il est actif. À sa suppression, tout ce qui t’identifie (e-mail, nom,
          pseudo, photo, date de naissance, ville, position) est effacé immédiatement. Seul
          l’historique anonyme des parties et des passages dans les lieux est conservé (statistiques
          et facturation des lieux).
        </li>
        <li>Sessions de connexion : jusqu’à leur expiration ou ta déconnexion.</li>
        <li>
          Compte d’un 13-14 ans sans accord d’un parent : supprimé 14 jours après sa création.
        </li>
        <li>
          Preuve de l’accord parental : conservée après la suppression du compte, ou le retrait de
          l’accord, comme preuve, <ToFill>Durée maximale</ToFill>.
        </li>
        <li>Jeux que tu attends : 7 jours, sauf si tu les renouvelles.</li>
        <li>
          Adresse d’une room à domicile : supprimée à l’annulation, sinon au plus tard 6 h après la
          fin de la partie.
        </li>
        <li>
          Messages : <ToFill>Durée de conservation</ToFill>.
        </li>
        <li>
          Signalements : conservés après la suppression du compte visé, comme preuve,{' '}
          <ToFill>Durée maximale</ToFill>.
        </li>
        <li>
          Identifiant de notification : jusqu’à ta déconnexion ou la désinstallation de l’app.
        </li>
        <li>Liste d’attente : jusqu’au lancement dans ta ville, au plus tard 3 ans.</li>
      </ul>

      <h2>Destinataires et sous-traitants</h2>
      <p>Tes données ne sont ni vendues ni louées. Elles sont traitées par :</p>
      <ul>
        <li>
          OVHcloud (France) : hébergement du site, de l’app, de la base de données ainsi que des
          photos de profil ;
        </li>
        <li>Resend : envoi des e-mails (confirmation, mot de passe oublié, informations) ;</li>
        <li>
          Apple et Google : uniquement si tu choisis de te connecter avec eux, selon leurs propres
          politiques ;
        </li>
        <li>
          Géoplateforme de l’IGN (France) : recherche de ta ville, et de ton adresse si tu organises
          une room à domicile (rien n’y est conservé par Lucko) ;
        </li>
        <li>Expo, puis Apple et Google : acheminement des notifications vers ton téléphone ;</li>
        <li>Sightengine : analyse automatique des photos de profil avant leur vérification ;</li>
        <li>
          OpenStreetMap (Royaume-Uni) : fonds de carte. Ton appareil les télécharge directement, le
          serveur de cartes voit donc ton adresse IP.
        </li>
      </ul>
      <p>
        Resend et Expo étant basés aux États-Unis, ces transferts hors de l’Union européenne sont
        encadrés par{' '}
        <ToFill>
          Garanties de transfert de chaque prestataire (clauses contractuelles types ou Data Privacy
          Framework)
        </ToFill>
        . Le Royaume-Uni bénéficie d’une décision d’adéquation de la Commission européenne.
      </p>

      <h2>Cookies et mesure d’audience</h2>
      <p>
        Lucko ne dépose aucun cookie publicitaire ni traceur tiers. Le seul cookie utilisé garde ta
        session ouverte une fois connecté : il est indispensable au service, il ne demande donc pas
        de consentement. La mesure d’audience (Umami) est anonyme, sans cookie : elle compte les
        visites sans te suivre d’un site à l’autre.
      </p>

      <h2>Tes droits</h2>
      <p>Tu peux à tout moment :</p>
      <ul>
        <li>accéder à tes données ou en obtenir une copie (portabilité) ;</li>
        <li>les corriger, la plupart directement depuis ton profil ;</li>
        <li>les effacer, en supprimant ton compte depuis l’app ;</li>
        <li>t’opposer à un traitement ou en demander la limitation ;</li>
        <li>retirer ton consentement (liste d’attente) ;</li>
        <li>définir ce que deviennent tes données après ton décès.</li>
      </ul>
      <p>
        Écris à <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> : on répond sous un mois. Si
        la réponse ne te convient pas, tu peux saisir la{' '}
        <a href="https://www.cnil.fr/fr/plaintes">CNIL</a>.
      </p>

      <h2>Mineurs</h2>
      <p>
        Lucko est interdit aux moins de 13 ans. Entre 13 et 14 ans, l’inscription nécessite l’accord
        d’un parent, qui peut exercer les droits ci-dessus pour le compte de son enfant. Il reçoit
        un e-mail et donne son accord depuis son propre compte Lucko, lié à celui de l’enfant.
        Jusque-là, le compte de l’enfant ne permet que de consulter.
      </p>
      <p>
        Depuis Réglages, Mes enfants, le parent voit les parties, les soirées et les signalements de
        son enfant, jamais ses messages. Il peut retirer son accord à tout moment : le compte de
        l’enfant est alors supprimé. À 15 ans, le compte devient autonome : le parent en est prévenu
        et ne voit plus son activité.
      </p>
      <p>
        Pour protéger les 13-17 ans : pas de messages privés, seulement les chats des rooms et
        événements qui leur sont ouverts ; pas de rooms à domicile ni, pour les moins de 16 ans, de
        rooms dans un bar, sauf avec leur parent lié ; pas de notifications la nuit. Les autres
        joueurs ne voient jamais leur âge.
      </p>
    </TextPage>
  )
}
