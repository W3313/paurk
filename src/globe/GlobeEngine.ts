import * as THREE from 'three'
import { latLngToVec3, subsolarPoint } from '../lib/geo'

export interface GlobeMarker {
  id: string
  lat: number
  lng: number
  label: string
  kind: 'city' | 'spot' | 'user'
  /** Relative visual weight, e.g. number of spots. */
  weight?: number
}

export interface GlobeTheme {
  oceanDay: string
  oceanNight: string
  rim: string
  dotDay: string
  dotNight: string
  atmosphere: string
  marker: string
  markerActive: string
  user: string
}

export interface GlobeOptions {
  container: HTMLElement
  labelLayer: HTMLElement
  dotsUrl: string
  theme: GlobeTheme
  reducedMotion?: boolean
  onSelect?: (id: string | null) => void
  onHover?: (id: string | null) => void
  onReady?: () => void
}

/** Zoom is relative to the distance at which the globe fits the viewport (1 = fits, >1 = closer). */
const MIN_ZOOM = 0.72
const MAX_ZOOM = 2.4
const DEFAULT_ZOOM = 1
const PITCH_LIMIT = Math.PI / 2 - 0.12

const DOT_VERT = /* glsl */ `
attribute float aSeed;
uniform float uSize; uniform float uPixelRatio; uniform vec3 uSun; uniform float uTime;
varying float vLit; varying float vSeed;
void main() {
  vec3 n = normalize(position);
  vLit = dot(n, uSun);
  vSeed = aSeed;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = uSize * uPixelRatio / max(0.3, -mv.z);
}`
const DOT_FRAG = /* glsl */ `
uniform vec3 uDay; uniform vec3 uNight; uniform float uTime; uniform float uTwinkle;
varying float vLit; varying float vSeed;
void main() {
  vec2 c = gl_PointCoord - 0.5; float d = length(c);
  float a = 1.0 - smoothstep(0.32, 0.5, d);
  if (a <= 0.01) discard;
  float day = smoothstep(-0.12, 0.18, vLit);
  float tw = 1.0 - uTwinkle * 0.35 * (0.5 + 0.5 * sin(uTime * (0.6 + vSeed * 1.4) + vSeed * 6.2832));
  vec3 col = mix(uNight * tw, uDay, day);
  gl_FragColor = vec4(col, a * mix(0.95, 1.0, day));
}`
const OCEAN_VERT = /* glsl */ `
varying vec3 vN; varying vec3 vLocal;
void main() {
  vN = normalize(normalMatrix * normal);
  vLocal = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`
const OCEAN_FRAG = /* glsl */ `
uniform vec3 uOceanDay; uniform vec3 uOceanNight; uniform vec3 uRim; uniform vec3 uSun;
varying vec3 vN; varying vec3 vLocal;
void main() {
  float lit = dot(normalize(vLocal), uSun);
  float day = smoothstep(-0.25, 0.35, lit);
  vec3 col = mix(uOceanNight, uOceanDay, day);
  float fres = pow(1.0 - clamp(dot(vN, vec3(0.0, 0.0, 1.0)), 0.0, 1.0), 3.0);
  col = mix(col, uRim, fres * 0.55);
  gl_FragColor = vec4(col, 1.0);
}`
const ATMO_VERT = /* glsl */ `
varying vec3 vN;
void main() { vN = normalize(normalMatrix * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`
const ATMO_FRAG = /* glsl */ `
uniform vec3 uColor; uniform float uStrength;
varying vec3 vN;
void main() {
  float d = clamp(-dot(vN, vec3(0.0, 0.0, 1.0)), 0.0, 1.0);
  float i = pow(d, 0.55) * pow(1.0 - d, 0.0) * uStrength;
  i = smoothstep(0.0, 1.0, i) * 0.62;
  gl_FragColor = vec4(uColor, i);
}`
const MARK_VERT = /* glsl */ `
attribute vec3 aColor; attribute float aSize; attribute float aState;
uniform float uPixelRatio; uniform float uTime;
varying vec3 vColor; varying float vState; varying float vFacing;
void main() {
  vColor = aColor; vState = aState;
  vec3 nv = normalize(normalMatrix * position);
  vFacing = nv.z;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  float pulse = aState > 1.5 ? 1.0 + 0.18 * sin(uTime * 3.0) : (aState > 0.5 ? 1.25 : 1.0);
  gl_PointSize = aSize * pulse * uPixelRatio / max(0.3, -mv.z) * 2.6;
}`
const MARK_FRAG = /* glsl */ `
varying vec3 vColor; varying float vState; varying float vFacing;
void main() {
  if (vFacing < 0.08) discard;
  vec2 c = gl_PointCoord - 0.5; float d = length(c) * 2.0;
  float core = 1.0 - smoothstep(0.28, 0.42, d);
  float ring = smoothstep(0.62, 0.7, d) * (1.0 - smoothstep(0.86, 1.0, d));
  float ringA = vState > 0.5 ? 0.9 : 0.45;
  float a = max(core, ring * ringA);
  if (a <= 0.01) discard;
  gl_FragColor = vec4(vColor, a * smoothstep(0.08, 0.3, vFacing));
}`

