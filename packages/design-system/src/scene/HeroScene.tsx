/// <reference lib="dom" />
'use client'
// Web uniquement (Three.js + DOM) : importé à part via `@lucko/design-system/scene`,
// jamais depuis l'index (l'app native ne doit pas l'embarquer).
import gsap from 'gsap'
import { type CSSProperties, useEffect, useRef } from 'react'
import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'

// Couleurs « Plateau pop » (packages/design-system/css/lucko.css)
const INK = 0x16130f
const RATING = 0xf5b800
const ROOM = 0xcf3a22
const EVENT = 0x2747d6
const VENUE = 0x157a55
const WHITE = 0xffffff

/** Largeur de table visible, en unités monde : les pièces gardent la même taille relative à l'écran. */
const TABLE_WIDTH = 12
const ELEVATION = THREE.MathUtils.degToRad(58)

/** Dégradé à 3 tons, rendu « cartoon » qui va avec les ombres dures du design system. */
function toonRamp() {
  const ramp = new THREE.DataTexture(new Uint8Array([150, 215, 255]), 3, 1, THREE.RedFormat)
  ramp.minFilter = THREE.NearestFilter
  ramp.magFilter = THREE.NearestFilter
  ramp.needsUpdate = true
  return ramp
}

/** Contour encre : copie agrandie de la géométrie, faces arrière seulement (technique « inverted hull »). */
function outlined(geometry: THREE.BufferGeometry, material: THREE.Material, thickness = 0.06) {
  geometry.computeBoundingBox()
  const size = geometry.boundingBox?.getSize(new THREE.Vector3()) ?? new THREE.Vector3(1, 1, 1)
  const mesh = new THREE.Mesh(geometry, material)
  mesh.castShadow = true
  const hull = new THREE.Mesh(
    geometry,
    new THREE.MeshBasicMaterial({ color: INK, side: THREE.BackSide }),
  )
  hull.scale.set(
    (size.x + thickness * 2) / size.x,
    (size.y + thickness * 2) / size.y,
    (size.z + thickness * 2) / size.z,
  )
  mesh.add(hull)
  return mesh
}

/** Dé à 6 faces ; face 4 vers le haut (+y) au repos. */
function makeDie(toon: (color: number) => THREE.Material) {
  const size = 1.1
  const die = outlined(new RoundedBoxGeometry(size, size, size, 4, 0.16), toon(RATING))
  const pip = new THREE.CircleGeometry(0.09, 20)
  const pipMat = new THREE.MeshBasicMaterial({ color: INK })
  const o = 0.27
  const layouts: Record<number, [number, number][]> = {
    1: [[0, 0]],
    2: [
      [-o, -o],
      [o, o],
    ],
    3: [
      [-o, -o],
      [0, 0],
      [o, o],
    ],
    4: [
      [-o, -o],
      [o, -o],
      [-o, o],
      [o, o],
    ],
    5: [
      [-o, -o],
      [o, -o],
      [0, 0],
      [-o, o],
      [o, o],
    ],
    6: [
      [-o, -o],
      [o, -o],
      [-o, 0],
      [o, 0],
      [-o, o],
      [o, o],
    ],
  }
  // Faces opposées = 7 : 4 en haut, 3 en bas, 1/6 et 2/5 sur les côtés
  const faces: [number, THREE.Euler][] = [
    [4, new THREE.Euler(-Math.PI / 2, 0, 0)],
    [3, new THREE.Euler(Math.PI / 2, 0, 0)],
    [1, new THREE.Euler(0, 0, 0)],
    [6, new THREE.Euler(0, Math.PI, 0)],
    [2, new THREE.Euler(0, Math.PI / 2, 0)],
    [5, new THREE.Euler(0, -Math.PI / 2, 0)],
  ]
  for (const [value, rotation] of faces) {
    const face = new THREE.Group()
    face.rotation.copy(rotation)
    for (const [x, y] of layouts[value] ?? []) {
      const dot = new THREE.Mesh(pip, pipMat)
      dot.position.set(x, y, size / 2 + 0.002)
      face.add(dot)
    }
    die.add(face)
  }
  die.position.y = size / 2
  return die
}

