import { useEffect, useRef, useState } from 'react'
import { heartbeat } from '../api/client'

// Soft-lock: fullscreen wajib + hitung focus_lost + heartbeat 20s
export function useLockdown(examId: string, enabled: boolean) {
  const [focusLost, setFocusLost] = useState(0)
  const [isFullscreen, setIsFullscreen] = useState(!!document.fullscreenElement)
  const [action, setAction] = useState<'OK'|'WARN'|'AUTO_SUBMIT'>('OK')
  const focusRef = useRef(0)

  useEffect(() => {
    if (!enabled) return
    const onFs = () => setIsFullscreen(!!document.fullscreenElement)
    const device = () => {
      try { return localStorage.getItem('cbt.device') || '' } catch { return '' }
    }
    const onHide = () => {
      if (document.hidden) {
        focusRef.current += 1
        setFocusLost(focusRef.current)
        heartbeat(examId, focusRef.current, !!document.fullscreenElement, device())
          .then(d => { if (d.action) setAction(d.action) })
          .catch(() => {})
      }
    }
    const onCtx = (e: Event) => e.preventDefault()
    document.addEventListener('fullscreenchange', onFs)
    document.addEventListener('visibilitychange', onHide)
    document.addEventListener('contextmenu', onCtx)
    // Heartbeat berkala 20 dtk (PRD): tanpa ini pelanggaran tak tercatat
    // bila tab tak pernah disembunyikan, dan live proktor basi.
    const beat = setInterval(() => {
      heartbeat(examId, focusRef.current, !!document.fullscreenElement, device())
        .then(d => { if (d.action) setAction(d.action) })
        .catch(() => {})
    }, 20000)
    return () => {
      clearInterval(beat)
      document.removeEventListener('fullscreenchange', onFs)
      document.removeEventListener('visibilitychange', onHide)
      document.removeEventListener('contextmenu', onCtx)
    }
  }, [examId, enabled])

  const enterFullscreen = () => document.documentElement.requestFullscreen?.().catch(() => {})

  return { focusLost, isFullscreen, action, enterFullscreen }
}
