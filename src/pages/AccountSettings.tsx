import { useEffect, useMemo, useRef, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../services/auth'
import {
  changePassword,
  getProfile,
  updateDeliveryAddress,
  updateProfilePhoto,
  updateUserProfile,
  getAllStatesApi,
} from '../services/api'
import toast from 'react-hot-toast'

export default function AccountSettings() {
  const { user, setSession } = useAuth()
  const [loading, setLoading] = useState(false)

  // Local form state
  const [name, setName] = useState(user?.name || '')
  const [phone, setPhone] = useState(user?.phone || '')
  const [address, setAddress] = useState(user?.address || '')
  const [stateId, setStateId] = useState('')

  const [states, setStates] = useState<{ id?: string | number; name?: string; state?: string }[]>([])

  const [oldPassword, setOldPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  const fileRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    let ignore = false
    async function load() {
      if (!user) return
      setLoading(true)
      try {
        const fresh = await getProfile()
        const token = localStorage.getItem('authToken') || ''
        if (!ignore && token) setSession(fresh as any, token)
        const list = await getAllStatesApi()
        if (!ignore) setStates(list)
      } catch (e: any) {
        console.error(e)
      } finally {
        if (!ignore) setLoading(false)
      }
    }
    load()
    return () => { ignore = true }
  }, [])

  useEffect(() => {
    setName(user?.name || '')
    setPhone(user?.phone || '')
    setAddress(user?.address || '')
  }, [user])

  const stateOptions = useMemo(() => states.map((s) => ({ value: String(s.id ?? s.state ?? s.name ?? ''), label: String(s.name ?? s.state ?? s.id ?? '') })), [states])

  if (!user) return <Navigate to="/login" replace />

  const onSaveProfile = async () => {
    try {
      const res = await updateUserProfile({ user_id: user.id, name, phone, address })
      // Address also updated via dedicated endpoint to stay aligned with API
      if (address) await updateDeliveryAddress({ user_id: user.id, address })
      // optionally handle stateId if API supports it in the future
      toast.success(res?.message || 'Profile updated')
      const fresh = await getProfile()
      const token = localStorage.getItem('authToken') || ''
      if (token) setSession(fresh as any, token)
    } catch (e: any) {
      toast.error(e?.data?.message || e.message || 'Failed to update profile')
    }
  }

  const onChangePassword = async () => {
    if (!oldPassword || !newPassword) return toast.error('Enter current and new password')
    if (newPassword !== confirmPassword) return toast.error('Passwords do not match')
    try {
      const res = await changePassword({ id: user.id, old_password: oldPassword, new_password: newPassword })
      toast.success(res?.message || 'Password changed')
      setOldPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (e: any) {
      toast.error(e?.data?.message || e.message || 'Failed to change password')
    }
  }

  const onUploadPhoto = async (f?: File) => {
    try {
      const file = f || fileRef.current?.files?.[0]
      if (!file) return
      await updateProfilePhoto({ user_id: user.id, file })
      toast.success('Profile photo updated')
      const fresh = await getProfile()
      const token = localStorage.getItem('authToken') || ''
      if (token) setSession(fresh as any, token)
    } catch (e: any) {
      toast.error(e?.data?.message || e.message || 'Upload failed')
    }
  }

  return (
    <div className="bg-white">
      <header className="bg-[#F8F5FC]">
        <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-[#0F1020]">Account Settings</h1>
          <p className="mt-2 text-sm text-gray-600">Manage your account details, password, and addresses.</p>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Sidebar card with avatar */}
          <aside className="rounded-xl border border-black/10 bg-white p-6">
            <div className="flex items-center gap-4">
              <div className="h-16 w-16 overflow-hidden rounded-full ring-1 ring-black/10">
                {user?.image ? (
                  <img src={user.image} className="h-full w-full object-cover" alt="Profile" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-[#F3F1F6] text-sm text-gray-500">No Photo</div>
                )}
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900">{user?.name}</p>
                <p className="text-xs text-gray-600">{user?.email}</p>
              </div>
            </div>
            <div className="mt-4 flex items-center gap-3">
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={() => onUploadPhoto()} />
              <button onClick={() => fileRef.current?.click()} className="rounded-md bg-[#5A1E78] px-3 py-2 text-xs font-semibold text-white hover:brightness-110">Upload Photo</button>
            </div>
          </aside>

          {/* Main content */}
          <section className="lg:col-span-2 space-y-6">
            {/* Profile details */}
            <div className="rounded-xl border border-black/10 bg-white p-6">
              <h2 className="text-base font-semibold text-[#0F1020]">Profile Information</h2>
              <p className="mt-1 text-xs text-gray-600">Keep your personal details up to date.</p>

              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <LabelInput label="Full Name" value={name} onChange={setName} />
                <LabelInput label="Phone" value={phone} onChange={setPhone} />
                <div className="sm:col-span-2"><LabelInput label="Address" value={address} onChange={setAddress} /></div>
                <div>
                  <label className="block text-xs font-medium text-gray-700">State</label>
                  <select value={stateId} onChange={(e) => setStateId(e.target.value)} className="mt-1 h-10 w-full rounded-md bg-[#F3F1F6] px-3 text-sm text-gray-900 outline-none ring-1 ring-black/10">
                    <option value="">Select state</option>
                    {stateOptions.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="mt-4">
                <button disabled={loading} onClick={onSaveProfile} className="rounded-md bg-[#5A1E78] px-4 py-2 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-50">Save Changes</button>
              </div>
            </div>

            {/* Password */}
            <div className="rounded-xl border border-black/10 bg-white p-6">
              <h2 className="text-base font-semibold text-[#0F1020]">Change Password</h2>
              <p className="mt-1 text-xs text-gray-600">Choose a strong password you don’t use elsewhere.</p>

              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
                <LabelInput label="Current Password" type="password" value={oldPassword} onChange={setOldPassword} />
                <LabelInput label="New Password" type="password" value={newPassword} onChange={setNewPassword} />
                <LabelInput label="Confirm New Password" type="password" value={confirmPassword} onChange={setConfirmPassword} />
              </div>

              <div className="mt-4">
                <button onClick={onChangePassword} className="rounded-md bg-[#FA8232] px-4 py-2 text-sm font-semibold text-[#0F1020] hover:brightness-110">Update Password</button>
              </div>
            </div>

            {/* Delivery address helper note */}
            <div className="rounded-xl bg-[#F8F5FC] p-4 text-xs text-gray-700">
              <p><span className="font-medium text-[#5A1E78]">Note:</span> Your delivery address helps us calculate shipping and provide faster service.</p>
            </div>
          </section>
        </div>
      </main>
    </div>
  )
}

function LabelInput({ label, value, onChange, type = 'text' }: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-gray-700">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 h-10 w-full rounded-md bg-[#F3F1F6] px-3 text-sm text-gray-900 outline-none ring-1 ring-black/10"
      />
    </label>
  )
}
