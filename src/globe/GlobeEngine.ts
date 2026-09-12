import * as THREE from 'three'
import { geoInterpolate } from 'd3-geo'
import { latLngToVec3, subsolarPoint } from '../lib/geo'
import { loadDots } from './loadDots'

/**
 * The porcelain globe from docs/DESIGN.md §4: a matte ball on paper that catches the page's
 * horizon light, graphite dot-matrix land with the real day/night terminator, ring markers for
 * cities, a pencil halo, an 8-second breath, quintic flights and screen-space picking.
 */

export interface GlobeMarker {
  id: string
  lat: number
  lng: number
  label: string
  kind: 'city' | 'user'
  /** disc filled (city has saved spots) */
  filled?: boolean
  /** "you, approx." */
  approx?: boolean
}

export interface GlobeTheme {
  ocean: string
  night: string
  land: string
  ink: string
  accent: string
  accentInk: string
  halo: string
}

export interface GlobeOptions {
  container: HTMLElement
  labelLayer: HTMLElement
  dotsUrl: string
  theme: GlobeTheme
  still?: boolean
  coarse?: boolean
  onSelect?: (id: string | null) => void
  onHover?: (id: string | null) => void
  onReady?: () => void
  onFocusMarker?: (id: string | null) => void
}

const MIN_ZOOM = 0.8
const MAX_ZOOM = 2.2
const SKY_ZOOM = 1
const PITCH_LIMIT = (70 * Math.PI) / 180
const BREATH_MS = 8000

const quintic = (t: number) => (t < 0.5 ? 16 * t ** 5 : 1 - Math.pow(-2 * t + 2, 5) / 2)
const settle = (t: number) => 1 - Math.pow(1 - t, 3)
const norm = (a: number) => Math.atan2(Math.sin(a), Math.cos(a))
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v))

const SPHERE_VERT = /* glsl */ `
varying vec3 vN; varying vec3 vLocal; varying vec3 vView;
void main() {
  vN = normalize(mat3(modelMatrix) * normal);
  vLocal = position;
  vec4 w = modelMatrix * vec4(position, 1.0);
  vView = normalize(cameraPosition - w.xyz);
  gl_Position = projectionMatrix * viewMatrix * w;
}`
const SPHERE_FRAG = /* glsl */ `
uniform vec3 uSun; uniform vec4 uHorizon; uniform vec3 uOcean; uniform vec3 uNight;
varying vec3 vN; varying vec3 vLocal; varying vec3 vView;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
void main() {
  float l = smoothstep(-0.55, 0.55, dot(normalize(vLocal), uSun));
  vec3 c = mix(uNight, uOcean, l);
  float nv = max(dot(normalize(vN), vView), 0.0);
  c *= 1.0 - 0.18 * pow(1.0 - nv, 2.5);
  float h = uHorizon.a * 0.35 * smoothstep(0.2, -0.9, vN.y);
  c = mix(c, uHorizon.rgb, h);
  c += (hash(gl_FragCoord.xy) - 0.5) * 0.025;
  gl_FragColor = vec4(c, 1.0);
  #include <colorspace_fragment>
}`
const DOT_VERT = /* glsl */ `
attribute float aPhase; attribute float aReveal;
uniform vec3 uSun; uniform float uTime; uniform float uStill; uniform float uReveal; uniform float uBase; uniform float uDPR; uniform vec3 uCamDir;
varying float vFacing; varying float vAlpha;
void main() {
  vec3 N = normalize(position);
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vFacing = dot(normalize(mat3(modelMatrix) * N), uCamDir);
  float breathe = uStill > 0.5 ? 0.0 : 0.06 * sin(uTime * 0.35 + aPhase * 6.283);
  gl_PointSize = min(8.0 * uDPR, uBase * uDPR * (1.0 + breathe) / max(0.3, -mv.z));
  vAlpha = smoothstep(aReveal - 0.08, aReveal, uReveal) * mix(0.32, 0.6, smoothstep(-0.55, 0.55, dot(N, uSun)));
  gl_Position = projectionMatrix * mv;
}`
const DOT_FRAG = /* glsl */ `
uniform vec3 uLand;
varying float vFacing; varying float vAlpha;
void main() {
  if (vFacing < 0.02) discard;
  float disc = smoothstep(0.5, 0.35, length(gl_PointCoord - 0.5));
  if (disc <= 0.01) discard;
  gl_FragColor = vec4(uLand, vAlpha * disc);
  #include <colorspace_fragment>
}`
const HALO_VERT = /* glsl */ `
varying vec3 vN; varying vec3 vView;
void main() {
  vN = normalize(mat3(modelMatrix) * normal);
  vec4 w = modelMatrix * vec4(position, 1.0);
  vView = normalize(cameraPosition - w.xyz);
  gl_Position = projectionMatrix * viewMatrix * w;
}`
const HALO_FRAG = /* glsl */ `
uniform vec3 uColor; uniform float uHalo;
varying vec3 vN; varying vec3 vView;
void main() {
  float d = clamp(-dot(normalize(vN), vView), 0.0, 1.0);
  gl_FragColor = vec4(uColor, uHalo * smoothstep(0.0, 0.34, d));
  #include <colorspace_fragment>
}`
const ROUTE_VERT = /* glsl */ `
attribute float aDist; varying float vDist;
void main() { vDist = aDist; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`
const ROUTE_FRAG = /* glsl */ `
uniform float uProgress; uniform float uAlpha; uniform vec3 uColor; varying float vDist;
void main() {
  float a = step(fract(vDist * 90.0), 0.5) * step(vDist, uProgress) * uAlpha;
  if (a <= 0.001) discard;
  gl_FragColor = vec4(uColor, a);
  #include <colorspace_fragment>
}`