/** Pion de jeu de plateau (profil tourné). */
function makePawn(toon: (color: number) => THREE.Material) {
  const profile = [
    [0, 0],
    [0.5, 0],
    [0.5, 0.1],
    [0.42, 0.18],
    [0.24, 0.5],
    [0.19, 0.86],
    [0.3, 0.93],
    [0.18, 1.0],
  ].map(([x, y]) => new THREE.Vector2(x, y))
  const pawn = new THREE.Group()
  const body = new THREE.LatheGeometry(profile, 32)
  body.translate(0, -0.5, 0)
  const bodyMesh = outlined(body, toon(ROOM))
  bodyMesh.position.y = 0.5
  const head = outlined(new THREE.SphereGeometry(0.27, 24, 16), toon(ROOM))
  head.position.y = 1.22
  pawn.add(bodyMesh, head)
  return pawn
}

/** Carte à jouer, dos bleu avec un cadre blanc. */
function makeCard(toon: (color: number) => THREE.Material) {
  const card = outlined(new RoundedBoxGeometry(1.26, 0.06, 1.76, 2, 0.03), toon(EVENT), 0.05)
  const frame = new THREE.Mesh(
    new THREE.RingGeometry(0.4, 0.48, 4, 1, Math.PI / 4),
    new THREE.MeshBasicMaterial({ color: WHITE }),
  )
  frame.rotation.x = -Math.PI / 2
  frame.scale.set(1.15, 1.65, 1)
  frame.position.y = 0.032
  card.add(frame)
  card.position.y = 0.03
  return card
}

/** Jeton de poker vert et blanc. */
function makeChip(toon: (color: number) => THREE.Material) {
  const chip = outlined(new THREE.CylinderGeometry(0.62, 0.62, 0.16, 40), toon(VENUE), 0.05)
  const notch = new THREE.BoxGeometry(0.16, 0.17, 0.12)
  const white = new THREE.MeshBasicMaterial({ color: WHITE })
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2
    const n = new THREE.Mesh(notch, white)
    n.position.set(Math.cos(a) * 0.57, 0, Math.sin(a) * 0.57)
    n.rotation.y = -a
    chip.add(n)
  }
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.34, 0.4, 40), white)
  ring.rotation.x = -Math.PI / 2
  ring.position.y = 0.082
  chip.add(ring)
  chip.position.y = 0.08
  return chip
}

type Piece = {
  object: THREE.Object3D
  /** Position au repos, en fraction de la table visible (-1 → 1, de gauche à droite / de haut en bas). */
  home: [number, number]
  /** Rotation au repos autour de l'axe vertical. */
  turn: number
}

/**
 * Quatre pièces lancées sur la table (hero de la landing, accueil de l'app sur desktop) : un dé (qui tombe sur 4, comme le logo), un pion,
 * une carte et un jeton. Purement décoratif (aria-hidden), chargé après l'hydratation.
 */
