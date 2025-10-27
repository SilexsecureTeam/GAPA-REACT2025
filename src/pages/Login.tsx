import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { login, register } from '../services/api'
import tyreHero from '../assets/login.png'
import google from '../assets/google.png'
import apple from '../assets/apple.png'
import { useAuth } from '../services/auth'
import toast from 'react-hot-toast'

export default function Login() {
  const nav = useNavigate()
  const { setSession } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const res = await login({ email, password })
      setSession(res.user, res.barear_token)
      toast.success('Signed in successfully')
      nav('/')
    } catch (err: any) {
      const msg = err?.data?.message || err.message || 'Login failed'
      setError(msg)
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  // OAuth popup helpers (mirrors SignUp behavior)
  useEffect(() => {
    function onMessage(e: MessageEvent) {
      try {
        if (e.origin !== window.location.origin) return
        const payload = e.data || {}
        if (payload && payload.type === 'oauth:callback') {
          sessionStorage.setItem('oauth:latest', JSON.stringify(payload.params || { error: payload.error }))
        }
      } catch (err) { /* ignore */ }
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [])

  const openOAuthPopup = (url: string, provider: 'google' | 'apple') => {
    sessionStorage.removeItem('oauth:latest')
    const w = 600, h = 700
    const left = window.screenX + Math.max(0, (window.outerWidth - w) / 2)
    const top = window.screenY + Math.max(0, (window.outerHeight - h) / 2)
    const opts = `width=${w},height=${h},left=${Math.round(left)},top=${Math.round(top)}`
    const popup = window.open(url, `oauth:${provider}`, opts)
    if (!popup) {
      toast.error('Popup blocked. Please allow popups for this site.')
      return Promise.reject(new Error('Popup blocked'))
    }
    return new Promise<Record<string,string>>((resolve, reject) => {
      const timeout = 1000 * 60
      const start = Date.now()
      const iv = setInterval(() => {
        const raw = sessionStorage.getItem('oauth:latest')
        if (raw) {
          clearInterval(iv)
          try { sessionStorage.removeItem('oauth:latest') } catch(_){}
          const parsed = JSON.parse(raw || '{}')
          resolve(parsed)
        } else if (popup.closed) {
          clearInterval(iv)
          reject(new Error('Popup closed'))
        } else if (Date.now() - start > timeout) {
          clearInterval(iv)
          try { popup.close() } catch(_){}
          reject(new Error('OAuth timeout'))
        }
      }, 500)
    })
  }

  const decodeJwt = (token: string) => {
    try {
      const parts = token.split('.')
      if (parts.length < 2) return null
      const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/')
      const json = decodeURIComponent(Array.prototype.map.call(atob(payload), function(c){
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)
      }).join(''))
      return JSON.parse(json)
    } catch (e) { return null }
  }

  const attemptSocialRegister = async (profile: { name?: string; email?: string; phone?: string }) => {
    const pwd = Math.random().toString(36).slice(2, 12) + 'A1!'
    const payload = {
      name: profile.name || profile.email?.split('@')[0] || 'User',
      email: profile.email || '',
      phone: profile.phone || '',
      role: 'customer',
      address: '',
      password: pwd,
      password_confirmation: pwd,
    }
    try {
      setLoading(true)
      const res = await register(payload)
      setSession(res.user, res.barear_token)
      toast.success('Signed in successfully')
      nav('/')
    } catch (err: any) {
      const msg = err?.data?.message || err?.message || 'Social sign-in failed. Please try signing up.'
      toast.error(msg)
      if (profile.email) nav('/login', { state: { email: profile.email } })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-[#F3EEF9] py-6">
      <div className="mx-auto max-w-5xl rounded-2xl bg-white p-0 ring-1 ring-black/10 sm:p-0">
        <div className="grid md:grid-cols-2">
          {/* Left: form */}
          <div className="p-8 sm:p-10">
            <h1 className="text-center text-[18px] font-semibold text-gray-900">Sign In</h1>
            <p className="mt-1 text-center text-[12px] text-gray-600">Do not have an account; <Link to="/signup" className="text-brand underline">create a new one.</Link></p>

            <form onSubmit={onSubmit} className="mt-6 space-y-4">
              <div>
                <label className="text-[12px] font-medium text-gray-900">Your email or Phone number*</label>
                <input value={email} onChange={(e)=>setEmail(e.target.value)} placeholder="Please enter your email or phone" className="mt-1 h-10 w-full rounded-md bg-[#F3F1F6] px-3 text-sm outline-none ring-1 ring-black/10" />
              </div>
              <div>
                <label className="text-[12px] font-medium text-gray-900">Password*</label>
                <input type="password" value={password} onChange={(e)=>setPassword(e.target.value)} placeholder="Enter password" className="mt-1 h-10 w-full rounded-md bg-[#F3F1F6] px-3 text-sm outline-none ring-1 ring-black/10" />
              </div>

              {error && <div className="rounded-md bg-red-50 px-3 py-2 text-[12px] text-red-700 ring-1 ring-red-200">{error}</div>}

              <button disabled={loading} className="mt-2 w-full rounded-md bg-brand py-2 text-[12px] font-semibold text-white disabled:opacity-60">{loading ? 'Signing in...' : 'SIGN IN'}</button>

              <div className="flex items-center justify-between text-[12px]">
                <Link to="/forgot-password" className="text-brand hover:underline">Forgot password?</Link>
                <Link to="/verify-otp" className="text-brand hover:underline">Send/Resend OTP</Link>
              </div>

              <div className="relative my-4 text-center text-[12px] text-gray-500">
                <span className="before:absolute before:left-0 before:top-1/2 before:h-px before:w-2/5 before:-translate-y-1/2 before:bg-gray-200 after:absolute after:right-0 after:top-1/2 after:h-px after:w-2/5 after:-translate-y-1/2 after:bg-gray-200">Or</span>
              </div>

              <div className="flex justify-center gap-4">
                <button
                  type="button"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full ring-1 ring-black/10"
                  onClick={async () => {
                    const clientId = (import.meta as any).env?.VITE_GOOGLE_CLIENT_ID || ''
                    if (!clientId) { toast.error('Missing Google client id (set VITE_GOOGLE_CLIENT_ID in .env)'); return }
                    const redirect = `${window.location.origin}/oauth-callback.html`
                    const nonce = Math.random().toString(36).slice(2)
                    const url = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirect)}&response_type=token%20id_token&scope=${encodeURIComponent('openid email profile')}&nonce=${encodeURIComponent(nonce)}&prompt=select_account`
                    try {
                      const params = await openOAuthPopup(url, 'google')
                      const access_token = params['access_token'] || params.accessToken || ''
                      const id_token = params['id_token'] || params.idToken || ''
                      let profile: any = { name: '', email: '', phone: '' }
                      if (access_token) {
                        try {
                          const r = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', { headers: { Authorization: `Bearer ${access_token}` } })
                          if (r.ok) profile = await r.json()
                        } catch (e) { /* ignore */ }
                      }
                      if ((!profile || !profile.email) && id_token) {
                        const decoded = decodeJwt(id_token)
                        if (decoded) {
                          profile.email = decoded.email || profile.email
                          profile.name = (decoded && (decoded.name || decoded.given_name)) || profile.name
                        }
                      }
                      if (!profile.email) { toast.error('Failed to obtain email from Google account'); return }
                      await attemptSocialRegister(profile)
                    } catch (e: any) {
                      toast.error(String(e?.message || e || 'Google sign-in failed'))
                    }
                  }}
                >
                  <img src={google} alt="Google" className="h-4 w-4" />
                </button>

                <button
                  type="button"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full ring-1 ring-black/10"
                  onClick={async () => {
                    const clientId = (import.meta as any).env?.VITE_APPLE_CLIENT_ID || ''
                    if (!clientId) { toast.error('Missing Apple client id (set VITE_APPLE_CLIENT_ID in .env)'); return }
                    const redirect = `${window.location.origin}/oauth-callback.html`
                    const state = Math.random().toString(36).slice(2)
                    const nonce = Math.random().toString(36).slice(2)
                    const url = `https://appleid.apple.com/auth/authorize?response_type=id_token&response_mode=fragment&client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirect)}&scope=${encodeURIComponent('name email')}&state=${encodeURIComponent(state)}&nonce=${encodeURIComponent(nonce)}`
                    try {
                      const params = await openOAuthPopup(url, 'apple')
                      const id_token = params['id_token'] || params.idToken || ''
                      if (!id_token) { toast.error('No id_token returned from Apple'); return }
                      const decoded = decodeJwt(id_token)
                      const profile: any = { name: '', email: '' }
                      if (decoded) {
                        profile.email = decoded.email || ''
                        profile.name = (decoded && (decoded.name || decoded.given_name)) || (decoded && decoded.sub) || ''
                      }
                      if (!profile.email) { toast.error('Failed to obtain email from Apple account'); return }
                      await attemptSocialRegister(profile)
                    } catch (e: any) {
                      toast.error(String(e?.message || e || 'Apple sign-in failed'))
                    }
                  }}
                >
                  <img src={apple} alt="Apple" className="h-4 w-4" />
                </button>
              </div>

              <p className="text-center text-[12px] text-gray-600">Don't have an account? <Link to="/signup" className="text-brand underline">Sign up</Link></p>
            </form>
          </div>

          {/* Right: image */}
          <div className="relative hidden overflow-hidden rounded-r-2xl bg-gray-100 md:block">
            <img src={tyreHero} alt="Sign in" className="absolute inset-0 h-full w-full object-cover" />
          </div>
        </div>
      </div>
    </div>
  )
}
