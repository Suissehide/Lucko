// Build CSP de maplibre-gl : même API que l'entrée principale, sans types publiés pour ce chemin
declare module 'maplibre-gl/dist/maplibre-gl-csp' {
  import maplibregl from 'maplibre-gl'
  export default maplibregl
}
