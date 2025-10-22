import { useEffect, useRef, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../services/auth'
import {
  getUserProfileById,
  updateUserProfileExplicit,
  uploadProfileImageExplicit,
  resendOtp,
  forgotPassword,
  resetPassword,
  deleteUserAccount,
} from '../services/api'
import toast from 'react-hot-toast'

export default function Profile() {
  const { user, setSession, logout } = useAuth()
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [resetting, setResetting] = useState(false)

  // Editable profile fields
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')

  // Password reset (OTP) flow
  const [resetEmail, setResetEmail] = useState('')
  const [resetOtp, setResetOtp] = useState('')
  const [resetNewPassword, setResetNewPassword] = useState('')

  // Delete confirmation
  const [deleteConfirm, setDeleteConfirm] = useState('')

  const fileRef = useRef<HTMLInputElement | null>(null)

  // Load profile using new explicit endpoint
  useEffect(() => {
    let ignore = false
    async function load() {
      if (!user) return
      setLoading(true)
      try {
        const raw: any = await getUserProfileById(user.id)
        if (!raw || typeof raw !== 'object') throw new Error('Invalid profile response')
        if (!ignore) {
          setName(raw.name || '')
          setPhone(raw.phone || '')
          setAddress(raw.address || '')
          const token = localStorage.getItem('authToken') || ''
          if (token) setSession({ ...user, ...raw }, token)
        }
      } catch (e: any) {
        if (!ignore) toast.error(e?.message || 'Failed to load profile')
      } finally {
        if (!ignore) setLoading(false)
      }
    }
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])

  if (!user) return <Navigate to="/login" replace />

  const handleSave = async () => {
    if (saving) return
    setSaving(true)
    try {
      await updateUserProfileExplicit({ user_id: user.id, name, phone, address })
      toast.success('Profile updated')
      const raw: any = await getUserProfileById(user.id)
      const token = localStorage.getItem('authToken') || ''
      if (token) setSession({ ...user, ...raw }, token)
    } catch (e: any) {
      toast.error(e?.data?.message || e.message || 'Update failed')
    } finally { setSaving(false) }
  }

  const handleUpload = async () => {
    const file = fileRef.current?.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      await uploadProfileImageExplicit({ user_id: user.id, file })
      toast.success('Photo uploaded')
      const raw: any = await getUserProfileById(user.id)
      const token = localStorage.getItem('authToken') || ''
      if (token) setSession({ ...user, ...raw }, token)
    } catch (e: any) {
      toast.error(e?.data?.message || e.message || 'Upload failed')
    } finally { setUploading(false); if (fileRef.current) fileRef.current.value = '' }
  }

  const handleResendOtp = async () => {
    try {
      await resendOtp({ email: user.email })
      toast.success('OTP sent')
    } catch (e: any) {
      toast.error(e?.data?.message || e.message || 'Failed to send OTP')
    }
  }

  const handleForgot = async () => {
    if (!resetEmail) return toast.error('Enter email')
    try {
      await forgotPassword({ email: resetEmail })
      toast.success('If the email exists, an OTP was sent')
    } catch (e: any) {
      toast.error(e?.data?.message || e.message || 'Failed to request reset')
    }
  }

  const handleReset = async () => {
    if (!resetEmail || !resetOtp || !resetNewPassword) return toast.error('Fill all reset fields')
    setResetting(true)
    try {
      await resetPassword({ email: resetEmail, otp: resetOtp, password: resetNewPassword })
      toast.success('Password reset successful')
      setResetOtp('')
      setResetNewPassword('')
    } catch (e: any) {
      toast.error(e?.data?.message || e.message || 'Reset failed')
    } finally { setResetting(false) }
  }

  const handleDelete = async () => {
    if (deleteConfirm !== user.email && deleteConfirm !== 'DELETE') {
      return toast.error('Type your email or DELETE to confirm')
    }
    if (!confirm('This will permanently delete your account. Continue?')) return
    setDeleting(true)
    try {
      await deleteUserAccount(user.id)
      toast.success('Account deleted')
      logout()
    } catch (e: any) {
      toast.error(e?.data?.message || e.message || 'Deletion failed')
    } finally { setDeleting(false) }
  }

  const isVerified = !!(user.email_verified_at || user.verified_at)

  return (
    <div className="bg-white">
      <section className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <div className="flex flex-col gap-8 lg:flex-row">
          {/* Left column */}
          <div className="w-full lg:w-2/3 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">My Profile</h1>
                <p className="mt-1 text-sm text-gray-600">Manage your account information & security settings.</p>
              </div>
              <button
                onClick={async () => { await logout(); toast.success('Signed out') }}
                className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white hover:brightness-110"
              >Sign out</button>
            </div>

            {/* Profile Card */}
            <div className="rounded-2xl border border-black/10 bg-white p-6">
              <h2 className="text-base font-semibold text-gray-900">Profile Information</h2>
              <p className="mt-1 text-xs text-gray-600">Basic details associated with your account.</p>
              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Full Name" value={name} onChange={setName} />
                <Field label="Phone" value={phone} onChange={setPhone} />
                <div className="sm:col-span-2"><Field label="Address" value={address} onChange={setAddress} /></div>
                <div>
                  <label className="block text-xs font-medium text-gray-700">Email</label>
                  <input value={user.email} readOnly className="mt-1 h-10 w-full cursor-default rounded-md bg-[#F3F1F6] px-3 text-sm text-gray-900 outline-none ring-1 ring-black/10" />
                  <p className="mt-1 text-[11px] text-gray-500">Status: {isVerified ? <span className="text-green-600 font-medium">Verified</span> : <span className="text-amber-600 font-medium">Unverified</span>}</p>
                </div>
                <div className="flex flex-col gap-2">
                  <button onClick={handleResendOtp} className="mt-5 h-10 rounded-md bg-[#5A1E78] px-3 text-xs font-semibold text-white hover:brightness-110">Resend OTP</button>
                </div>
              </div>
              <div className="mt-4 flex gap-3">
                <button disabled={saving} onClick={handleSave} className="rounded-md bg-[#5A1E78] px-4 py-2 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-50">{saving ? 'Saving...' : 'Save Changes'}</button>
                {loading && <span className="text-xs text-gray-500 self-center">Refreshing…</span>}
              </div>
            </div>

            {/* Password Reset (OTP) */}
            <div className="rounded-2xl border border-black/10 bg-white p-6">
              <h2 className="text-base font-semibold text-gray-900">Password Reset (OTP)</h2>
              <p className="mt-1 text-xs text-gray-600">Forgot your password? Request an OTP and then reset it.</p>
              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Field label="Email" value={resetEmail} onChange={setResetEmail} placeholder={user.email} />
                <div className="flex flex-col">
                  <label className="text-xs font-medium text-gray-700">&nbsp;</label>
                  <button onClick={handleForgot} className="h-10 rounded-md bg-[#FA8232] px-3 text-xs font-semibold text-[#0F1020] hover:brightness-110">Request OTP</button>
                </div>
                <Field label="OTP" value={resetOtp} onChange={setResetOtp} />
                <Field label="New Password" value={resetNewPassword} onChange={setResetNewPassword} type="password" />
              </div>
              <div className="mt-4">
                <button disabled={resetting} onClick={handleReset} className="rounded-md bg-[#5A1E78] px-4 py-2 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-50">{resetting ? 'Resetting…' : 'Reset Password'}</button>
              </div>
            </div>

            {/* Danger Zone */}
            <div className="rounded-2xl border border-red-300 bg-white p-6">
              <h2 className="text-base font-semibold text-red-700">Danger Zone</h2>
              <p className="mt-1 text-xs text-gray-600">Delete your account and all associated data.</p>
              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Type your email or DELETE to confirm" value={deleteConfirm} onChange={setDeleteConfirm} />
                <div className="flex items-end">
                  <button disabled={deleting} onClick={handleDelete} className="h-10 rounded-md bg-red-600 px-4 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50">{deleting ? 'Deleting…' : 'Delete Account'}</button>
                </div>
              </div>
            </div>
          </div>

          {/* Right column */}
          <div className="w-full lg:w-1/3 space-y-6">
            <div className="rounded-2xl border border-black/10 bg-white p-6">
              <h2 className="text-base font-semibold text-gray-900">Profile Photo</h2>
              <p className="mt-1 text-xs text-gray-600">PNG or JPG, max 2MB recommended.</p>
              <div className="mt-4 flex items-center gap-4">
                <div className="h-20 w-20 overflow-hidden rounded-full ring-1 ring-black/10">
                  {user?.image ? (
                    <img src={user.image} alt="Profile" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-[#F3F1F6] text-[11px] text-gray-500">No Photo</div>
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleUpload} />
                  <button onClick={() => fileRef.current?.click()} className="rounded-md bg-[#5A1E78] px-3 py-2 text-xs font-semibold text-white hover:brightness-110">{uploading ? 'Uploading…' : 'Upload New'}</button>
                  <button onClick={() => { if (fileRef.current) fileRef.current.value=''; toast.success('Cleared selection') }} className="text-[11px] text-gray-500 hover:text-gray-700">Clear</button>
                </div>
              </div>
              <div className="mt-4 rounded-lg bg-[#F8F5FC] p-3 text-[11px] text-gray-600">
                Keep your profile picture professional. Square images display best.
              </div>
            </div>

            <div className="rounded-2xl border border-black/10 bg-white p-6 text-[11px] leading-relaxed text-gray-700">
              <h3 className="text-sm font-semibold text-gray-900 mb-2">Security Tips</h3>
              <ul className="list-disc pl-4 space-y-1">
                <li>Use a strong unique password.</li>
                <li>Never share your OTP with anyone.</li>
                <li>Keep your contact details up to date.</li>
              </ul>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}

function Field({ label, value, onChange, type = 'text', placeholder }: { label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string }) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-gray-700">{label}</span>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 h-10 w-full rounded-md bg-[#F3F1F6] px-3 text-sm text-gray-900 outline-none ring-1 ring-black/10"
      />
    </label>
  )
}
