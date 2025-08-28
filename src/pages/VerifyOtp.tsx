import { useState } from 'react'
import toast from 'react-hot-toast'
import { requestOtp, resendOtp } from '../services/api'

export default function VerifyOtp() {
  const [identifier, setIdentifier] = useState('')
  const [loading, setLoading] = useState(false)
  const [resending, setResending] = useState(false)

  async function send(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      await requestOtp({ email: identifier })
      toast.success('OTP sent successfully')
    } catch (e: any) {
      toast.error(e?.data?.message || e.message || 'Failed to send OTP')
    } finally {
      setLoading(false)
    }
  }

  async function resend() {
    setResending(true)
    try {
      await resendOtp({ email: identifier })
      toast.success('OTP resent')
    } catch (e: any) {
      toast.error(e?.data?.message || e.message || 'Failed to resend OTP')
    } finally {
      setResending(false)
    }
  }

  return (
    <div className="bg-[#F3EEF9] py-6">
      <div className="mx-auto max-w-md rounded-2xl bg-white ring-1 ring-black/10">
        <div className="p-8 sm:p-10">
          <h1 className="text-center text-[18px] font-semibold text-gray-900">Send Verification OTP</h1>
          <p className="mt-1 text-center text-[12px] text-gray-600">We will send a verification code to your email or phone.</p>

          <form onSubmit={send} className="mt-6 space-y-4">
            <div>
              <label className="text-[12px] font-medium text-gray-900">Email or Phone*</label>
              <input value={identifier} onChange={(e)=>setIdentifier(e.target.value)} placeholder="you@example.com or 0801..." className="mt-1 h-10 w-full rounded-md bg-[#F3F1F6] px-3 text-sm outline-none ring-1 ring-black/10" />
            </div>

            <button disabled={loading || !identifier.trim()} className="mt-2 w-full rounded-md bg-brand py-2 text-[12px] font-semibold text-white disabled:opacity-60">
              {loading ? 'Sending...' : 'Send OTP'}
            </button>
          </form>

          <div className="mt-4 text-center">
            <button onClick={resend} disabled={resending || !identifier.trim()} className="text-xs font-medium text-brand disabled:opacity-60">
              {resending ? 'Resending…' : 'Resend OTP'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