interface Route { line: THREE.Line; mat: THREE.ShaderMaterial; t0: number }

export class GlobeEngine {
  private renderer: THREE.WebGLRenderer
  private scene = new THREE.Scene()
  private camera: THREE.PerspectiveCamera
  private globe = new THREE.Group()
  private sphereMat: THREE.ShaderMaterial
  private dotMat: THREE.ShaderMaterial
  private haloMat: THREE.ShaderMaterial
  private dots: THREE.Points | null = null
  private rings: THREE.InstancedMesh | null = null
  private discs: THREE.InstancedMesh | null = null
  private ripple: THREE.Mesh
  private rippleMat: THREE.MeshBasicMaterial
  private userRing: THREE.Mesh
  private userMat: THREE.MeshBasicMaterial
  private tick: THREE.Line
  private tickMat: THREE.LineBasicMaterial
  private routes: Route[] = []
  private markers: GlobeMarker[] = []
  private markerN: THREE.Vector3[] = []
  private heat: Float32Array = new Float32Array(0)
  private heatTarget: Float32Array = new Float32Array(0)
  private labelEls = new Map<string, HTMLButtonElement>()
  private yaw = 0.6
  private pitch = 0.21
  private zoom = SKY_ZOOM
  private fitDist = 3.4
  private velYaw = 0
  private velPitch = 0
  private anim: { t0: number; dur: number; from: [number, number, number]; to: [number, number, number]; ease: (t: number) => number; done?: (arrived: boolean) => void } | null = null
  private pointers = new Map<number, { x: number; y: number }>()
  private drag: { t: number; moved: number; lastX: number; lastY: number; lastT: number } | null = null
  private pinchDist = 0
  private lastInteraction = -1e9
  private raf = 0
  private t0 = performance.now()
  private lastFrame = performance.now()
  private lastRender = 0
  private lastSun = 0
  private selected: string | null = null
  private hovered: string | null = null
  private focused: number = -1
  private ro: ResizeObserver
  private io: IntersectionObserver | null = null
  private visible = true
  private paused = false
  private sunDate: Date | null = null
  private seat: [number, number] = [0.5, 0.5]
  private revealT0: number | null = null
  private prevCity: { lat: number; lng: number } | null = null
  private disposed = false
  private abort = new AbortController()
  private opts: GlobeOptions
  private lite: boolean
  private frameTimes: number[] = []
  autoRotate = true
  still: boolean
  coarse: boolean
  private tierIdle = true
  private horizonScratch = new THREE.Color()
  private inkColor = new THREE.Color()
  private accentColor = new THREE.Color()
  private listbox: HTMLDivElement | null = null

