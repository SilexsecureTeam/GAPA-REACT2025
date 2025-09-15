import { useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'

export default function OrderSuccess() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const ref = params.get('ref') || ''
  const amount = params.get('amount') || ''

  const amountDisplay = useMemo(() => {
    const n = Number(amount)
    if (!isNaN(n) && n > 0) return `₦${n.toLocaleString('en-NG')}`
    return ''
  }, [amount])

  return (
    <div className="bg-white pt-10">
      <section className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
        <div className="rounded-2xl bg-[#F6F5FA] p-8 ring-1 ring-black/10">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-green-100 text-green-700 ring-1 ring-green-200">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-7 w-7"><path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12Zm13.36-1.814a.75.75 0 1 0-1.22-.872l-3.236 4.53-1.64-1.64a.75.75 0 1 0-1.06 1.061l2.25 2.25a.75.75 0 0 0 1.14-.094l3.766-5.235Z" clipRule="evenodd" /></svg>
          </div>
          <h1 className="text-center text-2xl font-semibold text-gray-900">Order Successful</h1>
          <p className="mt-2 text-center text-sm text-gray-700">Thank you for your purchase. Your payment was received successfully.</p>

          <div className="mt-6 divide-y divide-black/10 overflow-hidden rounded-lg bg-white ring-1 ring-black/10">
            {amountDisplay && (
              <div className="grid grid-cols-2 gap-2 p-4 text-sm">
                <div className="text-gray-600">Amount</div>
                <div className="text-right font-semibold text-gray-900">{amountDisplay}</div>
              </div>
            )}
            {ref && (
              <div className="grid grid-cols-2 gap-2 p-4 text-sm">
                <div className="text-gray-600">Reference</div>
                <div className="truncate text-right font-medium text-gray-900">{ref}</div>
              </div>
            )}
          </div>

          <div className="mt-8 flex flex-col items-stretch gap-3 sm:flex-row sm:justify-center">
            <button onClick={() => navigate('/')} className="inline-flex h-10 items-center justify-center rounded-md bg-[#F7CD3A] px-6 text-[14px] font-semibold text-gray-900 ring-1 ring-black/10">Continue shopping</button>
            <button onClick={() => navigate('/profile')} className="inline-flex h-10 items-center justify-center rounded-md bg-gray-100 px-6 text-[14px] font-semibold text-gray-900 ring-1 ring-black/10">Go to account</button>
          </div>
        </div>
      </section>
    </div>
  )
}
