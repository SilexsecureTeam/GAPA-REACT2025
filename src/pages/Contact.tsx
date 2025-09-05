import { useState } from 'react'
import toast from 'react-hot-toast'

export default function Contact() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name || !email || !message) {
      toast.error('Please fill in your name, email and message.')
      return
    }
    try {
      setLoading(true)
      // TODO: integrate real contact API
      await new Promise((r) => setTimeout(r, 800))
      toast.success('Message sent. We will get back to you shortly!')
      setName(''); setEmail(''); setPhone(''); setSubject(''); setMessage('')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-white">
      <section className="mx-auto max-w-7xl px-4 sm:px-6 py-10 sm:py-14">
        <div className="overflow-hidden rounded-xl border border-[#EEE] bg-white shadow-sm">
          {/* Top strip */}
          <div className="bg-[#F7E9AE] px-4 py-3 sm:px-6">
            <h1 className="text-[16px] sm:text-[18px] font-semibold text-[#0F1020]">Get In Touch With Us</h1>
          </div>

          {/* Main content */}
          <div className="grid grid-cols-1 gap-6 p-4 sm:p-6 md:grid-cols-[320px_1fr]">
            {/* Left: Contact details */}
            <aside className="text-[#0F1020]">
              <div>
                <h3 className="text-[14px] font-semibold">Phone Number</h3>
                <p className="mt-1 text-[14px] text-gray-700">+234 708 888 5268</p>
              </div>
              <div className="my-4 h-px bg-gray-200" />
              <div>
                <h3 className="text-[14px] font-semibold">Email Address</h3>
                <p className="mt-1 text-[14px] text-gray-700">sales@gapaautoparts.com</p>
              </div>
              <div className="my-4 h-px bg-gray-200" />
              <div>
                <h3 className="text-[14px] font-semibold">Location</h3>
                <p className="mt-1 max-w-xs text-[14px] text-gray-700">Gapa Naija (1st Floor,Sunset plaza, Ademola Adetokunbo Crescent, Wuse II, FCT-Abuja, Nigeria.</p>
              </div>
            </aside>

            {/* Right: Form */}
            <section>
              <h2 className="text-[18px] sm:text-[20px] font-semibold text-[#0F1020]">Send us a message</h2>
              <p className="mt-1 text-[13px] text-gray-600">Have a question or need support? Fill out the form below and our team will get back to you shortly</p>
              <form onSubmit={onSubmit} className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <input aria-label="Your Name" placeholder="Your Name" value={name} onChange={(e)=>setName(e.target.value)} className="h-11 rounded-md border border-[#E5E7EB] bg-white px-3 text-[14px] outline-none focus:ring-2 focus:ring-[#E6D9F4] sm:col-span-1" />
                <input aria-label="Your E-mail" type="email" placeholder="Your E-mail" value={email} onChange={(e)=>setEmail(e.target.value)} className="h-11 rounded-md border border-[#E5E7EB] bg-white px-3 text-[14px] outline-none focus:ring-2 focus:ring-[#E6D9F4] sm:col-span-1" />
                <input aria-label="Phone Number" placeholder="Phone Number" value={phone} onChange={(e)=>setPhone(e.target.value)} className="h-11 rounded-md border border-[#E5E7EB] bg-white px-3 text-[14px] outline-none focus:ring-2 focus:ring-[#E6D9F4] sm:col-span-1" />
                <input aria-label="Subject" placeholder="Subject" value={subject} onChange={(e)=>setSubject(e.target.value)} className="h-11 rounded-md border border-[#E5E7EB] bg-white px-3 text-[14px] outline-none focus:ring-2 focus:ring-[#E6D9F4] sm:col-span-1" />
                <textarea aria-label="Message" placeholder="Message" value={message} onChange={(e)=>setMessage(e.target.value)} className="h-32 rounded-md border border-[#E5E7EB] bg-white px-3 py-2 text-[14px] outline-none focus:ring-2 focus:ring-[#E6D9F4] sm:col-span-2" />
                <div className="sm:col-span-2">
                  <button type="submit" disabled={loading} className="inline-flex items-center rounded-md bg-[#5A1E78] px-5 py-2.5 text-[14px] font-semibold text-white shadow-sm hover:brightness-110 disabled:opacity-60">
                    Send Message
                  </button>
                </div>
              </form>
            </section>
          </div>
        </div>
      </section>
    </div>
  )
}
