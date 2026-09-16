import { useEffect, useRef } from "react"
import * as THREE from "three"
import { vitals, getBrightness } from "@/lib/vitals"

// 全屏明亮 3D 背景：浅色天空 + 柔和粒子 + 程序化心血管孪生体
// （翠绿 + 珊瑚红血管网络环绕脉动核心，不依赖外部模型文件；整体淡化为背景衬托）
export function TwinBackground() {
  const mountRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return

    const scene = new THREE.Scene()
    scene.fog = new THREE.FogExp2(0xe9f1f6, 0.035)

    const camera = new THREE.PerspectiveCamera(55, mount.clientWidth / mount.clientHeight, 0.1, 200)
    camera.position.set(0, 3.2, 13)
    camera.lookAt(0, 1.4, 0)

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(mount.clientWidth, mount.clientHeight)
    renderer.setClearColor(0xeef4f8)
    mount.appendChild(renderer.domElement)

    // ── 网格地面（浅色细线）──
    const grid = new THREE.GridHelper(80, 80, 0xaec3d2, 0xd3e0e9)
    ;(grid.material as THREE.Material).transparent = true
    ;(grid.material as THREE.Material).opacity = 0.28
    grid.position.y = -2.4
    scene.add(grid)

    // ── 柔和浅绿粒子 ──
    const starCount = 900
    const starPos = new Float32Array(starCount * 3)
    for (let i = 0; i < starCount; i++) {
      starPos[i * 3] = (Math.random() - 0.5) * 120
      starPos[i * 3 + 1] = Math.random() * 50 - 2
      starPos[i * 3 + 2] = (Math.random() - 0.5) * 120
    }
    const starGeo = new THREE.BufferGeometry()
    starGeo.setAttribute("position", new THREE.BufferAttribute(starPos, 3))
    const starMat = new THREE.PointsMaterial({ color: 0x35b58a, size: 0.07, transparent: true, opacity: 0.3 })
    scene.add(new THREE.Points(starGeo, starMat))

    // ── 孪生体：脉动核心 ──
    const twin = new THREE.Group()
    twin.position.set(0, 1.6, 0)
    scene.add(twin)

    const coreMat = new THREE.MeshStandardMaterial({
      color: 0xe4f6ee,
      emissive: new THREE.Color(0x34d399),
      emissiveIntensity: 0.22,
      roughness: 0.55,
      metalness: 0.08,
      transparent: true,
      opacity: 0.9,
    })
    const core = new THREE.Mesh(new THREE.IcosahedronGeometry(1.05, 2), coreMat)
    twin.add(core)

    const wireMat = new THREE.MeshBasicMaterial({ color: 0x34d399, wireframe: true, transparent: true, opacity: 0.1 })
    const wireShell = new THREE.Mesh(new THREE.IcosahedronGeometry(1.7, 1), wireMat)
    twin.add(wireShell)

    // ── 血管网络：程序化管状曲线（翠绿 + 珊瑚红交替）──
    const vesselMats: THREE.MeshBasicMaterial[] = []
    const vessels = new THREE.Group()
    twin.add(vessels)
    const vesselCount = 14
    for (let i = 0; i < vesselCount; i++) {
      const pts: THREE.Vector3[] = []
      const a0 = (i / vesselCount) * Math.PI * 2
      const tilt = Math.sin(i * 2.3) * 0.9
      for (let j = 0; j <= 5; j++) {
        const t = j / 5
        const r = 1.2 + Math.sin(t * Math.PI) * (1.5 + (i % 3) * 0.35)
        const ang = a0 + t * (1.2 + (i % 4) * 0.35)
        pts.push(
          new THREE.Vector3(
            Math.cos(ang) * r,
            (t - 0.5) * (2.6 + (i % 3)) + tilt * Math.sin(t * Math.PI),
            Math.sin(ang) * r,
          ),
        )
      }
      const curve = new THREE.CatmullRomCurve3(pts)
      const geo = new THREE.TubeGeometry(curve, 32, 0.035 + (i % 3) * 0.012, 6, false)
      const mat = new THREE.MeshBasicMaterial({
        color: i % 2 === 0 ? 0x34d399 : 0xfb7185, // 翠绿 / 珊瑚红
        transparent: true,
        opacity: 0.45,
      })
      vesselMats.push(mat)
      vessels.add(new THREE.Mesh(geo, mat))
    }

    // 环绕轨道环
    const ringMat = new THREE.MeshBasicMaterial({ color: 0x8fc9b8, transparent: true, opacity: 0.4 })
    const ring = new THREE.Mesh(new THREE.TorusGeometry(3.4, 0.012, 8, 96), ringMat)
    ring.rotation.x = Math.PI / 2.4
    twin.add(ring)
    const ring2 = ring.clone()
    ring2.rotation.x = Math.PI / 1.7
    ring2.scale.setScalar(1.18)
    twin.add(ring2)

    // 灯光（明亮柔和）
    scene.add(new THREE.AmbientLight(0xffffff, 1.15))
    const key = new THREE.PointLight(0xffffff, 22, 40)
    key.position.set(4, 6, 6)
    scene.add(key)
    const fill = new THREE.PointLight(0xfde68a, 5, 30)
    fill.position.set(-6, 2, -4)
    scene.add(fill)

    // ── 渲染循环（RAF 节流 + 页面隐藏暂停）──
    let raf = 0
    let running = true
    let last = 0
    const clock = new THREE.Clock()

    // 血压语义色保留（绿→琥珀→红），全部用柔和色
    const sbpColor = (sbp: number, alert: number): THREE.Color => {
      if (alert === 1 || sbp >= 180 || sbp < 95) return new THREE.Color(0xf87171)
      if (alert <= 3 && alert > 0) return new THREE.Color(0xfbbf24)
      if (sbp >= 160) return new THREE.Color(0xfbbf24)
      return new THREE.Color(0x34d399)
    }

    const animate = () => {
      if (!running) return
      raf = requestAnimationFrame(animate)
      const now = performance.now()
      if (now - last < 1000 / 60) return
      last = now

      const t = clock.getElapsedTime()
      const brightness = getBrightness()
      const lit = vitals.twinLit
      const sbp = vitals.sbp

      // 脉动：收缩压映射强度与颜色；心率随监护状态加快
      const bpm = vitals.monitoring ? 92 : 68
      const beat = Math.pow(Math.max(0, Math.sin(t * (bpm / 60) * Math.PI * 2)), 3)
      const intensity = 0.12 + (sbp / 200) * 0.35
      const pulse = 1 + beat * intensity * (vitals.monitoring ? 0.28 : 0.16)
      core.scale.setScalar(pulse)
      vitals.beatPhase = beat

      const col = vitals.twinForecast >= 0
        ? new THREE.Color(0xf87171).lerp(new THREE.Color(0x34d399), vitals.twinForecast) // 孪生推演：红→绿
        : sbpColor(sbp, vitals.alertLevel)
      coreMat.emissive.lerp(col, 0.06)
      coreMat.emissiveIntensity = (lit ? 0.4 : 0.12) + beat * (lit ? 0.45 : 0.15)
      coreMat.opacity = lit ? 0.92 : 0.5
      for (const m of vesselMats) {
        m.color.lerp(col, 0.06)
        m.opacity = (lit ? 0.42 : 0.14) + beat * (lit ? 0.28 : 0.08)
      }
      wireMat.opacity = (lit ? 0.16 : 0.07) + beat * 0.04

      twin.rotation.y = t * 0.12
      vessels.rotation.y = -t * 0.07
      ring.rotation.z = t * 0.2
      ring2.rotation.z = -t * 0.15

      // 亮度滑杆：只影响背景（雾/粒子/网格/灯光），不影响 UI 面板
      starMat.opacity = 0.3 * brightness
      ;(grid.material as THREE.Material).opacity = 0.28 * brightness
      key.intensity = 22 * brightness
      fill.intensity = 5 * brightness
      const bg = new THREE.Color(0xf2f7fa).multiplyScalar(0.82 + 0.18 * brightness)
      renderer.setClearColor(bg)
      scene.fog!.color.copy(bg)

      renderer.render(scene, camera)
    }

    const onVis = () => {
      running = !document.hidden
      if (running) {
        clock.getDelta()
        animate()
      } else {
        cancelAnimationFrame(raf)
      }
    }
    document.addEventListener("visibilitychange", onVis)

    const onResize = () => {
      if (!mount) return
      camera.aspect = mount.clientWidth / mount.clientHeight
      camera.updateProjectionMatrix()
      renderer.setSize(mount.clientWidth, mount.clientHeight)
    }
    window.addEventListener("resize", onResize)

    animate()

    return () => {
      running = false
      cancelAnimationFrame(raf)
      document.removeEventListener("visibilitychange", onVis)
      window.removeEventListener("resize", onResize)
      mount.removeChild(renderer.domElement)
      renderer.dispose()
      starGeo.dispose()
      core.geometry.dispose()
      coreMat.dispose()
      wireMat.dispose()
      vesselMats.forEach((m) => m.dispose())
      ringMat.dispose()
    }
  }, [])

  // 整体降不透明度，作为淡淡背景衬托，不抢内容
  return <div ref={mountRef} className="fixed inset-0 -z-10" style={{ opacity: 0.8 }} aria-hidden />
}