export default function HeroScene({
  className,
  style,
  bleed,
}: {
  /** Placement de la scène (position absolue sur son conteneur) ; elle démarre à opacity 0. */
  className?: string
  style?: CSSProperties
  /**
   * Marge de dessin autour de la boîte, en px : la table reste cadrée sur la boîte, mais les pièces
   * qui tombent ou débordent restent visibles jusqu'à `bleed` px au-delà (sinon le canvas les coupe).
   * Sans `bleed`, dimensionner le canvas en CSS (il peut déborder de la boîte, le cadrage suit).
   */
  bleed?: number
}) {
  const host = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = host.current
    if (!el) return

    let renderer: THREE.WebGLRenderer
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    } catch {
      return // Pas de WebGL : la page reste complète sans la scène
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFShadowMap
    // Sans `bleed`, le canvas se dimensionne en CSS chez l'appelant (ex. `.scene canvas` de la landing)
    if (bleed !== undefined)
      renderer.domElement.style.cssText = `display:block;position:absolute;inset:${-bleed}px;width:calc(100% + ${bleed * 2}px);height:calc(100% + ${bleed * 2}px)`
    el.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100)

    scene.add(new THREE.HemisphereLight(WHITE, 0xfff1d6, 1.4))
    // Lumière en haut à gauche : ombres portées vers le bas à droite, comme --lk-sh-lg
    const sun = new THREE.DirectionalLight(WHITE, 2.2)
    sun.position.set(-4, 10, -3)
    sun.castShadow = true
    sun.shadow.mapSize.set(2048, 2048)
    sun.shadow.camera.left = -8
    sun.shadow.camera.right = 8
    sun.shadow.camera.top = 8
    sun.shadow.camera.bottom = -8
    scene.add(sun)

    // Table invisible qui ne reçoit que les ombres, en encre pleine
    const table = new THREE.Mesh(
      new THREE.PlaneGeometry(40, 40),
      new THREE.ShadowMaterial({ color: INK, opacity: 0.9 }),
    )
    table.rotation.x = -Math.PI / 2
    table.receiveShadow = true
    scene.add(table)

    const ramp = toonRamp()
    const toon = (color: number) => new THREE.MeshToonMaterial({ color, gradientMap: ramp })

    const pieces: Piece[] = [
      { object: makeCard(toon), home: [-0.76, 0.04], turn: 1.35 },
      { object: makeDie(toon), home: [0.72, -0.66], turn: 0.35 },
      { object: makePawn(toon), home: [-0.64, 0.66], turn: 0 },
      { object: makeChip(toon), home: [0.66, 0.62], turn: 0.2 },
    ]
    const holders = pieces.map(({ object, turn }) => {
      const holder = new THREE.Group()
      const spin = new THREE.Group()
      spin.rotation.y = turn
      spin.add(object)
      holder.add(spin)
      scene.add(holder)
      return holder
    })

    let halfDepth = 3
    function resize() {
      if (!el) return
      const frame = el.getBoundingClientRect()
      const canvas = renderer.domElement.getBoundingClientRect()
      if (!frame.width || !frame.height || !canvas.width || !canvas.height) return
      renderer.setSize(canvas.width, canvas.height, false)
      const aspect = frame.width / frame.height
      camera.aspect = aspect
      // Recule la caméra pour que TABLE_WIDTH remplisse toujours la largeur
      const vFov = THREE.MathUtils.degToRad(camera.fov)
      const hFov = 2 * Math.atan(Math.tan(vFov / 2) * aspect)
      const distance = TABLE_WIDTH / 2 / Math.tan(hFov / 2)
      camera.position.set(0, Math.sin(ELEVATION) * distance, Math.cos(ELEVATION) * distance)
      camera.lookAt(0, 0, 0)
      // Cadrage calculé sur la boîte, rendu sur tout le canvas (qui déborde autour : `bleed` ou CSS)
      camera.setViewOffset(
        frame.width,
        frame.height,
        canvas.left - frame.left,
        canvas.top - frame.top,
        canvas.width,
        canvas.height,
      )
      halfDepth = TABLE_WIDTH / 2 / aspect / Math.sin(ELEVATION)
      pieces.forEach(({ home }, i) => {
        // x et z seulement : y appartient à l'animation de lancer
        holders[i]?.position.setX((home[0] * TABLE_WIDTH) / 2).setZ(home[1] * halfDepth)
      })
      render()
    }

    const pointer = { x: 0, y: 0 }
    const look = { x: 0, y: 0 }
    function render() {
      scene.rotation.y = look.x * 0.06
      scene.rotation.x = look.y * 0.04
      renderer.render(scene, camera)
    }

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const ctx = gsap.context(() => {})

    /**
     * Lancer : la pièce surgit (échelle 0 → 1) un peu au-dessus de la table, puis chute avec rebonds
     * et tours complets qui retombent pile sur la pose de repos. Partir de plus haut la ferait entrer
     * par le bord du canvas, coupée net : 2,5 reste dans la marge de dessin (`bleed` ou CSS).
     */
    function toss(target: THREE.Object3D, delay: number, height = 2.5) {
      ctx.add(() => {
        gsap.fromTo(
          target.scale,
          { x: 0, y: 0, z: 0 },
          { x: 1, y: 1, z: 1, duration: 0.35, delay, ease: 'back.out(1.7)' },
        )
        gsap.fromTo(
          target.position,
          { y: height },
          {
            y: 0,
            duration: 0.8,
            delay,
            ease: 'bounce.out',
          },
        )
        gsap.fromTo(
          target.rotation,
          {
            x: Math.PI * 2 * gsap.utils.random([-2, -1, 1, 2]),
            z: Math.PI * 2 * gsap.utils.random([-1, 1]),
          },
          { x: 0, z: 0, duration: 0.75, delay, ease: 'power2.out' },
        )
      })
    }

    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(el)

    if (reduced) {
      el.style.opacity = '1'
      return () => {
        ro.disconnect()
        renderer.dispose()
        el.replaceChildren()
      }
    }

    holders.forEach((holder, i) => {
      holder.scale.setScalar(0) // invisible jusqu'au lancer
      toss(holder, 0.05 + i * 0.08)
    })
    gsap.to(el, { opacity: 1, duration: 0.3 })

    // Chaque pièce réagit au clic (raycast : le canvas laisse passer les clics vers la page)
    const raycaster = new THREE.Raycaster()
    const ndc = new THREE.Vector2()
    /** Index de la pièce sous le pointeur, ou -1. */
    function pieceAt(event: PointerEvent) {
      const r = renderer.domElement.getBoundingClientRect()
      ndc.set(
        ((event.clientX - r.left) / r.width) * 2 - 1,
        -((event.clientY - r.top) / r.height) * 2 + 1,
      )
      if (Math.abs(ndc.x) > 1 || Math.abs(ndc.y) > 1) return -1
      raycaster.setFromCamera(ndc, camera)
      let hit = -1
      let nearest = Number.POSITIVE_INFINITY
      pieces.forEach(({ object }, i) => {
        const distance = raycaster.intersectObject(object, true)[0]?.distance
        if (distance !== undefined && distance < nearest) {
          nearest = distance
          hit = i
        }
      })
      return hit
    }
    function onMove(event: PointerEvent) {
      pointer.x = (event.clientX / window.innerWidth) * 2 - 1
      pointer.y = (event.clientY / window.innerHeight) * 2 - 1
      if (el?.parentElement) el.parentElement.style.cursor = pieceAt(event) >= 0 ? 'pointer' : ''
    }

    const TURN = Math.PI * 2
    const flat = [0, Math.PI / 2, Math.PI, -Math.PI / 2]
    /** Geste propre à chaque pièce ; toutes retombent sur leur pose de repos (tours complets). */
    const gestures: ((object: THREE.Object3D, holder: THREE.Object3D) => void)[] = [
      // Carte : petit saut et retournement complet sur sa longueur
      (card, holder) => {
        gsap.fromTo(
          holder.position,
          { y: 0 },
          { y: 1.6, duration: 0.3, ease: 'power2.out', yoyo: true, repeat: 1 },
        )
        gsap.to(card.rotation, { z: card.rotation.z + TURN, duration: 0.6, ease: 'power2.inOut' })
      },
      // Dé : relancé, il retombe à plat sur une face au hasard (quarts de tour sur x et z)
      (die, holder) => {
        die.rotation.x %= TURN
        die.rotation.z %= TURN
        gsap.fromTo(holder.position, { y: 2.2 }, { y: 0, duration: 0.8, ease: 'bounce.out' })
        gsap.to(die.rotation, {
          x: gsap.utils.random(flat) + TURN * 2,
          z: gsap.utils.random(flat) + TURN,
          duration: 0.8,
          ease: 'power2.out',
        })
      },
      // Pion : soulevé comme pour avancer d'une case, il penche puis se redresse en touchant la table
      (pawn, holder) => {
        gsap
          .timeline()
          .to(holder.position, { y: 1.3, duration: 0.25, ease: 'power2.out' })
          .to(holder.position, { y: 0, duration: 0.5, ease: 'bounce.out' })
        gsap
          .timeline()
          .to(pawn.rotation, { z: -0.45, duration: 0.25, ease: 'power2.out' })
          .to(pawn.rotation, { z: 0, duration: 0.7, ease: 'elastic.out(1, 0.4)' })
      },
      // Jeton : pile ou face, deux tours en l'air
      (chip, holder) => {
        gsap
          .timeline()
          .to(holder.position, { y: 2.4, duration: 0.4, ease: 'power2.out' })
          .to(holder.position, { y: 0, duration: 0.55, ease: 'bounce.out' })
        gsap.to(chip.rotation, {
          x: chip.rotation.x + TURN * 2,
          duration: 0.8,
          ease: 'power1.inOut',
        })
      },
    ]
    function onClick(event: PointerEvent) {
      const i = pieceAt(event)
      const object = pieces[i]?.object
      const holder = holders[i]
      if (
        !object ||
        !holder ||
        gsap.isTweening(holder.position) ||
        gsap.isTweening(object.rotation)
      )
        return
      ctx.add(() => gestures[i]?.(object, holder))
    }
    window.addEventListener('pointermove', onMove, { passive: true })
    window.addEventListener('pointerdown', onClick)

    // Ne rend que si la scène est à l'écran
    let visible = true
    const io = new IntersectionObserver(([entry]) => {
      visible = entry?.isIntersecting ?? true
    })
    io.observe(el)
    function tick() {
      if (!visible) return
      look.x += (pointer.x - look.x) * 0.06
      look.y += (pointer.y - look.y) * 0.06
      render()
    }
    gsap.ticker.add(tick)

    return () => {
      gsap.ticker.remove(tick)
      ctx.revert()
      ro.disconnect()
      io.disconnect()
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerdown', onClick)
      renderer.dispose()
      el.replaceChildren()
    }
  }, [bleed])

  return <div ref={host} className={className} style={style} aria-hidden="true" />
}