  constructor(opts: GlobeOptions) {
    this.opts = opts
    this.still = !!opts.still
    this.coarse = !!opts.coarse
    const nav = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } }
    const dpr = window.devicePixelRatio || 1
    this.lite = (nav.hardwareConcurrency ?? 8) <= 4 || (nav.deviceMemory ?? 8) <= 4 || (this.coarse && dpr > 2) || !!nav.connection?.saveData

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' })
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.renderer.toneMapping = THREE.NoToneMapping
    this.renderer.setPixelRatio(Math.min(dpr, this.lite ? 1.5 : 2))
    this.renderer.setClearColor(0x000000, 0)
    const el = this.renderer.domElement
    el.classList.add('paurk-globe-canvas')
    opts.container.appendChild(el)

    this.camera = new THREE.PerspectiveCamera(28, 1, 0.1, 100)
    this.scene.add(this.globe)
    const th = opts.theme
    const col = (c: string) => new THREE.Color(c)
    const hz = this.horizonScratch
    this.inkColor.set(th.ink)
    this.accentColor.set(th.accent)

    this.sphereMat = new THREE.ShaderMaterial({
      vertexShader: SPHERE_VERT,
      fragmentShader: SPHERE_FRAG,
      uniforms: { uSun: { value: new THREE.Vector3(0, 0, 1) }, uHorizon: { value: new THREE.Vector4(...hz.setRGB(0.86, 0.86, 0.84, THREE.SRGBColorSpace).toArray(), 0.2) }, uOcean: { value: col(th.ocean) }, uNight: { value: col(th.night) } },
    })
    this.globe.add(new THREE.Mesh(new THREE.SphereGeometry(1, this.lite ? 64 : 96, this.lite ? 64 : 96), this.sphereMat))

    this.dotMat = new THREE.ShaderMaterial({
      vertexShader: DOT_VERT,
      fragmentShader: DOT_FRAG,
      uniforms: {
        uSun: { value: new THREE.Vector3(0, 0, 1) }, uTime: { value: 0 }, uStill: { value: this.still ? 1 : 0 }, uReveal: { value: this.still ? 1 : 0 },
        uBase: { value: 2.4 * 3.2 }, uDPR: { value: this.renderer.getPixelRatio() }, uCamDir: { value: new THREE.Vector3(0, 0, 1) }, uLand: { value: col(th.land) },
      },
      transparent: true, depthTest: true, depthWrite: false,
    })

    this.haloMat = new THREE.ShaderMaterial({
      vertexShader: HALO_VERT, fragmentShader: HALO_FRAG,
      uniforms: { uColor: { value: col(th.halo) }, uHalo: { value: 0.1 } },
      side: THREE.BackSide, transparent: true, depthWrite: false,
    })
    this.scene.add(new THREE.Mesh(new THREE.SphereGeometry(1.06, 48, 48), this.haloMat))

    this.rippleMat = new THREE.MeshBasicMaterial({ color: col(th.accent), transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide })
    this.ripple = new THREE.Mesh(new THREE.RingGeometry(0.01, 0.012, 32), this.rippleMat)
    this.ripple.visible = false
    this.globe.add(this.ripple)

    this.userMat = new THREE.MeshBasicMaterial({ color: col(th.accentInk), transparent: true, opacity: 0.8, depthWrite: false, side: THREE.DoubleSide })
    this.userRing = new THREE.Mesh(new THREE.RingGeometry(0.012, 0.015, 32), this.userMat)
    this.userRing.visible = false
    this.globe.add(this.userRing)

    this.tickMat = new THREE.LineBasicMaterial({ color: col(th.ink), transparent: true, opacity: 0.6 })
    this.tick = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]), this.tickMat)
    this.tick.visible = false
    this.globe.add(this.tick)

    this.ro = new ResizeObserver(() => this.resize())
    this.ro.observe(opts.container)
    if ('IntersectionObserver' in window) {
      this.io = new IntersectionObserver((es) => { this.visible = es.some((e) => e.intersectionRatio > 0.05) }, { threshold: [0, 0.05, 0.2] })
      this.io.observe(opts.container)
    }
    this.resize()
    this.bindInput()
    this.updateSun()
    void this.loadDots(opts.dotsUrl)
    this.loop()
  }

  // ---------- data ----------
  private async loadDots(url: string) {
    try {
      const data = await loadDots(url)
      if (this.disposed) return
      const stride = this.lite ? 2 : 1
      const n = Math.floor(data.length / 2 / stride)
      const pos = new Float32Array(n * 3), phase = new Float32Array(n), reveal = new Float32Array(n)
      for (let i = 0; i < n; i++) {
        const j = i * stride
        const [x, y, z] = latLngToVec3(data[j * 2] / 100, data[j * 2 + 1] / 100, 1.003)
        pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z
        phase[i] = ((i * 2654435761) % 1000) / 1000
        reveal[i] = ((i * 40503) % 1000) / 1000
      }
      const geo = new THREE.BufferGeometry()
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
      geo.setAttribute('aPhase', new THREE.BufferAttribute(phase, 1))
      geo.setAttribute('aReveal', new THREE.BufferAttribute(reveal, 1))
      this.dots = new THREE.Points(geo, this.dotMat)
      this.dots.renderOrder = 1
      this.globe.add(this.dots)
      this.revealT0 = performance.now()
    } catch (e) {
      console.warn('globe dots failed to load', e)
    }
    this.opts.onReady?.()
  }

  setMarkers(markers: GlobeMarker[]) {
    const prevHeat = new Map(this.markers.map((m, i) => [m.id, this.heat[i] ?? 0]))
    this.markers = markers.filter((m) => m.kind === 'city')
    const user = markers.find((m) => m.kind === 'user')
    for (const el of this.labelEls.values()) el.remove()
    this.labelEls.clear()
    this.listbox?.remove()
    this.listbox = document.createElement('div')
    this.listbox.className = 'vh'
    this.listbox.setAttribute('role', 'listbox')
    this.listbox.setAttribute('aria-label', 'Cities on the globe')
    for (const m of markers.filter((x) => x.kind === 'city')) {
      const opt = document.createElement('span')
      opt.setAttribute('role', 'option')
      opt.id = `paurk-city-${m.id}`
      opt.setAttribute('aria-selected', 'false')
      opt.textContent = m.label
      this.listbox.appendChild(opt)
    }
    this.listbox.id = 'paurk-globe-cities'
    this.opts.container.appendChild(this.listbox)
    this.renderer.domElement.setAttribute('aria-owns', this.listbox.id)
    this.rings?.geometry.dispose(); this.discs?.geometry.dispose()
    ;(this.rings?.material as THREE.Material | undefined)?.dispose(); (this.discs?.material as THREE.Material | undefined)?.dispose()
    this.rings?.dispose(); this.discs?.dispose()
    if (this.rings) this.globe.remove(this.rings)
    if (this.discs) this.globe.remove(this.discs)
    this.rings = null; this.discs = null
    const n = this.markers.length
    this.markerN = this.markers.map((m) => new THREE.Vector3(...latLngToVec3(m.lat, m.lng, 1)))
    this.heat = new Float32Array(n)
    this.heatTarget = new Float32Array(n)
    if (n) {
      const ringMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.7, depthWrite: false, side: THREE.DoubleSide })
      const discMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide })
      this.rings = new THREE.InstancedMesh(new THREE.RingGeometry(0.01, 0.013, 24), ringMat, n)
      this.discs = new THREE.InstancedMesh(new THREE.CircleGeometry(0.0045, 16), discMat, n)
      this.rings.renderOrder = 3; this.discs.renderOrder = 3
      this.globe.add(this.rings, this.discs)
      for (let i = 0; i < n; i++) {
        this.heat[i] = prevHeat.get(this.markers[i].id) ?? 0
        const el = document.createElement('button')
        el.type = 'button'
        el.className = 'paurk-label'
        el.dataset.id = this.markers[i].id
        el.textContent = this.markers[i].label
        el.tabIndex = -1
        el.setAttribute('aria-hidden', 'true')
        el.addEventListener('click', (e) => { e.stopPropagation(); this.select(this.markers[i].id) })
        el.addEventListener('pointerenter', () => this.setHover(this.markers[i].id))
        el.addEventListener('pointerleave', () => this.setHover(null))
        this.opts.labelLayer.appendChild(el)
        this.labelEls.set(this.markers[i].id, el)
      }
      this.writeInstances(true)
    }
    if (user) {
      this.placeTangent(this.userRing, user.lat, user.lng, 1.008)
      this.userRing.visible = true
      const el = document.createElement('button')
      el.type = 'button'
      el.className = 'paurk-label paurk-label--user'
      el.dataset.id = user.id
      el.textContent = user.approx ? 'you, approx.' : 'you'
      el.tabIndex = -1
      el.setAttribute('aria-hidden', 'true')
      this.opts.labelLayer.appendChild(el)
      this.labelEls.set(user.id, el)
    } else this.userRing.visible = false
    this.userPos = user ? new THREE.Vector3(...latLngToVec3(user.lat, user.lng, 1)) : null
    if (this.focused >= 0 && this.focused < this.markers.length) this.listbox.querySelector(`#${CSS.escape(`paurk-city-${this.markers[this.focused].id}`)}`)?.setAttribute('aria-selected', 'true')
    else if (this.focused >= this.markers.length) this.setFocusIndex(-1)
    this.wake()
  }
  private userPos: THREE.Vector3 | null = null

  private dummy = new THREE.Object3D()
  private placeTangent(obj: THREE.Object3D, lat: number, lng: number, r: number, scale = 1) {
    const n = new THREE.Vector3(...latLngToVec3(lat, lng, 1))
    obj.position.copy(n).multiplyScalar(r)
    obj.lookAt(n.clone().multiplyScalar(2))
    obj.scale.setScalar(scale)
  }

  private writeInstances(force = false) {
    if (!this.rings || !this.discs) return
    const ink = this.inkColor, accent = this.accentColor
    let changed = force
    for (let i = 0; i < this.markers.length; i++) {
      const m = this.markers[i]
      const sel = m.id === this.selected
      this.heatTarget[i] = sel ? 1 : m.id === this.hovered || i === this.focused ? 1 : 0
      const before = this.heat[i]
      this.heat[i] += (this.heatTarget[i] - this.heat[i]) * 0.12
      if (Math.abs(this.heat[i] - this.heatTarget[i]) < 0.002) this.heat[i] = this.heatTarget[i]
      if (!force && Math.abs(before - this.heat[i]) < 1e-4) continue
      changed = true
      const s = sel ? 1.2 : 1 + 0.35 * this.heat[i]
      const n = this.markerN[i]
      this.dummy.position.copy(n).multiplyScalar(1.006)
      this.dummy.lookAt(n.clone().multiplyScalar(2))
      this.dummy.scale.setScalar(s)
      this.dummy.updateMatrix()
      this.rings.setMatrixAt(i, this.dummy.matrix)
      this.rings.setColorAt(i, sel ? accent : ink)
      const showDisc = sel || m.filled
      this.dummy.scale.setScalar(showDisc ? (sel ? 1.2 : 1) : 0.0001)
      this.dummy.updateMatrix()
      this.discs.setMatrixAt(i, this.dummy.matrix)
      this.discs.setColorAt(i, sel ? accent : ink)
      const el = this.labelEls.get(m.id)
      if (el) el.classList.toggle('is-active', sel || this.heat[i] > 0.5)
    }
    if (changed) {
      this.rings.instanceMatrix.needsUpdate = true
      this.discs.instanceMatrix.needsUpdate = true
      if (this.rings.instanceColor) this.rings.instanceColor.needsUpdate = true
      if (this.discs.instanceColor) this.discs.instanceColor.needsUpdate = true
    }
    return changed
  }

  setTheme(theme: GlobeTheme) {
    this.opts.theme = theme
    this.inkColor.set(theme.ink)
    this.accentColor.set(theme.accent)
    ;(this.sphereMat.uniforms.uOcean.value as THREE.Color).set(theme.ocean)
    ;(this.sphereMat.uniforms.uNight.value as THREE.Color).set(theme.night)
    ;(this.dotMat.uniforms.uLand.value as THREE.Color).set(theme.land)
    ;(this.haloMat.uniforms.uColor.value as THREE.Color).set(theme.halo)
    this.rippleMat.color.set(theme.accent)
    this.userMat.color.set(theme.accentInk)
    this.tickMat.color.set(theme.ink)
    for (const r of this.routes) (r.mat.uniforms.uColor.value as THREE.Color).set(theme.land)
    this.writeInstances(true)
    this.wake()
  }

  /** rgba 0..1 (sRGB, as on the page) mirrored from --horizon; decoded to the working colour space here. */
  setHorizon(r: number, g: number, b: number, a: number) {
    const c = this.horizonScratch.setRGB(r, g, b, THREE.SRGBColorSpace)
    ;(this.sphereMat.uniforms.uHorizon.value as THREE.Vector4).set(c.r, c.g, c.b, a)
    this.wake()
  }

  setStill(still: boolean) {
    this.still = still
    this.dotMat.uniforms.uStill.value = still ? 1 : 0
    if (still) this.dotMat.uniforms.uReveal.value = 1
    this.wake()
  }

  /** Where the sphere's centre sits in the container (fractions), via camera view offset. */
  setSeat(fx: number, fy: number) {
    if (fx === this.seat[0] && fy === this.seat[1]) return
    this.seat = [fx, fy]
    this.applySeat()
    this.wake()
  }
  private applySeat() {
    const { clientWidth: w, clientHeight: h } = this.opts.container
    if (!w || !h) return
    const [fx, fy] = this.seat
    if (Math.abs(fx - 0.5) < 1e-3 && Math.abs(fy - 0.5) < 1e-3) this.camera.clearViewOffset()
    else this.camera.setViewOffset(w, h, (0.5 - fx) * w, (0.5 - fy) * h, w, h)
  }

  setSunDate(date: Date | null) { this.sunDate = date; this.updateSun() }
  private updateSun() {
    const sp = subsolarPoint(this.sunDate ?? new Date())
    const [x, y, z] = latLngToVec3(sp.lat, sp.lng, 1)
    ;(this.sphereMat.uniforms.uSun.value as THREE.Vector3).set(x, y, z)
    ;(this.dotMat.uniforms.uSun.value as THREE.Vector3).set(x, y, z)
    this.wake()
  }

  /** Bearing tick from a city centre outward (Spot screen); null hides it. */
  setTick(from: { lat: number; lng: number } | null, bearing: number | null) {
    if (!from || bearing === null) { this.tick.visible = false; this.wake(); return }
    const a = new THREE.Vector3(...latLngToVec3(from.lat, from.lng, 1.008))
    const n = a.clone().normalize()
    const north = new THREE.Vector3(0, 1, 0).sub(n.clone().multiplyScalar(n.y)).normalize()
    const east = new THREE.Vector3().crossVectors(north, n).normalize()
    const dir = north.clone().multiplyScalar(Math.cos((bearing * Math.PI) / 180)).add(east.multiplyScalar(Math.sin((bearing * Math.PI) / 180)))
    const b = a.clone().add(dir.multiplyScalar(0.05))
    this.tick.geometry.setFromPoints([a, b])
    this.tick.visible = true
    this.wake()
  }

  // ---------- selection ----------
  select(id: string | null, emit = true) {
    if (id === this.selected) { if (emit) this.opts.onSelect?.(id); return }
    const prevSel = this.selected
    this.selected = id
    if (id) {
      const m = this.markers.find((x) => x.id === id)
      if (m) {
        const from = prevSel ? this.markers.find((x) => x.id === prevSel) : null
        const origin = from ?? (this.userPos ? this.userLatLng() : null) ?? this.prevCity
        if (origin && (origin.lat !== m.lat || origin.lng !== m.lng)) this.addRoute(origin, m)
        this.prevCity = { lat: m.lat, lng: m.lng }
        this.placeTangent(this.ripple, m.lat, m.lng, 1.007)
        this.ripple.visible = !this.still
        this.rippleT0 = performance.now() + 1800
      }
    } else this.ripple.visible = false
    this.writeInstances(true)
    this.wake()
    if (emit) this.opts.onSelect?.(id)
  }
  private rippleT0 = 0
  private userLatLng() {
    const u = this.userPos!
    const lat = (Math.asin(u.y) * 180) / Math.PI
    const lng = (Math.atan2(u.z, -u.x) * 180) / Math.PI - 180
    return { lat, lng: ((lng + 540) % 360) - 180 }
  }
  private setHover(id: string | null) {
    if (id === this.hovered) return
    this.hovered = id
    this.renderer.domElement.style.cursor = id ? 'pointer' : 'grab'
    this.wake()
    this.opts.onHover?.(id)
  }
  /** External heat (e.g. hovering a city word in a list). */
  setHot(id: string | null) { this.setHover(id) }

  // ---------- route ----------
  private addRoute(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
    const interp = geoInterpolate([a.lng, a.lat], [b.lng, b.lat])
    const N = 64
    const pos = new Float32Array((N + 1) * 3), dist = new Float32Array(N + 1)
    for (let i = 0; i <= N; i++) {
      const t = i / N
      const [lng, lat] = interp(t)
      const [x, y, z] = latLngToVec3(lat, lng, 1 + Math.sin(t * Math.PI) * 0.06 + 0.004)
      pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z
      dist[i] = t
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    geo.setAttribute('aDist', new THREE.BufferAttribute(dist, 1))
    const mat = new THREE.ShaderMaterial({ vertexShader: ROUTE_VERT, fragmentShader: ROUTE_FRAG, uniforms: { uProgress: { value: this.still ? 1 : 0 }, uAlpha: { value: 0.5 }, uColor: { value: new THREE.Color(this.opts.theme.land) } }, transparent: true, depthWrite: false })
    const line = new THREE.Line(geo, mat)
    line.renderOrder = 2
    this.globe.add(line)
    for (const r of this.routes) r.mat.uniforms.uAlpha.value = 0.2
    this.routes.push({ line, mat, t0: performance.now() })
    while (this.routes.length > 5) { const r = this.routes.shift()!; this.globe.remove(r.line); r.line.geometry.dispose(); r.mat.dispose() }
  }

  // ---------- camera ----------
  private static viewFor(lat: number, lng: number): [number, number] {
    const [x, y, z] = latLngToVec3(lat, lng, 1)
    return [-Math.atan2(x, z), clamp(Math.atan2(y, Math.hypot(x, z)), -PITCH_LIMIT, PITCH_LIMIT)]
  }

  /** Resolves true when the flight arrives, false when it is interrupted. */
  flyTo(lat: number, lng: number, zoom = 1.45, duration = 1800): Promise<boolean> {
    const [ty, tp] = GlobeEngine.viewFor(lat, lng)
    const dy = norm(ty - this.yaw)
    this.velYaw = 0; this.velPitch = 0
    this.lastInteraction = performance.now()
    if (this.still) duration = 0
    this.cancelAnim()
    this.wake()
    return new Promise((resolve) => {
      if (duration === 0) {
        this.yaw += dy; this.pitch = tp; this.zoom = clamp(zoom, MIN_ZOOM, MAX_ZOOM)
        this.opts.container.classList.add('is-crossfade')
        window.setTimeout(() => this.opts.container.classList.remove('is-crossfade'), 300)
        resolve(true); return
      }
      this.anim = { t0: performance.now(), dur: duration, from: [this.yaw, this.pitch, this.zoom], to: [this.yaw + dy, tp, clamp(zoom, MIN_ZOOM, MAX_ZOOM)], ease: quintic, done: resolve }
    })
  }

  /** Ends any flight in progress and settles its promise. */
  private cancelAnim() {
    const a = this.anim
    this.anim = null
    a?.done?.(false)
  }

  /** Set the orientation instantly (initial view). */
  lookAt(lat: number, lng: number, zoom = SKY_ZOOM) {
    const [ty, tp] = GlobeEngine.viewFor(lat, lng)
    this.yaw = ty; this.pitch = tp; this.zoom = zoom
    this.wake()
  }

  /** Return to the sky: keep the current longitude, ease the zoom back. */
  release(duration = 1400): Promise<boolean> {
    this.cancelAnim()
    this.wake()
    return new Promise((resolve) => {
      if (this.still || duration === 0) { this.zoom = SKY_ZOOM; resolve(true); return }
      this.anim = { t0: performance.now(), dur: duration, from: [this.yaw, this.pitch, this.zoom], to: [this.yaw, clamp(this.pitch, -0.6, 0.6), SKY_ZOOM], ease: quintic, done: resolve }
    })
  }

  zoomBy(factor: number) {
    this.zoom = clamp(this.zoom * factor, MIN_ZOOM, MAX_ZOOM)
    this.lastInteraction = performance.now()
    this.wake()
  }
  /** Sheet progress on mobile eases the city away (2.2 → 2.6 in the spec's units). */
  setPushBack(p: number) {
    if (this.anim) return
    this.pushBack = clamp(p, 0, 1)
    this.wake()
  }
  private pushBack = 0

  // ---------- input ----------
  private bindInput() {
    const el = this.renderer.domElement
    const sig = this.abort.signal
    el.style.touchAction = 'none'
    el.style.cursor = 'grab'
    el.tabIndex = 0
    el.setAttribute('role', 'application')
    el.setAttribute('aria-roledescription', 'globe')
    el.setAttribute('aria-label', 'World globe. Drag or use arrow keys to turn it, plus and minus to zoom, page down and page up to move between cities, Enter to open a city, Escape to return to the sky.')
    el.addEventListener('pointerdown', (e) => {
      el.setPointerCapture(e.pointerId)
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
      this.lastInteraction = performance.now()
      this.cancelAnim()
      this.wake()
      if (this.pointers.size === 1) {
        this.drag = { t: performance.now(), moved: 0, lastX: e.clientX, lastY: e.clientY, lastT: performance.now() }
        this.velYaw = 0; this.velPitch = 0
        el.style.cursor = 'grabbing'
      } else if (this.pointers.size === 2) {
        const [a, b] = [...this.pointers.values()]
        this.pinchDist = Math.hypot(a.x - b.x, a.y - b.y)
        this.drag = null
      }
    }, { signal: sig })
    el.addEventListener('pointermove', (e) => {
      if (this.pointers.has(e.pointerId)) this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
      if (this.pointers.size === 2) {
        const [a, b] = [...this.pointers.values()]
        const d = Math.hypot(a.x - b.x, a.y - b.y)
        if (this.pinchDist > 0) this.zoomBy(d / Math.max(1, this.pinchDist))
        this.pinchDist = d
        return
      }
      if (this.drag && this.pointers.size === 1) {
        const now = performance.now()
        const dx = e.clientX - this.drag.lastX, dy = e.clientY - this.drag.lastY
        const k = 0.0045 / this.zoom
        this.yaw += dx * k
        this.pitch = clamp(this.pitch + dy * k, -PITCH_LIMIT, PITCH_LIMIT)
        const dt = Math.max(8, now - this.drag.lastT)
        this.velYaw = this.still ? 0 : ((dx * k) / dt) * 16
        this.velPitch = this.still ? 0 : ((dy * k) / dt) * 16
        this.drag.moved += Math.abs(dx) + Math.abs(dy)
        this.drag.lastX = e.clientX; this.drag.lastY = e.clientY; this.drag.lastT = now
        this.lastInteraction = now
        this.wake()
      } else if (this.pointers.size === 0 && e.pointerType === 'mouse') {
        this.setHover(this.pick(e.clientX, e.clientY))
      }
    }, { signal: sig })
    const up = (e: PointerEvent) => {
      this.pointers.delete(e.pointerId)
      if (this.drag && this.pointers.size === 0) {
        const quick = performance.now() - this.drag.t < 500 && this.drag.moved < 8
        if (quick) {
          const id = this.pick(e.clientX, e.clientY)
          if (id) this.select(id)
        }
        this.drag = null
      }
      if (this.pointers.size < 2) this.pinchDist = 0
      el.style.cursor = 'grab'
      this.wake()
    }
    el.addEventListener('pointerup', up, { signal: sig })
    el.addEventListener('pointercancel', up, { signal: sig })
    el.addEventListener('pointerleave', () => { if (!this.drag) this.setHover(null) }, { signal: sig })
    el.addEventListener('wheel', (e) => {
      e.preventDefault()
      this.zoomBy(Math.exp(-Math.sign(e.deltaY) * Math.min(0.2, Math.abs(e.deltaY) * 0.0012)))
    }, { passive: false, signal: sig })
    el.addEventListener('keydown', (e) => {
      const step = (6 * Math.PI) / 180
      switch (e.key) {
        case 'ArrowLeft': this.yaw -= step; break
        case 'ArrowRight': this.yaw += step; break
        case 'ArrowUp': this.pitch = clamp(this.pitch - step, -PITCH_LIMIT, PITCH_LIMIT); break
        case 'ArrowDown': this.pitch = clamp(this.pitch + step, -PITCH_LIMIT, PITCH_LIMIT); break
        case '+': case '=': this.zoomBy(1.18); break
        case '-': case '_': this.zoomBy(0.85); break
        case 'PageDown': case ']': this.cycleFocus(1); break
        case 'PageUp': case '[': this.cycleFocus(-1); break
        case 'Enter': case ' ': if (this.focused >= 0) this.select(this.markers[this.focused].id); break
        case 'Escape': this.setFocusIndex(-1); this.select(null); break
        default: return
      }
      e.preventDefault()
      this.lastInteraction = performance.now()
      this.writeInstances(true)
      this.wake()
    }, { signal: sig })
    el.addEventListener('blur', () => { this.setFocusIndex(-1); this.writeInstances(true); this.wake() }, { signal: sig })
    document.addEventListener('visibilitychange', () => this.wake(), { signal: sig })
  }

  private cycleFocus(dir: number) {
    if (!this.markers.length) return
    const order = this.markers.map((m, i) => ({ i, lng: m.lng })).sort((a, b) => a.lng - b.lng).map((o) => o.i)
    const pos = this.focused < 0 ? (dir > 0 ? -1 : order.length) : order.indexOf(this.focused)
    const next = order[(pos + dir + order.length) % order.length]
    this.setFocusIndex(next)
    const m = this.markers[next]
    const [ty, tp] = GlobeEngine.viewFor(m.lat, m.lng)
    this.cancelAnim()
    this.anim = { t0: performance.now(), dur: this.still ? 0 : 500, from: [this.yaw, this.pitch, this.zoom], to: [this.yaw + norm(ty - this.yaw), tp, this.zoom], ease: settle }
  }

  /** Roving focus for keyboard users: a hidden listbox mirrors the markers; the canvas points at the active option. */
  private setFocusIndex(i: number) {
    this.focused = i
    const el = this.renderer.domElement
    if (this.listbox) for (const opt of this.listbox.children) opt.setAttribute('aria-selected', 'false')
    if (i >= 0) {
      const id = `paurk-city-${this.markers[i].id}`
      el.setAttribute('aria-activedescendant', id)
      this.listbox?.querySelector(`#${CSS.escape(id)}`)?.setAttribute('aria-selected', 'true')
      this.opts.onFocusMarker?.(this.markers[i].id)
    } else {
      el.removeAttribute('aria-activedescendant')
      this.opts.onFocusMarker?.(null)
    }
  }

  private tmp = new THREE.Vector3()
  private tmp2 = new THREE.Vector3()
  private tmp3 = new THREE.Vector3()
  private project(n: THREE.Vector3): { x: number; y: number; facing: number } {
    const v = this.tmp.copy(n).applyMatrix4(this.globe.matrixWorld)
    // Visible iff the surface normal faces the camera from this point (the perspective limb, not the axis).
    const toCam = this.tmp2.copy(this.camera.position).sub(v).normalize()
    const facing = this.tmp3.copy(v).normalize().dot(toCam)
    v.project(this.camera)
    const w = this.opts.container.clientWidth, h = this.opts.container.clientHeight
    return { x: (v.x * 0.5 + 0.5) * w, y: (-v.y * 0.5 + 0.5) * h, facing }
  }

  private pick(clientX: number, clientY: number): string | null {
    if (!this.markers.length) return null
    const rect = this.renderer.domElement.getBoundingClientRect()
    const px = clientX - rect.left, py = clientY - rect.top
    const r = this.coarse ? 44 : 28
    let best: string | null = null, bestD = r * r
    for (let i = 0; i < this.markers.length; i++) {
      const p = this.project(this.markerN[i])
      if (p.facing < 0.03) continue
      const d = (p.x - px) ** 2 + (p.y - py) ** 2
      if (d < bestD) { bestD = d; best = this.markers[i].id }
    }
    return best
  }

  private updateLabels() {
    const w = this.opts.container.clientWidth, h = this.opts.container.clientHeight
    const cx = w * this.seat[0], cy = h * this.seat[1]
    const shown = new Set<string>()
    if (this.coarse && !this.selected && !this.hovered && this.focused < 0) {
      const cands: { id: string; x: number; y: number; d: number }[] = []
      for (let i = 0; i < this.markers.length; i++) {
        const p = this.project(this.markerN[i])
        if (p.facing < 0.12) continue
        cands.push({ id: this.markers[i].id, x: p.x, y: p.y, d: (p.x - cx) ** 2 + (p.y - cy) ** 2 })
      }
      cands.sort((a, b) => a.d - b.d)
      const placed: { x: number; y: number }[] = []
      for (const c of cands) {
        if (shown.size >= 6) break
        if (placed.some((q) => Math.abs(q.x - c.x) < 96 && Math.abs(q.y - c.y) < 24)) continue
        placed.push(c); shown.add(c.id)
      }
    } else {
      if (this.selected) shown.add(this.selected)
      if (this.hovered) shown.add(this.hovered)
      if (this.focused >= 0) shown.add(this.markers[this.focused].id)
    }
    for (let i = 0; i < this.markers.length; i++) {
      const m = this.markers[i]
      const el = this.labelEls.get(m.id)
      if (!el) continue
      const p = this.project(this.markerN[i])
      const on = shown.has(m.id) && p.facing > 0.03 && p.x > 24 && p.x < w - 110
      const fade = on ? clamp((p.facing - 0.05) / 0.3, 0, 1) : 0
      el.style.opacity = String(fade)
      el.style.pointerEvents = fade > 0.3 ? 'auto' : 'none'
      el.style.transform = `translate3d(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px, 0)`
      el.classList.toggle('is-focus', i === this.focused)
    }
    if (this.userPos) {
      const el = this.labelEls.get('user')
      if (el) {
        const p = this.project(this.userPos)
        const fade = clamp((p.facing - 0.05) / 0.3, 0, 1)
        el.style.opacity = String(fade)
        el.style.transform = `translate3d(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px, 0)`
      }
    }
  }

  // ---------- loop ----------
  private resize() {
    const { clientWidth: w, clientHeight: h } = this.opts.container
    if (!w || !h) return
    this.renderer.setSize(w, h, false)
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
    const vHalf = THREE.MathUtils.degToRad(this.camera.fov / 2)
    const hHalf = Math.atan(Math.tan(vHalf) * this.camera.aspect)
    this.fitDist = 1.12 / Math.sin(Math.min(vHalf, hHalf))
    this.applySeat()
    this.dotMat.uniforms.uDPR.value = this.renderer.getPixelRatio()
    this.wake()
  }

  private awake = 0
  /** Ask for full-rate rendering for a moment. */
  wake() { this.awake = performance.now() + 250 }
  setPaused(p: boolean) { this.paused = p; if (!p) this.wake() }

  private loop = () => {
    if (this.disposed) return
    this.raf = requestAnimationFrame(this.loop)
    if (document.hidden || this.paused || !this.visible) return
    const now = performance.now()
    const animating = !!this.anim || !!this.drag || Math.abs(this.velYaw) > 1e-5 || Math.abs(this.velPitch) > 1e-5 || now < this.awake || (this.revealT0 !== null && now - this.revealT0 < 1600)
    const idleMotion = !this.still && this.tierIdle && (this.autoRotate || this.ripple.visible || this.userRing.visible)
    if (!animating && !idleMotion && now - this.lastRender < 1000) return
    if (!animating && idleMotion && now - this.lastRender < 33) return
    const dt = Math.min(0.05, (now - this.lastFrame) / 1000)
    this.lastFrame = now
    this.lastRender = now
    const t = (now - this.t0) / 1000
    const breath = this.still || !this.tierIdle ? 0 : 0.5 - 0.5 * Math.cos((now * 2 * Math.PI) / BREATH_MS)
    this.dotMat.uniforms.uTime.value = t
    this.haloMat.uniforms.uHalo.value = 0.1 - 0.03 * breath
    if (this.revealT0 !== null && !this.still) this.dotMat.uniforms.uReveal.value = clamp((now - this.revealT0) / 1400, 0, 1)
    if (now - this.lastSun > 60000) { this.lastSun = now; this.updateSun() }

    if (this.anim) {
      const k = Math.min(1, (now - this.anim.t0) / this.anim.dur)
      const e = this.anim.ease(k)
      const { from, to } = this.anim
      this.yaw = from[0] + (to[0] - from[0]) * e
      this.pitch = from[1] + (to[1] - from[1]) * e
      this.zoom = from[2] + (to[2] - from[2]) * e
      if (k >= 1) { const done = this.anim.done; this.anim = null; done?.(true) }
    } else if (!this.drag) {
      this.yaw += this.velYaw
      this.pitch = clamp(this.pitch + this.velPitch, -PITCH_LIMIT, PITCH_LIMIT)
      this.velYaw *= 0.94; this.velPitch *= 0.9
      if (Math.abs(this.velYaw) < 1e-5) this.velYaw = 0
      if (Math.abs(this.velPitch) < 1e-5) this.velPitch = 0
      const since = now - this.lastInteraction
      if (this.autoRotate && this.tierIdle && !this.still && !this.selected && since > 8000 && this.pointers.size === 0) {
        const ease = clamp((since - 8000) / 3000, 0, 1)
        this.yaw += 0.02 * dt * ease
      }
    }
    const scale = 1 + 0.012 * breath
    this.globe.rotation.set(this.pitch, this.yaw, 0)
    this.globe.scale.setScalar(scale)
    this.globe.updateMatrixWorld()
    const dist = (this.fitDist / this.zoom) * (1 + 0.18 * this.pushBack)
    this.camera.position.set(0, 0, dist)
    this.camera.lookAt(0, 0, 0)
    this.camera.updateMatrixWorld()
    ;(this.dotMat.uniforms.uCamDir.value as THREE.Vector3).set(0, 0, 1)

    if (this.ripple.visible) {
      const rt = ((now - this.rippleT0) % 6000) / 6000
      const k = now < this.rippleT0 ? 0 : clamp(rt / (4 / 6), 0, 1)
      this.ripple.scale.setScalar(1 + 2 * k)
      this.rippleMat.opacity = now < this.rippleT0 ? 0 : 0.5 * (1 - k)
    }
    if (this.userRing.visible) this.userMat.opacity = 0.75 + 0.25 * Math.sin((now / 3000) * 2 * Math.PI)
    for (const r of this.routes) if (r.mat.uniforms.uProgress.value < 1) r.mat.uniforms.uProgress.value = clamp((now - r.t0) / 900, 0, 1)
    if (this.writeInstances()) this.wake()

    const start = performance.now()
    this.renderer.render(this.scene, this.camera)
    this.updateLabels()
    if (this.frameTimes.length < 90) {
      this.frameTimes.push(performance.now() - start)
      if (this.frameTimes.length === 90) {
        const mean = this.frameTimes.reduce((a, b) => a + b, 0) / 90
        if (mean > 40 && this.lite) { this.tierIdle = false }
        else if (mean > 24 && !this.lite) { this.lite = true; this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5)); this.resize() }
      }
    }
  }

  dispose() {
    this.disposed = true
    cancelAnimationFrame(this.raf)
    this.abort.abort()
    this.ro.disconnect()
    this.io?.disconnect()
    this.listbox?.remove()
    for (const el of this.labelEls.values()) el.remove()
    this.labelEls.clear()
    this.renderer.dispose()
    this.renderer.domElement.remove()
  }
}