const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)

export class GlobeEngine {
  private renderer: THREE.WebGLRenderer
  private scene = new THREE.Scene()
  private camera: THREE.PerspectiveCamera
  private globe = new THREE.Group()
  private dots: THREE.Points | null = null
  private dotMat: THREE.ShaderMaterial
  private oceanMat: THREE.ShaderMaterial
  private atmoMat: THREE.ShaderMaterial
  private markerMat: THREE.ShaderMaterial
  private markerPoints: THREE.Points | null = null
  private markers: GlobeMarker[] = []
  private markerWorld: THREE.Vector3[] = []
  private labelEls = new Map<string, HTMLButtonElement>()
  private yaw = 0
  private pitch = 0.35
  private zoom = DEFAULT_ZOOM
  private fitDist = 3.4
  private dist = 3.4
  private velYaw = 0
  private velPitch = 0
  private anim: { t0: number; dur: number; from: [number, number, number]; to: [number, number, number]; done?: () => void } | null = null
  private pointers = new Map<number, { x: number; y: number }>()
  private drag: { x: number; y: number; t: number; moved: number; lastX: number; lastY: number; lastT: number } | null = null
  private pinchDist = 0
  private lastInteraction = 0
  private raf = 0
  private t0 = performance.now()
  private lastFrame = performance.now()
  private selected: string | null = null
  private hovered: string | null = null
  private ro: ResizeObserver
  private sunDate: Date | null = null
  private disposed = false
  autoRotate = true
  reducedMotion: boolean
  private opts: GlobeOptions
  private abort = new AbortController()

