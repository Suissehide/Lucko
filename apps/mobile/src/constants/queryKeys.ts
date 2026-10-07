// Clés TanStack Query : un objet par entité, un fichier par entité dans src/queries/.
// Une requête paramétrée ajoute ses paramètres après la clé : [AGENDA.GET, 'past'].
export const ME = {
  GET: 'me',
  UPDATE: 'update_me',
  SET_BIRTH_DATE: 'set_me_birth_date',
  SET_AVATAR: 'set_me_avatar',
  DELETE: 'delete_me',
  ACCEPT_HOME_SAFETY: 'accept_home_safety',
} as const

export const BLOCKS = {
  GET: 'blocks',
  UNBLOCK: 'unblock_player',
} as const

export const AGENDA = {
  GET: 'agenda',
} as const

export const EXPLORE = {
  TONIGHT: 'explore_tonight',
  VENUES: 'explore_venues',
  CITY_AGENDA: 'explore_city_agenda',
  NEARBY_COUNT: 'explore_nearby_count',
} as const

export const EVENT = {
  GET: 'event',
  REGISTER: 'register_event',
  UNREGISTER: 'unregister_event',
  REPORT: 'report_event',
} as const

/** Espace gérant (LKO-61) : événements publiés par le lieu. */
export const VENUE_EVENTS = {
  LIST: 'venue_events',
  CREATE: 'create_venue_event',
  UPDATE: 'update_venue_event',
  CANCEL: 'cancel_venue_event',
} as const

export const VENUE = {
  GET: 'venue',
} as const

export const GEOCODE = {
  SEARCH: 'geocode_search',
  SUGGEST: 'geocode_suggest',
  REVERSE: 'geocode_reverse',
  ADDRESS: 'geocode_address',
} as const

export const GAMES = {
  LIST: 'games',
} as const

export const ROOM = {
  CREATE: 'create_room',
  GET: 'room',
  ADDRESS: 'room_address',
  JOIN: 'join_room',
  LEAVE: 'leave_room',
  DECIDE: 'decide_room_candidate',
  HOST_ACTION: 'room_host_action',
} as const

export const PLAY_INTENTS = {
  GET: 'play_intents',
  SET: 'set_play_intents',
  DEMAND: 'games_demand',
} as const

export const MY_GAMES = {
  GET: 'my_games',
  SET: 'set_my_games',
} as const

export const ADMIN = {
  DASHBOARD: 'admin_dashboard',
  ACTIONS: 'admin_actions',
  REPORTS: 'admin_reports',
  RESOLVE_REPORT: 'admin_resolve_report',
  USERS: 'admin_users',
  USER: 'admin_user',
  SUSPEND: 'admin_suspend',
  UNSUSPEND: 'admin_unsuspend',
  AVATARS: 'admin_avatars',
  REVIEW_AVATAR: 'admin_review_avatar',
  VENUES: 'admin_venues',
  UPDATE_VENUE: 'admin_update_venue',
  EVENTS: 'admin_events',
  SAVE_EVENT: 'admin_save_event',
  CANCEL_EVENT: 'admin_cancel_event',
  GAMES: 'admin_games',
  MERGE_GAMES: 'admin_merge_games',
} as const

export const CHAT = {
  LIST: 'chats',
  MESSAGES: 'chat_messages',
  SEND: 'send_chat_message',
  DELETE: 'delete_chat_message',
  REPORT: 'report_chat_message',
  READ: 'read_chat',
  MUTE: 'mute_chat',
} as const
