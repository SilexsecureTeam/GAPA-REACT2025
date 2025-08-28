import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../services/auth'
import { getProfile, logout as apiLogout } from '../services/api'
import toast from 'react-hot-toast'

export default function Profile() {
  const { user, setSession, logout } = useAuth()
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    let ignore = false
    async function load() {
      if (!user) return
      setLoading(true)
      setErr(null)
      try {
        const fresh = await getProfile()
        if (!ignore) {
          // keep existing token, only refresh user
          const token = localStorage.getItem('authToken') || ''
          if (token) setSession(fresh as any, token)
        }
      } catch (e: any) {
        if (!ignore) setErr(e?.data?.message || e.message || 'Failed to load profile')
      } finally {
        if (!ignore) setLoading(false)
      }
    }
    load()
    return () => { ignore = true }
  }, [])

  if (!user) return <Navigate to="/login" replace />

  const handleLogout = async () => {
    try {
      await apiLogout()
    } catch {}
    logout()
    toast.success('Signed out')
  }

  return (
    <div className="bg-white">
      <section className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <div className="rounded-2xl border border-black/10 bg-white p-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-semibold text-gray-900">My Profile</h1>
              <p className="mt-1 text-sm text-gray-600">Manage your account information</p>
            </div>
            <button onClick={handleLogout} className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white hover:brightness-110">Sign out</button>
          </div>

          {err && <div className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-200">{err}</div>}

          <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2">
            <Info label="Name" value={user.name} />
            <Info label="Email" value={user.email} />
            <Info label="Phone" value={user.phone || ''} />
            <Info label="Address" value={user.address || ''} />
            <Info label="City" value={user.city || ''} />
            <Info label="Region" value={user.region || ''} />
            <Info label="Country" value={user.country || ''} />
          </div>

          <div className="mt-8 rounded-lg bg-[#F8F5FC] p-4 text-sm text-gray-700">
            <p><span className="font-medium text-[#5A1E78]">Tip:</span> Keep your account details up to date to enjoy faster checkout and personalized recommendations.</p>
          </div>

          {loading && <p className="mt-4 text-sm text-gray-500">Refreshing profile…</p>}
        </div>
      </section>
    </div>
  )
}

function Info({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-gray-700">{label}</span>
      <input value={value || ''} readOnly className="mt-1 h-10 w-full cursor-default rounded-md bg-[#F3F1F6] px-3 text-sm text-gray-900 outline-none ring-1 ring-black/10" />
    </label>
  )
}
