import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { login } from '../services/api'
import tyreHero from '../assets/login.png'
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
                <button type="button" className="inline-flex h-9 w-9 items-center justify-center rounded-full ring-1 ring-black/10" onClick={()=>toast('Google OAuth not yet implemented')}>G</button>
                <button type="button" className="inline-flex h-9 w-9 items-center justify-center rounded-full ring-1 ring-black/10" onClick={()=>toast('Apple OAuth not yet implemented')}></button>
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
