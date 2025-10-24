import { useState } from 'react'
import type { FormEvent } from 'react'
import { toast } from 'react-hot-toast'
import { Link } from 'react-router-dom'
import logo from '../assets/gapa-logo.png'
import gigImg from '../assets/deliveryGig.png'
// import deliveryGig from '../assets/deliveryGig.png'

const BRAND = {
  primary: '#5A1E78',
  accent: '#BC81EA',
}

export default function Footer() {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')

  // Social links config
  const socials = [
    {
      label: 'Facebook',
      href: 'https://web.facebook.com/profile.php?id=100083569260685',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <path d="M22 12a10 10 0 1 0-11.5 9.9v-7h-2v-3h2v-2.3c0-2 1.2-3.1 3-3.1.9 0 1.8.1 1.8.1v2h-1c-1 0-1.3.6-1.3 1.2V12h2.3l-.4 3h-1.9v7A10 10 0 0 0 22 12"/>
        </svg>
      ),
    },
    {
      label: 'Twitter',
      href: 'https://x.com/gapanaija',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <path d="M22 5.9c-.7.3-1.5.5-2.3.6a4 4 0 0 0 1.7-2.2 8.1 8.1 0 0 1-2.5 1 4 4 0 0 0-6.9 3.6A11.4 11.4 0 0 1 3 4.8a4 4 0 0 0 1.2 5.3c-.6 0-1.2-.2-1.7-.5a4 4 0 0 0 3.2 3.9 4 4 0 0 1-1.7.1 4 4 0 0 0 3.7 2.8A8 8 0 0 1 2 18.6a11.4 11.4 0 0 0 6.2 1.8c7.5 0 11.7-6.3 11.7-11.7v-.5c.8-.5 1.5-1.2 2.1-2z"/>
        </svg>
      ),
    },
    {
      label: 'Instagram',
      href: 'https://www.instagram.com/gapanaija/',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <path d="M7 2h10a5 5 0 0 1 5 5v10a5 5 0 0 1-5 5H7a5 5 0 0 1-5-5V7a5 5 0 0 1 5-5zm5 6.5A4.5 4.5 0 1 0 16.5 13 4.5 4.5 0 0 0 12 8.5zM18 6.2a1.2 1.2 0 1 0 1.2 1.2A1.2 1.2 0 0 0 18 6.2z"/>
        </svg>
      ),
    },
    {
      label: 'LinkedIn',
      href: 'https://www.linkedin.com/company/gapa-naija/',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <path d="M6.94 6.94A2.06 2.06 0 1 1 4.88 4.9a2.06 2.06 0 0 1 2.06 2.05zM4.75 8.75h4.25v10.5H4.75zM14 8.75a5.25 5.25 0 0 1 5.25 5.25v5.25H15v-5.25a1.25 1.25 0 0 0-2.5 0v5.25H8.75V8.75H12c.7 0 1.34.32 1.75.83.69-.52 1.54-.83 2.25-.83z"/>
        </svg>
      ),
    },
  ]

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setStatus('error')
      toast.error('Please enter a valid email address')
      return
    }
    setStatus('loading')
    try {
      const res = await fetch('https://stockmgt.gapaautoparts.com/api/feedback/newsletter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: String(email).trim() })
      })

      if (!res.ok) {
        let msg = 'Subscription failed. Please try again.'
        try {
          const j = await res.json()
          if (j && j.message) msg = String(j.message)
        } catch (_) {}
        setStatus('error')
        toast.error(msg)
        return
      }

      // success
      setStatus('success')
      setEmail('')
      toast.success('Thanks — you are subscribed to our newsletter')
      setTimeout(() => setStatus('idle'), 1500)
    } catch (err) {
      console.error('Newsletter subscribe error', err)
      setStatus('error')
      toast.error('Network error — please try again')
    }
  }

  return (
    <footer className="bg-[#EFECE0] text-white">
      {/* Newsletter strip */}
      <div className="border-b border-white/15 bg-gradient-to-r from-[#5A1E78] to-[#BC81EA]">
        <div className="mx-auto grid md:max-w-2xl grid-cols-1 items-center gap-6 px-4 py-10 sm:grid-cols-1 sm:px-6">
          <div className='text-center'>
            <h3 className="text-2xl font-semibold tracking-tight">Subscribe to our newsletter</h3>
            <p className="mt-2 text-sm max-w-[80%] mx-auto text-white/80"> Don’t Miss Out on Exclusive Deals!
Be the first to know when new auto parts arrive, enjoy special discounts, and get expert maintenance tips straight from GAPA NAIJA.
Subscribe now and stay ahead of the road!
</p>
          </div>
          <form onSubmit={onSubmit} className="flex w-[80%] mx-auto justify-center flex-col gap-3 sm:flex-row">
            <div className="relative w-full">
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
                required
                placeholder="Enter your email address"
                className="h-12 w-full rounded-md bg-white/5 px-4 pr-11 text-sm text-white placeholder:text-white/50 outline-none ring-1 ring-white/15 focus:ring-white/25"
                aria-label="Email address"
              />
              {/* mail icon */}
              <span className="pointer-events-none absolute inset-y-0 right-3 inline-flex items-center text-white/40">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 4h16v16H4z" />
                  <path d="M22 6l-10 7L2 6" />
                </svg>
              </span>
              <button
              type="submit"
              className="inline-flex absolute right-0 h-12 items-center justify-center rounded-md px-5 text-sm font-semibold text-[#0F1020] !bg-[#FA8232] transition"
              style={{ backgroundColor: BRAND.accent }}
              disabled={status === 'loading'}
            >
              {status === 'loading' ? 'Subscribing…' : status === 'success' ? 'Subscribed!' : 'Subscribe'}
            </button>
            </div>
            
          </form>
        </div>
      </div>

      {/* Main footer content */}
      <div className="mx-auto grid max-w-7xl grid-cols-1 bg-[#EFECE0] !text-[#503535] gap-10 px-4 py-12 sm:px-6 md:grid-cols-12">
        {/* Brand and blurb */}
        <div className="md:col-span-4">
          <div className="flex items-center gap-2 max-w-50">
            <img src={logo} alt="Gapa Naija" />
          </div>
          <p className="mt-4 max-w-sm text-sm ">
            Your trusted destination for genuine car parts, expert service, and seamless auto-care. Fast delivery across Nigeria.
          </p>
          <div className="mt-6 flex flex-col gap-3">
            <div className="flex items-center gap-3">
              {/* Social links */}
              {socials.map((s) => (
                <a
                  key={s.label}
                  href={s.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-black/10 text-black hover:bg-black/20"
                  aria-label={s.label}
                  title={s.label}
                >
                  {s.icon}
                </a>
              ))}
            </div>
            {/* App download buttons - black badges side by side */}
            <div className="mt-3 flex items-center gap-2">
              <a
                href="https://apps.apple.com/us/app/gapa-naija/id1606125929"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Download on the App Store"
              >
                <img
                  src="https://developer.apple.com/assets/elements/badges/download-on-the-app-store.svg"
                  alt="Download on the App Store"
                  style={{ height: 40, width: 'auto' }}
                />
              </a>
              <a
                href="https://play.google.com/store/apps/details?id=com.gapa.autoparts"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Get it on Google Play"
              >
                <img
                  src="https://upload.wikimedia.org/wikipedia/commons/7/78/Google_Play_Store_badge_EN.svg"
                  alt="Get it on Google Play"
                  style={{ height: 40, width: 'auto' }}
                />
              </a>
            </div>
          </div>
        </div>

        {/* Link columns */}
        <div className="md:col-span-8 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <div>
            <h4 className="text-sm font-bold tracking-wide ">My Account</h4>
            <ul className="mt-3 space-y-2 text-sm">
              <li><Link className="hover:text-[#FA8232]" to="/account-settings">Account Settings</Link></li>
              <li><Link className="hover:text-[#FA8232]" to="/checkout">My Cart</Link></li>
              <li><Link className="hover:text-[#FA8232]" to="/wishlist">Wishlist</Link></li>
              <li><Link className="hover:text-[#FA8232]" to="/order-history">Order History</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="text-sm font-bold tracking-wide">Services</h4>
            <ul className="mt-3 space-y-2 text-sm">
              <li><Link className="hover:text-[#FA8232]" to="/parts">Car Parts</Link></li>
              <li><Link className="hover:text-[#FA8232]" to="/engine-oil">Engine Oil</Link></li>
              <li><a className="hover:text-[#FA8232]" href="#">Car Care</a></li>
              <li><a className="hover:text-[#FA8232]" href="#">Car Accessories</a></li>
            </ul>
          </div>
          <div>
            <h4 className="text-sm font-bold tracking-wide ">Company</h4>
            <ul className="mt-3 space-y-2 text-sm">
              <li><Link className="hover:text-[#FA8232]" to="/about">About Us</Link></li>
              <li><Link className="hover:text-[#FA8232]" to="/contact">Contact Us</Link></li>
              <li><Link className="hover:text-[#FA8232]" to="/terms">Terms & Conditions</Link></li>
              <li><Link className="hover:text-[#FA8232]" to="/privacy-policy">Privacy Policy</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="text-sm font-bold tracking-wide ">Support</h4>
            <ul className="mt-3 space-y-2 text-sm">
              <li><a className="hover:text-[#FA8232]" href="#">Walk In Store: GAPA Naija. 2402 Shehu Shagari Way, Beside Barlance Garden, Maitama, F.C.T - Abuja</a></li>
              <li><a className="hover:text-[#FA8232]" href="#">Phone: +234 708 888 5268</a></li>
              <li><a className="hover:text-[#FA8232]" href="#">Email: sales@gapaautoparts.com</a></li>
            </ul>
          </div>
          <img src={gigImg} alt="GIG Logistics" className='p-1' />
          
        </div>
      </div>

      {/* Bottom bar */}
      <div className="border-t border-white/10 !text-[#503535]">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-4 py-6 text-sm  sm:flex-row sm:px-6">
          <p>Gapa, 2025 all right reserved</p>
          
        </div>
      </div>
    </footer>
  )
}
