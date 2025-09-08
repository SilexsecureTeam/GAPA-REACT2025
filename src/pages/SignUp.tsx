import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { register, type RegisterPayload } from '../services/api'
import google from '../assets/google.png'
import apple from '../assets/apple.png'
import tyreHero from '../assets/login.png'
import { useAuth } from '../services/auth'
import toast from 'react-hot-toast'

const roles = [
  { value: 'customer', label: 'Customer' },
  { value: 'mechanic', label: 'Mechanic' },
  { value: 'dealer', label: 'Dealer' },
]

export default function SignUp() {
  const nav = useNavigate()
  const { setSession } = useAuth()
  const [form, setForm] = useState<RegisterPayload>({
    name: '',
    email: '',
    phone: '',
    role: 'customer',
    address: '',
    password: '',
    password_confirmation: '',
  })
  const [accepted, setAccepted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const update = (k: keyof RegisterPayload, v: string) => setForm((f) => ({ ...f, [k]: v }))

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!accepted) {
      const msg = 'Please accept the Terms & Privacy Policy to continue.'
      setError(msg)
      toast.error(msg)
      return
    }
    setError(null)
    setLoading(true)
    try {
      const res = await register(form)
      // API returns user + token (barear_token)
      setSession(res.user, res.barear_token)
      toast.success('Account created successfully')
      nav('/')
    } catch (err: any) {
      const msg = err?.data?.message || err.message || 'Registration failed'
      setError(msg)
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-[#F3EEF9] py-6">
      <div className="mx-auto max-w-5xl rounded-2xl bg-white ring-1 ring-black/10">
        <div className="grid md:grid-cols-2">
          {/* Left: form */}
          <div className="p-8 sm:p-10">
            <h1 className="text-center text-[18px] font-semibold text-gray-900">Create an account for free</h1>
            <div className="mt-2 flex justify-center gap-4">
              <button type="button" className="inline-flex h-9 w-9 items-center justify-center rounded-full ring-1 ring-black/10" onClick={()=>toast('Google OAuth not yet implemented')}>
                <img src={google} alt="Google" className="h-4 w-4" />
              </button>
              <button type="button" className="inline-flex h-9 w-9 items-center justify-center rounded-full ring-1 ring-black/10" onClick={()=>toast('Apple OAuth not yet implemented')}>
                <img src={apple} alt="Apple" className="h-4 w-4" />
              </button>
            </div>
            <div className="relative my-4 text-center text-[12px] text-gray-500">
              <span className="before:absolute before:left-0 before:top-1/2 before:h-px before:w-2/5 before:-translate-y-1/2 before:bg-gray-200 after:absolute after:right-0 after:top-1/2 after:h-px after:w-2/5 after:-translate-y-1/2 after:bg-gray-200">Or</span>
            </div>

            <form onSubmit={onSubmit} className="mt-2 space-y-4">
              <div>
                <label className="text-[12px] font-medium text-gray-900">Full name*</label>
                <input value={form.name} onChange={(e)=>update('name', e.target.value)} placeholder="Your full name" className="mt-1 h-10 w-full rounded-md bg-[#F3F1F6] px-3 text-sm outline-none ring-1 ring-black/10" />
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-[12px] font-medium text-gray-900">Email*</label>
                  <input value={form.email} onChange={(e)=>update('email', e.target.value)} placeholder="you@example.com" className="mt-1 h-10 w-full rounded-md bg-[#F3F1F6] px-3 text-sm outline-none ring-1 ring-black/10" />
                </div>
                <div>
                  <label className="text-[12px] font-medium text-gray-900">Phone*</label>
                  <input value={form.phone} onChange={(e)=>update('phone', e.target.value)} placeholder="0801 234 5678" className="mt-1 h-10 w-full rounded-md bg-[#F3F1F6] px-3 text-sm outline-none ring-1 ring-black/10" />
                </div>
              </div>
              <div>
                <label className="text-[12px] font-medium text-gray-900">Role*</label>
                <select value={form.role} onChange={(e)=>update('role', e.target.value)} className="mt-1 h-10 w-full rounded-md bg-[#F3F1F6] px-3 text-sm outline-none ring-1 ring-black/10">
                  {roles.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[12px] font-medium text-gray-900">Address</label>
                <input value={form.address} onChange={(e)=>update('address', e.target.value)} placeholder="Street, city" className="mt-1 h-10 w-full rounded-md bg-[#F3F1F6] px-3 text-sm outline-none ring-1 ring-black/10" />
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-[12px] font-medium text-gray-900">Password*</label>
                  <input type="password" value={form.password} onChange={(e)=>update('password', e.target.value)} placeholder="Create password" className="mt-1 h-10 w-full rounded-md bg-[#F3F1F6] px-3 text-sm outline-none ring-1 ring-black/10" />
                </div>
                <div>
                  <label className="text-[12px] font-medium text-gray-900">Confirm password*</label>
                  <input type="password" value={form.password_confirmation} onChange={(e)=>update('password_confirmation', e.target.value)} placeholder="Repeat password" className="mt-1 h-10 w-full rounded-md bg-[#F3F1F6] px-3 text-sm outline-none ring-1 ring-black/10" />
                </div>
              </div>

              <label className="flex items-start gap-2 text-[12px] text-gray-700">
                <input type="checkbox" checked={accepted} onChange={(e)=>setAccepted(e.target.checked)} className="mt-1 h-4 w-4 rounded border-gray-300 text-brand focus:ring-brand" />
                <span>By creating an account you are agreeing to our Terms and Conditions and Privacy Policy</span>
              </label>

              {error && <div className="rounded-md bg-red-50 px-3 py-2 text-[12px] text-red-700 ring-1 ring-red-200" role="alert">{error}</div>}

              <button disabled={loading} className="mt-1 w-full rounded-md bg-brand py-2 text-[12px] font-semibold text-white disabled:opacity-60">{loading ? 'Creating account...' : 'SIGN UP'}</button>

              <div className="flex items-center justify-between text-[12px]">
                <Link to="/verify-otp" className="text-brand hover:underline">Send/Resend OTP</Link>
                <span className="text-gray-600">Already have an account? <Link to="/login" className="text-brand underline">Login</Link></span>
              </div>
            </form>
          </div>

          {/* Right: image */}
          <div className="relative hidden overflow-hidden rounded-r-2xl bg-gray-100 md:block">
            <img src={tyreHero} alt="Create account" className="absolute inset-0 h-full w-full object-cover" />
          </div>
        </div>
      </div>
    </div>
  )
}
