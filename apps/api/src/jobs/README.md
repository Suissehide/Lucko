# Tâches pg-boss

`JobsService` (LKO-106, LKO-97) : un module déclare ses tâches avec `handle()` dans son `onModuleInit` et les programme avec `send()`. Les tâches vivent dans Postgres (schéma `pgboss`) : un redémarrage n'en perd aucune, et `singletonKey` évite les doublons.

## Échecs

- Toute file a 5 nouveaux essais espacés de façon exponentielle à partir de 30 s (`QUEUE_DEFAULTS`), réappliqués à chaque démarrage.
- Chaque échec est journalisé (`Jobs`, avec la pile) ; chaque succès aussi, en debug, avec sa durée.
- Après le dernier essai, une copie part dans la file `jobs.failed`, avec la file d'origine (`source_name`) et l'erreur (`source_output`). Elle y reste 14 jours.

Suivi des files :

```sql
SELECT name, state, count(*) FROM pgboss.job GROUP BY 1, 2 ORDER BY 1, 2;
SELECT source_name, source_output->>'message', created_on FROM pgboss.job WHERE name = 'jobs.failed';
```

## Tâches

| Tâche | Déclencheur | Quand | Module |
|---|---|---|---|
| `mail` | envoi d'un e-mail | tout de suite | mail |
| `push` | envoi d'une notification | tout de suite ou à l'heure donnée | push |
| `push-receipts` | après un `push` | 15 min plus tard | push |
| `rooms.reminder` | création de room | la veille à 18 h et 2 h avant | rooms (LKO-59) |
| `rooms.home-reveal` | création de room à domicile | 24 h avant | rooms (LKO-71) |
| `rooms.home-purge` | cron | toutes les heures | rooms (LKO-71) |
| `rooms.attendance-reminder` | création de room | à la fin de la partie | rooms (LKO-78) |
| `play-intents-room-opened` | création de room | tout de suite | play-intents (LKO-17) |
| `play-intents-purge` | cron | 4 h chaque nuit | play-intents (LKO-17) |
| `events-materialize` | cron | 4 h chaque nuit | events (LKO-61) |

Les tâches des fonctionnalités à venir (évaluations LKO-84, facturation LKO-96, saisons LKO-91, purge des messages LKO-82) arrivent avec leur ticket ; ajouter alors leur ligne ici.
