import { useState } from 'react'
import toast from 'react-hot-toast'
import { changePassword } from '../services/api'
import { useAuth } from '../services/auth'

export default function ChangePassword() {
  const { user } = useAuth()
  const [current, setCurrent] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password !== confirm) {
      toast.error('Passwords do not match')
      return
    }
    if (!user?.id) {
      toast.error('You must be signed in')
      return
    }
    setLoading(true)
    try {
      await changePassword({ old_password: current, new_password: password, id: user.id })
      toast.success('Password changed successfully')
      setCurrent(''); setPassword(''); setConfirm('')
    } catch (e: any) {
      toast.error(e?.data?.message || e.message || 'Failed to change password')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-[#F3EEF9] py-6">
      <div className="mx-auto max-w-md rounded-2xl bg-white ring-1 ring-black/10">
        <div className="p-8 sm:p-10">
          <h1 className="text-center text-[18px] font-semibold text-gray-900">Change Password</h1>
          <p className="mt-1 text-center text-[12px] text-gray-600">Update your password for better security.</p>

          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <div>
              <label className="text-[12px] font-medium text-gray-900">Current password*</label>
              <input type="password" value={current} onChange={(e)=>setCurrent(e.target.value)} placeholder="Current password" className="mt-1 h-10 w-full rounded-md bg-[#F3F1F6] px-3 text-sm outline-none ring-1 ring-black/10" />
            </div>
            <div>
              <label className="text-[12px] font-medium text-gray-900">New password*</label>
              <input type="password" value={password} onChange={(e)=>setPassword(e.target.value)} placeholder="New password" className="mt-1 h-10 w-full rounded-md bg-[#F3F1F6] px-3 text-sm outline-none ring-1 ring-black/10" />
            </div>
            <div>
              <label className="text-[12px] font-medium text-gray-900">Confirm new password*</label>
              <input type="password" value={confirm} onChange={(e)=>setConfirm(e.target.value)} placeholder="Confirm new password" className="mt-1 h-10 w-full rounded-md bg-[#F3F1F6] px-3 text-sm outline-none ring-1 ring-black/10" />
            </div>

            <button disabled={loading} className="mt-2 w-full rounded-md bg-brand py-2 text-[12px] font-semibold text-white disabled:opacity-60">
              {loading ? 'Updating...' : 'Update Password'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
