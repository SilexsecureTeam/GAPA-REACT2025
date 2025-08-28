import { useState } from 'react'
import toast from 'react-hot-toast'
import { resetPassword } from '../services/api'

export default function ResetPassword() {
  const [identifier, setIdentifier] = useState('')
  const [otp, setOtp] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password !== confirm) {
      toast.error('Passwords do not match')
      return
    }
    setLoading(true)
    try {
      await resetPassword({ email: identifier, otp, password })
      toast.success('Password reset successful. You can now sign in.')
    } catch (e: any) {
      toast.error(e?.data?.message || e.message || 'Failed to reset password')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-[#F3EEF9] py-6">
      <div className="mx-auto max-w-md rounded-2xl bg-white ring-1 ring-black/10">
        <div className="p-8 sm:p-10">
          <h1 className="text-center text-[18px] font-semibold text-gray-900">Reset Password</h1>
          <p className="mt-1 text-center text-[12px] text-gray-600">Enter the OTP you received and set a new password.</p>

          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <div>
              <label className="text-[12px] font-medium text-gray-900">Email or Phone*</label>
              <input value={identifier} onChange={(e)=>setIdentifier(e.target.value)} placeholder="you@example.com or 0801..." className="mt-1 h-10 w-full rounded-md bg-[#F3F1F6] px-3 text-sm outline-none ring-1 ring-black/10" />
            </div>
            <div>
              <label className="text-[12px] font-medium text-gray-900">OTP*</label>
              <input value={otp} onChange={(e)=>setOtp(e.target.value)} placeholder="6-digit code" className="mt-1 h-10 w-full rounded-md bg-[#F3F1F6] px-3 text-sm outline-none ring-1 ring-black/10" />
            </div>
            <div>
              <label className="text-[12px] font-medium text-gray-900">New password*</label>
              <input type="password" value={password} onChange={(e)=>setPassword(e.target.value)} placeholder="Create a new password" className="mt-1 h-10 w-full rounded-md bg-[#F3F1F6] px-3 text-sm outline-none ring-1 ring-black/10" />
            </div>
            <div>
              <label className="text-[12px] font-medium text-gray-900">Confirm password*</label>
              <input type="password" value={confirm} onChange={(e)=>setConfirm(e.target.value)} placeholder="Repeat new password" className="mt-1 h-10 w-full rounded-md bg-[#F3F1F6] px-3 text-sm outline-none ring-1 ring-black/10" />
            </div>

            <button disabled={loading || !identifier.trim() || !otp.trim()} className="mt-2 w-full rounded-md bg-brand py-2 text-[12px] font-semibold text-white disabled:opacity-60">
              {loading ? 'Resetting...' : 'Reset Password'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
