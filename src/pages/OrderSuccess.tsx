import { useMemo, useRef } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import logo from '../assets/gapa-logo.png'
// Helper to get absolute URL for images
function toAbsoluteUrl(src: string) {
  if (!src) return '';
  if (/^https?:\/\//.test(src)) return src;
  if (src.startsWith('/')) return window.location.origin + src;
  return window.location.origin + '/' + src.replace(/^\//, '');
}

export default function OrderSuccess() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const receiptRef = useRef<HTMLDivElement>(null)
  
  const ref = params.get('ref') || ''
  const amount = params.get('amount') || ''
  const orderId = params.get('orderId') || ref
  const date = params.get('date') || new Date().toISOString()
  const status = params.get('status') || 'Processing'
  const address = params.get('address') || ''

  const amountDisplay = useMemo(() => {
    const n = Number(amount)
    if (!isNaN(n) && n > 0) return `₦${n.toLocaleString('en-NG')}`
    return ''
  }, [amount])

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr)
      return d.toLocaleDateString('en-US', { 
        month: 'long', 
        day: 'numeric', 
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    } catch {
      return dateStr
    }
  }

  const handlePrint = () => {
    if (!receiptRef.current) return;
    // Clone the receipt node so we can adjust image URLs
    const clone = receiptRef.current.cloneNode(true) as HTMLElement;
    // Fix all img src to absolute URLs
    clone.querySelectorAll('img').forEach(img => {
      if (img.src) img.src = toAbsoluteUrl(img.getAttribute('src') || img.src);
    });
    // Collect all stylesheets and style tags from the main document
    let styles = '';
    document.querySelectorAll('link[rel="stylesheet"], style').forEach((el) => {
      if (el.tagName === 'LINK') {
        const href = (el as HTMLLinkElement).href;
        if (href) styles += `<link rel="stylesheet" href="${href}">`;
      } else if (el.tagName === 'STYLE') {
        styles += `<style>${el.innerHTML}</style>`;
      }
    });
    const printWindow = window.open('', '', 'width=800,height=600');
    if (!printWindow) return;
    printWindow.document.write(`
      <html>
        <head>
          <title>Order Receipt</title>
          ${styles}
          <style>
            body { background: white; margin: 0; padding: 0; }
            @media print { .print\\:hidden { display: none !important; } }
          </style>
        </head>
        <body>
          <div>${clone.innerHTML}</div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 400);
  }

  return (
    <div className="bg-gradient-to-br from-gray-50 to-white pt-10 print:bg-white">
      <section className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
        {/* Success Header - Hide on print */}
        <div className="mb-8 print:hidden">
          <div className="rounded-2xl bg-gradient-to-br from-green-50 to-emerald-50 p-8 text-center ring-1 ring-green-200 shadow-sm">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-500 shadow-lg ring-4 ring-green-100">
              <svg className="h-8 w-8 text-white" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="text-3xl font-bold text-gray-900">Payment Successful!</h1>
            <p className="mt-2 text-gray-700">Thank you for your purchase. Your order has been received.</p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <button
                onClick={handlePrint}
                className="inline-flex items-center gap-2 rounded-lg bg-white px-5 py-2.5 text-sm font-semibold text-gray-900 ring-1 ring-black/10 transition-all hover:bg-gray-50"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                </svg>
                Print Receipt
              </button>
              <Link
                to="/order-history"
                className="inline-flex items-center gap-2 rounded-lg bg-[#F7CD3A] px-5 py-2.5 text-sm font-semibold text-gray-900 transition-all hover:brightness-105"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                View All Orders
              </Link>
            </div>
          </div>
        </div>

        {/* Receipt - Print friendly */}
        <div ref={receiptRef} className="overflow-hidden rounded-2xl bg-white shadow-lg ring-1 ring-black/10 print:shadow-none print:ring-0">
          {/* Receipt Header */}
          <div className="border-b border-gray-200 bg-gradient-to-r from-[#201A2B] to-[#350e49] p-8 text-white print:bg-[#201A2B]">
            <div className="flex items-start justify-between">
              <div>
                <img src={toAbsoluteUrl(logo)} alt="GAPA Auto Parts" className="h-12 w-auto" />
                <h2 className="mt-4 text-2xl font-bold">Order Receipt</h2>
                <p className="mt-1 text-sm text-gray-300">Thank you for your purchase</p>
              </div>
              <div className="text-right">
                <div className="inline-flex items-center gap-2 rounded-lg bg-white/10 px-4 py-2 backdrop-blur-sm">
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="text-sm font-semibold">{status}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Receipt Body */}
          <div className="p-8">
            {/* Order Information Grid */}
            <div className="grid gap-6 md:grid-cols-2">
              {/* Left Column */}
              <div className="space-y-6">
                <div>
                  <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-gray-500">
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                    </svg>
                    Order Details
                  </h3>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Order ID</span>
                      <span className="text-sm font-semibold text-gray-900">#{orderId}</span>
                    </div>
                    {ref && ref !== orderId && (
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">Reference</span>
                        <span className="text-sm font-mono font-medium text-gray-900">{ref}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Order Date</span>
                      <span className="text-sm font-medium text-gray-900">{formatDate(date)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Payment Method</span>
                      <span className="text-sm font-medium text-gray-900">Online Payment</span>
                    </div>
                  </div>
                </div>

                {address && (
                  <div>
                    <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-gray-500">
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      Shipping Address
                    </h3>
                    <p className="text-sm text-gray-700 leading-relaxed">{address}</p>
                  </div>
                )}
              </div>

              {/* Right Column */}
              <div className="space-y-6">
                <div>
                  <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-gray-500">
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                    </svg>
                    Payment Summary
                  </h3>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Subtotal</span>
                      <span className="text-sm font-medium text-gray-900">{amountDisplay}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Tax (VAT)</span>
                      <span className="text-sm font-medium text-gray-900">Included</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Shipping</span>
                      <span className="text-sm font-medium text-gray-900">Calculated</span>
                    </div>
                    <div className="border-t border-gray-200 pt-3">
                      <div className="flex justify-between">
                        <span className="text-base font-semibold text-gray-900">Total Paid</span>
                        <span className="text-xl font-bold text-[#F7CD3A]">{amountDisplay}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-lg bg-gradient-to-br from-blue-50 to-indigo-50 p-4 ring-1 ring-blue-200">
                  <div className="flex gap-3">
                    <svg className="h-5 w-5 flex-shrink-0 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div>
                      <p className="text-xs font-semibold text-blue-900">Order Tracking</p>
                      <p className="mt-1 text-xs text-blue-700">You'll receive an email with tracking details once your order ships.</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Divider */}
            <div className="my-8 border-t border-gray-200"></div>

            {/* Company Info */}
            <div className="grid gap-6 text-center md:grid-cols-3 md:text-left">
              <div>
                <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Customer Support</h4>
                <p className="text-sm text-gray-700">Email: sales@gapaautoparts.com</p>
                <p className="text-sm text-gray-700">Phone: +234 708 888 5268</p>
              </div>
              <div>
                <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Business Hours</h4>
                <p className="text-sm text-gray-700">Mon - Fri: 8:00 AM - 6:00 PM</p>
                <p className="text-sm text-gray-700">Sat: 9:00 AM - 4:00 PM</p>
              </div>
              <div>
                <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Visit Us</h4>
                <p className="text-sm text-gray-700">www.gapaautoparts.com</p>
                <p className="text-sm text-gray-700">Your trusted auto parts partner</p>
              </div>
            </div>
          </div>

          {/* Receipt Footer */}
          <div className="border-t border-gray-200 bg-gray-50 px-8 py-6 text-center print:bg-white">
            <p className="text-xs text-gray-600">
              This is a computer-generated receipt. For questions or concerns, please contact our customer support.
            </p>
            <p className="mt-2 text-xs font-semibold text-gray-900">
              Thank you for choosing GAPA Auto Parts!
            </p>
          </div>
        </div>

        {/* Action Buttons - Hide on print */}
        <div className="mt-8 flex flex-wrap justify-center gap-3 print:hidden">
          <button
            onClick={() => navigate('/')}
            className="inline-flex items-center gap-2 rounded-lg bg-[#F7CD3A] px-6 py-3 text-sm font-semibold text-gray-900 transition-all hover:brightness-105"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            Continue Shopping
          </button>
          <button
            onClick={() => navigate('/profile')}
            className="inline-flex items-center gap-2 rounded-lg bg-white px-6 py-3 text-sm font-semibold text-gray-900 ring-1 ring-black/10 transition-all hover:bg-gray-50"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            My Account
          </button>
        </div>
      </section>
    </div>
  )
}
