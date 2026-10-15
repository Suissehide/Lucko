import { colors } from './index'

/**
 * Style de carte « Plateau pop » (LKO-122) : spécification de style MapLibre sur les tuiles vectorielles
 * OpenFreeMap (schéma OpenMapTiles, sans clé). Même objet pour le web (maplibre-gl) et le mobile
 * (maplibre-react-native). Pas de points d'intérêt : les seules épingles sont les lieux Lucko. Pas de
 * couche `park` non plus : elle couvre les espaces protégés (tout le centre UNESCO de Bordeaux) ; les
 * jardins sont dans `landcover`.
 */
const FONT = ['Noto Sans Regular']
const FONT_BOLD = ['Noto Sans Bold']
const water = colors.eventSoft
const green = colors.venueSoft
const road = colors.white
const roadEdge = colors.line

/** Largeur d'une route selon le zoom (exponentielle, comme les styles OpenMapTiles). */
const width = (z12: number, z18: number) => [
  'interpolate',
  ['exponential', 1.5],
  ['zoom'],
  12,
  z12,
  18,
  z18,
]

const roadClass = (...classes: string[]) => ['match', ['get', 'class'], classes, true, false]

const roads = (
  id: string,
  classes: string[],
  { fill, edge, z12, z18 }: { fill: string; edge: string; z12: number; z18: number },
) => [
  {
    id: `${id}-edge`,
    type: 'line',
    source: 'openmaptiles',
    'source-layer': 'transportation',
    filter: roadClass(...classes),
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': edge, 'line-width': width(z12 + 1, z18 + 3) },
  },
  {
    id,
    type: 'line',
    source: 'openmaptiles',
    'source-layer': 'transportation',
    filter: roadClass(...classes),
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': fill, 'line-width': width(z12, z18) },
  },
]

export const mapStyle = {
  version: 8,
  name: 'Lucko',
  glyphs: 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf',
  sources: {
    openmaptiles: { type: 'vector', url: 'https://tiles.openfreemap.org/planet' },
  },
  layers: [
    { id: 'background', type: 'background', paint: { 'background-color': colors.cream } },
    {
      id: 'landuse',
      type: 'fill',
      source: 'openmaptiles',
      'source-layer': 'landuse',
      filter: ['match', ['get', 'class'], ['residential', 'suburb', 'neighbourhood'], true, false],
      paint: { 'fill-color': colors.creamDark },
    },
    {
      id: 'green',
      type: 'fill',
      source: 'openmaptiles',
      'source-layer': 'landcover',
      filter: ['match', ['get', 'class'], ['grass', 'wood', 'farmland'], true, false],
      paint: { 'fill-color': green, 'fill-opacity': 0.7 },
    },
    {
      id: 'water',
      type: 'fill',
      source: 'openmaptiles',
      'source-layer': 'water',
      paint: { 'fill-color': water },
    },
    {
      id: 'waterway',
      type: 'line',
      source: 'openmaptiles',
      'source-layer': 'waterway',
      paint: { 'line-color': water, 'line-width': width(1, 4) },
    },
    {
      id: 'building',
      type: 'fill',
      source: 'openmaptiles',
      'source-layer': 'building',
      minzoom: 14,
      paint: { 'fill-color': colors.creamPale, 'fill-outline-color': colors.line },
    },
    {
      id: 'rail',
      type: 'line',
      source: 'openmaptiles',
      'source-layer': 'transportation',
      filter: roadClass('rail', 'transit'),
      paint: { 'line-color': colors.inactive, 'line-width': 1, 'line-dasharray': [3, 3] },
    },
    ...roads('minor', ['minor', 'service', 'track'], {
      fill: road,
      edge: roadEdge,
      z12: 0.5,
      z18: 10,
    }),
    ...roads('main', ['primary', 'secondary', 'tertiary', 'trunk'], {
      fill: road,
      edge: colors.muted,
      z12: 1.5,
      z18: 16,
    }),
    ...roads('motorway', ['motorway'], {
      fill: colors.ratingSoft,
      edge: colors.ink,
      z12: 2,
      z18: 18,
    }),
    {
      id: 'boundary',
      type: 'line',
      source: 'openmaptiles',
      'source-layer': 'boundary',
      filter: ['<=', ['get', 'admin_level'], 4],
      paint: { 'line-color': colors.inactive, 'line-width': 1, 'line-dasharray': [4, 2] },
    },
    {
      id: 'water-name',
      type: 'symbol',
      source: 'openmaptiles',
      'source-layer': 'water_name',
      layout: { 'text-field': ['get', 'name'], 'text-font': FONT, 'text-size': 12 },
      paint: { 'text-color': colors.event, 'text-halo-color': colors.white, 'text-halo-width': 1 },
    },
    {
      id: 'road-name',
      type: 'symbol',
      source: 'openmaptiles',
      'source-layer': 'transportation_name',
      minzoom: 14,
      layout: {
        'symbol-placement': 'line',
        'text-field': ['get', 'name'],
        'text-font': FONT,
        'text-size': 11,
      },
      paint: {
        'text-color': colors.muted,
        'text-halo-color': colors.white,
        'text-halo-width': 1.5,
      },
    },
    {
      id: 'place',
      type: 'symbol',
      source: 'openmaptiles',
      'source-layer': 'place',
      filter: [
        'match',
        ['get', 'class'],
        ['city', 'town', 'village', 'suburb', 'quarter', 'neighbourhood'],
        true,
        false,
      ],
      layout: {
        'text-field': ['get', 'name'],
        'text-font': FONT_BOLD,
        'text-size': ['match', ['get', 'class'], ['city', 'town'], 15, 12],
        'text-transform': 'uppercase',
        'text-letter-spacing': 0.05,
      },
      paint: { 'text-color': colors.ink, 'text-halo-color': colors.cream, 'text-halo-width': 2 },
    },
  ],
}

/** Ludothèques et associations sur la carte (pas de couleur de contenu dédiée dans le design system). */
const play = '#8C5AD8'

/**
 * Remplissage des épingles de lieu par type (carte et `MapLegend`). Le partenaire se distingue par un
 * anneau `colors.venue`, le lieu choisi par `selected`.
 */
export const venuePin = {
  type: {
    GAME_BAR: colors.event,
    TCG_SHOP: colors.rating,
    CAFE: colors.white,
    LUDOTHEQUE: play,
    ASSOCIATION: play,
    BAR: colors.inactive,
    OTHER: colors.inactive,
  },
  partnerRing: colors.venue,
  selected: colors.room,
} as const