  constructor(opts: GlobeOptions) {
    this.opts = opts
    this.reducedMotion = !!opts.reducedMotion
    const { container } = opts
    const isSmall = Math.min(window.innerWidth, window.innerHeight) < 700
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isSmall ? 1.75 : 2))
    this.renderer.setClearColor(0x000000, 0)
    this.renderer.domElement.classList.add('tc-globe-canvas')
    this.renderer.domElement.setAttribute('aria-hidden', 'true')
    container.appendChild(this.renderer.domElement)

    this.camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100)
    this.camera.position.set(0, 0, this.fitDist)
    this.scene.add(this.globe)

    const th = opts.theme
    const col = (c: string) => new THREE.Color(c)
    this.oceanMat = new THREE.ShaderMaterial({
      vertexShader: OCEAN_VERT,
      fragmentShader: OCEAN_FRAG,
      uniforms: { uOceanDay: { value: col(th.oceanDay) }, uOceanNight: { value: col(th.oceanNight) }, uRim: { value: col(th.rim) }, uSun: { value: new THREE.Vector3(0, 0, 1) } },
    })
    const ocean = new THREE.Mesh(new THREE.SphereGeometry(0.993, 72, 72), this.oceanMat)
    this.globe.add(ocean)

    this.atmoMat = new THREE.ShaderMaterial({
      vertexShader: ATMO_VERT,
      fragmentShader: ATMO_FRAG,
      uniforms: { uColor: { value: col(th.atmosphere) }, uStrength: { value: 1.0 } },
      side: THREE.BackSide,
      transparent: true,
      depthWrite: false,
    })
    const atmo = new THREE.Mesh(new THREE.SphereGeometry(1, 64, 64), this.atmoMat)
    atmo.scale.setScalar(1.07)
    this.scene.add(atmo)

    this.dotMat = new THREE.ShaderMaterial({
      vertexShader: DOT_VERT,
      fragmentShader: DOT_FRAG,
      uniforms: {
        uSize: { value: 7.5 },
        uPixelRatio: { value: this.renderer.getPixelRatio() },
        uSun: { value: new THREE.Vector3(0, 0, 1) },
        uTime: { value: 0 },
        uDay: { value: col(th.dotDay) },
        uNight: { value: col(th.dotNight) },
        uTwinkle: { value: this.reducedMotion ? 0 : 1 },
      },
      transparent: true,
      depthWrite: false,
    })

    this.markerMat = new THREE.ShaderMaterial({
      vertexShader: MARK_VERT,
      fragmentShader: MARK_FRAG,
      uniforms: { uPixelRatio: { value: this.renderer.getPixelRatio() }, uTime: { value: 0 } },
      transparent: true,
      depthWrite: false,
      depthTest: false,
    })

    this.ro = new ResizeObserver(() => this.resize())
    this.ro.observe(container)
    this.resize()
    this.bindInput()
    this.updateSun()
    void this.loadDots(opts.dotsUrl)
    this.loop()
  }

  // ---------- data ----------
  private async loadDots(url: string) {
    try {
      const res = await fetch(url)
      const buf = await res.arrayBuffer()
      if (this.disposed) return
      const data = new Int16Array(buf)
      const n = data.length / 2
      const pos = new Float32Array(n * 3)
      const seed = new Float32Array(n)
      for (let i = 0; i < n; i++) {
        const [x, y, z] = latLngToVec3(data[i * 2] / 100, data[i * 2 + 1] / 100, 1.0)
        pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z
        seed[i] = ((i * 2654435761) % 1000) / 1000
      }
      const geo = new THREE.BufferGeometry()
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
      geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1))
      this.dots = new THREE.Points(geo, this.dotMat)
      this.globe.add(this.dots)
      this.opts.onReady?.()
    } catch (e) {
      console.warn('globe dots failed to load', e)
      this.opts.onReady?.()
    }
  }

  setMarkers(markers: GlobeMarker[]) {
    this.markers = markers
    if (this.markerPoints) {
      this.globe.remove(this.markerPoints)
      this.markerPoints.geometry.dispose()
      this.markerPoints = null
    }
    for (const el of this.labelEls.values()) el.remove()
    this.labelEls.clear()
    this.markerWorld = []
    if (!markers.length) return
    const n = markers.length
    const pos = new Float32Array(n * 3)
    const color = new Float32Array(n * 3)
    const size = new Float32Array(n)
    const state = new Float32Array(n)
    const th = this.opts.theme
    for (let i = 0; i < n; i++) {
      const m = markers[i]
      const [x, y, z] = latLngToVec3(m.lat, m.lng, 1.012)
      pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z
      const c = new THREE.Color(m.kind === 'user' ? th.user : th.marker)
      color[i * 3] = c.r; color[i * 3 + 1] = c.g; color[i * 3 + 2] = c.b
      size[i] = m.kind === 'user' ? 7 : m.kind === 'city' ? 5 + Math.min(4, (m.weight ?? 1) * 0.22) : 4
      state[i] = 0
      this.markerWorld.push(new THREE.Vector3(x, y, z))
      const el = document.createElement('button')
      el.type = 'button'
      el.className = `tc-label tc-label--${m.kind}`
      el.dataset.id = m.id
      el.textContent = m.label
      el.tabIndex = -1
      el.setAttribute('aria-hidden', 'true')
      el.addEventListener('click', (e) => { e.stopPropagation(); this.select(m.id, true) })
      el.addEventListener('pointerenter', () => this.setHover(m.id))
      el.addEventListener('pointerleave', () => this.setHover(null))
      this.opts.labelLayer.appendChild(el)
      this.labelEls.set(m.id, el)
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    geo.setAttribute('aColor', new THREE.BufferAttribute(color, 3))
    geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1))
    geo.setAttribute('aState', new THREE.BufferAttribute(state, 1))
    this.markerPoints = new THREE.Points(geo, this.markerMat)
    this.markerPoints.renderOrder = 2
    this.globe.add(this.markerPoints)
    this.applyStates()
  }

  private applyStates() {
    if (!this.markerPoints) return
    const attr = this.markerPoints.geometry.getAttribute('aState') as THREE.BufferAttribute
    const colAttr = this.markerPoints.geometry.getAttribute('aColor') as THREE.BufferAttribute
    const th = this.opts.theme
    const base = new THREE.Color(th.marker), active = new THREE.Color(th.markerActive), user = new THREE.Color(th.user)
    for (let i = 0; i < this.markers.length; i++) {
      const m = this.markers[i]
      const s = m.id === this.selected ? 2 : m.id === this.hovered ? 1 : 0
      attr.setX(i, s)
      const c = m.kind === 'user' ? user : s > 0 ? active : base
      colAttr.setXYZ(i, c.r, c.g, c.b)
      const el = this.labelEls.get(m.id)
      if (el) el.classList.toggle('is-active', s > 0)
    }
    attr.needsUpdate = true
    colAttr.needsUpdate = true
  }

  setTheme(theme: GlobeTheme) {
    this.opts.theme = theme
    const u = this.oceanMat.uniforms
    ;(u.uOceanDay.value as THREE.Color).set(theme.oceanDay)
    ;(u.uOceanNight.value as THREE.Color).set(theme.oceanNight)
    ;(u.uRim.value as THREE.Color).set(theme.rim)
    ;(this.atmoMat.uniforms.uColor.value as THREE.Color).set(theme.atmosphere)
    ;(this.dotMat.uniforms.uDay.value as THREE.Color).set(theme.dotDay)
    ;(this.dotMat.uniforms.uNight.value as THREE.Color).set(theme.dotNight)
    this.applyStates()
  }

  /** Override the sun position (null = live clock). */
  setSunDate(date: Date | null) {
    this.sunDate = date
    this.updateSun()
  }

  private updateSun() {
    const sp = subsolarPoint(this.sunDate ?? new Date())
    const [x, y, z] = latLngToVec3(sp.lat, sp.lng, 1)
    ;(this.dotMat.uniforms.uSun.value as THREE.Vector3).set(x, y, z)
    ;(this.oceanMat.uniforms.uSun.value as THREE.Vector3).set(x, y, z)
  }

  // ---------- selection ----------
  select(id: string | null, emit = true) {
    this.selected = id
    this.applyStates()
    if (emit) this.opts.onSelect?.(id)
  }
  private setHover(id: string | null) {
    if (id === this.hovered) return
    this.hovered = id
    this.applyStates()
    this.renderer.domElement.style.cursor = id ? 'pointer' : 'grab'
    this.opts.onHover?.(id)
  }

  // ---------- camera ----------
  private static viewFor(lat: number, lng: number): [number, number] {
    const [x, y, z] = latLngToVec3(lat, lng, 1)
    const yaw = -Math.atan2(x, z)
    const h = Math.hypot(x, z)
    const pitch = Math.atan2(y, h)
    return [yaw, Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, pitch))]
  }

  flyTo(lat: number, lng: number, zoom = 1.6, duration = 1400): Promise<void> {
    const [ty, tp] = GlobeEngine.viewFor(lat, lng)
    const norm = (a: number) => Math.atan2(Math.sin(a), Math.cos(a))
    const dy = norm(ty - this.yaw)
    this.velYaw = 0; this.velPitch = 0
    this.lastInteraction = performance.now()
    if (this.reducedMotion) duration = Math.min(duration, 250)
    return new Promise((resolve) => {
      this.anim = { t0: performance.now(), dur: duration, from: [this.yaw, this.pitch, this.zoom], to: [this.yaw + dy, tp, Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom))], done: resolve }
    })
  }

  /** factor > 1 zooms in. */
  zoomBy(factor: number) {
    this.zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, this.zoom * factor))
    this.lastInteraction = performance.now()
  }

  getZoom() { return this.zoom }

  // ---------- input ----------
  private bindInput() {
    const el = this.renderer.domElement
    const sig = this.abort.signal
    el.style.touchAction = 'none'
    el.style.cursor = 'grab'
    el.addEventListener('pointerdown', (e) => {
      el.setPointerCapture(e.pointerId)
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
      this.lastInteraction = performance.now()
      this.anim = null
      if (this.pointers.size === 1) {
        this.drag = { x: e.clientX, y: e.clientY, t: performance.now(), moved: 0, lastX: e.clientX, lastY: e.clientY, lastT: performance.now() }
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
        const k = 0.0034 / this.zoom
        this.yaw += dx * k
        this.pitch = Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, this.pitch + dy * k))
        const dt = Math.max(8, now - this.drag.lastT)
        this.velYaw = (dx * k) / dt * 16
        this.velPitch = (dy * k) / dt * 16
        this.drag.moved += Math.abs(dx) + Math.abs(dy)
        this.drag.lastX = e.clientX; this.drag.lastY = e.clientY; this.drag.lastT = now
        this.lastInteraction = now
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
          this.select(id, true)
        }
        this.drag = null
      }
      if (this.pointers.size < 2) this.pinchDist = 0
      el.style.cursor = 'grab'
    }
    el.addEventListener('pointerup', up, { signal: sig })
    el.addEventListener('pointercancel', up, { signal: sig })
    el.addEventListener('wheel', (e) => {
      e.preventDefault()
      this.zoomBy(Math.exp(-Math.sign(e.deltaY) * Math.min(0.25, Math.abs(e.deltaY) * 0.0015)))
    }, { passive: false, signal: sig })
    el.addEventListener('keydown', (e) => {
      const step = 0.08
      if (e.key === 'ArrowLeft') { this.yaw -= step; e.preventDefault() }
      else if (e.key === 'ArrowRight') { this.yaw += step; e.preventDefault() }
      else if (e.key === 'ArrowUp') { this.pitch = Math.min(PITCH_LIMIT, this.pitch + step); e.preventDefault() }
      else if (e.key === 'ArrowDown') { this.pitch = Math.max(-PITCH_LIMIT, this.pitch - step); e.preventDefault() }
      else if (e.key === '+' || e.key === '=') this.zoomBy(1.18)
      else if (e.key === '-' || e.key === '_') this.zoomBy(0.85)
      this.lastInteraction = performance.now()
    }, { signal: sig })
    el.tabIndex = 0
    el.setAttribute('role', 'application')
    el.setAttribute('aria-label', 'Globe. Drag to rotate, scroll or pinch to zoom, arrow keys to rotate, plus and minus to zoom.')
  }

  private tmp = new THREE.Vector3()
  private project(i: number): { x: number; y: number; facing: number } {
    const v = this.tmp.copy(this.markerWorld[i]).applyMatrix4(this.globe.matrixWorld)
    const facing = v.clone().normalize().dot(this.camera.position.clone().sub(v).normalize())
    v.project(this.camera)
    const w = this.renderer.domElement.clientWidth, h = this.renderer.domElement.clientHeight
    return { x: (v.x * 0.5 + 0.5) * w, y: (-v.y * 0.5 + 0.5) * h, facing }
  }

  private pick(clientX: number, clientY: number): string | null {
    if (!this.markers.length) return null
    const rect = this.renderer.domElement.getBoundingClientRect()
    const px = clientX - rect.left, py = clientY - rect.top
    let best: string | null = null
    let bestD = 22 * 22
    for (let i = 0; i < this.markers.length; i++) {
      const p = this.project(i)
      if (p.facing < 0.1) continue
      const d = (p.x - px) ** 2 + (p.y - py) ** 2
      if (d < bestD) { bestD = d; best = this.markers[i].id }
    }
    return best
  }

  private updateLabels() {
    const w = this.renderer.domElement.clientWidth
    for (let i = 0; i < this.markers.length; i++) {
      const m = this.markers[i]
      const el = this.labelEls.get(m.id)
      if (!el) continue
      const p = this.project(i)
      const vis = p.facing > 0.22 && p.x > -40 && p.x < w + 40
      if (!vis) { el.style.opacity = '0'; el.style.pointerEvents = 'none'; continue }
      const fade = Math.min(1, (p.facing - 0.22) / 0.3)
      const zoomFade = m.kind === 'city' ? Math.min(1, Math.max(0, (this.zoom - 0.78) / 0.25)) : 1
      el.style.opacity = String(fade * zoomFade)
      el.style.pointerEvents = fade * zoomFade > 0.3 ? 'auto' : 'none'
      el.style.transform = `translate(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px)`
    }
  }

  // ---------- loop ----------
  private resize() {
    const { clientWidth: w, clientHeight: h } = this.opts.container
    if (!w || !h) return
    this.renderer.setSize(w, h, false)
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
    // Distance at which the unit sphere fits the smaller viewport axis with a little air around it.
    const vHalf = THREE.MathUtils.degToRad(this.camera.fov / 2)
    const hHalf = Math.atan(Math.tan(vHalf) * this.camera.aspect)
    const margin = w < 700 ? 1.06 : 1.18
    this.fitDist = margin / Math.sin(Math.min(vHalf, hHalf))
    const pr = this.renderer.getPixelRatio()
    this.dotMat.uniforms.uPixelRatio.value = pr
    this.markerMat.uniforms.uPixelRatio.value = pr
  }

  private lastSun = 0
  private loop = () => {
    if (this.disposed) return
    this.raf = requestAnimationFrame(this.loop)
    if (document.hidden) return
    const now = performance.now()
    const dt = Math.min(0.05, (now - this.lastFrame) / 1000)
    this.lastFrame = now
    const t = (now - this.t0) / 1000
    this.dotMat.uniforms.uTime.value = t
    this.markerMat.uniforms.uTime.value = t
    if (now - this.lastSun > 60000) { this.lastSun = now; this.updateSun() }

    if (this.anim) {
      const k = Math.min(1, (now - this.anim.t0) / this.anim.dur)
      const e = easeInOut(k)
      const { from, to } = this.anim
      this.yaw = from[0] + (to[0] - from[0]) * e
      this.pitch = from[1] + (to[1] - from[1]) * e
      // arc the zoom: pull out a little mid-flight for a sense of travel
      const lift = Math.sin(k * Math.PI) * Math.min(0.35, Math.abs(to[0] - from[0]) * 0.18)
      this.zoom = Math.max(MIN_ZOOM * 0.9, from[2] + (to[2] - from[2]) * e - lift)
      if (k >= 1) { const done = this.anim.done; this.anim = null; done?.() }
    } else if (!this.drag) {
      this.yaw += this.velYaw
      this.pitch = Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, this.pitch + this.velPitch))
      this.velYaw *= 0.93; this.velPitch *= 0.9
      if (Math.abs(this.velYaw) < 1e-5) this.velYaw = 0
      if (Math.abs(this.velPitch) < 1e-5) this.velPitch = 0
      const idle = now - this.lastInteraction > 3500
      if (this.autoRotate && !this.reducedMotion && idle && this.pointers.size === 0) {
        this.yaw += 0.035 * dt
      }
    }
    this.globe.rotation.set(this.pitch, this.yaw, 0)
    this.dist = this.fitDist / this.zoom
    this.camera.position.set(0, 0, this.dist)
    this.camera.lookAt(0, 0, 0)
    this.atmoMat.uniforms.uStrength.value = 0.55 + 0.3 * Math.min(1, Math.max(0, (1.4 - this.zoom)))
    this.renderer.render(this.scene, this.camera)
    this.updateLabels()
  }

  dispose() {
    this.disposed = true
    cancelAnimationFrame(this.raf)
    this.abort.abort()
    this.ro.disconnect()
    for (const el of this.labelEls.values()) el.remove()
    this.labelEls.clear()
    this.renderer.dispose()
    this.renderer.domElement.remove()
  }
}
