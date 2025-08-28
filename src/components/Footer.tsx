import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'
import logo from '../assets/gapa-logo.png'

const BRAND = {
  primary: '#5A1E78',
  accent: '#BC81EA',
}

export default function Footer() {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setStatus('error')
      return
    }
    setStatus('loading')
    try {
      // TODO: Integrate with real API. Simulate success for now.
      await new Promise((r) => setTimeout(r, 800))
      setStatus('success')
      setEmail('')
      setTimeout(() => setStatus('idle'), 1500)
    } catch {
      setStatus('error')
    }
  }

  return (
    <footer className="bg-[#EFECE0] text-white">
      {/* Newsletter strip */}
      <div className="border-b border-white/15 bg-gradient-to-r from-[#5A1E78] to-[#BC81EA]">
        <div className="mx-auto grid md:max-w-2xl grid-cols-1 items-center gap-6 px-4 py-10 sm:grid-cols-1 sm:px-6">
          <div className='text-center'>
            <h3 className="text-2xl font-semibold tracking-tight">Subscribe to our newsletter</h3>
            <p className="mt-2 text-xs max-w-[80%] mx-auto text-white/70">Praesent fringilla erat a lacinia egestas. Donec vehicula tempor libero et cursus. Donec non quam urna. Quisque vitae porta ipsum.</p>
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
            <img src={logo} alt="" />
          </div>
          <p className="mt-4 max-w-sm text-sm ">
            Your trusted destination for genuine car parts, expert service, and seamless auto-care. Fast delivery across Nigeria.
          </p>
          <div className="mt-6 flex items-center gap-3">
            {[
              { label: 'Facebook', href: '#', icon: (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" ><path d="M22 12a10 10 0 1 0-11.5 9.9v-7h-2v-3h2v-2.3c0-2 1.2-3.1 3-3.1.9 0 1.8.1 1.8.1v2h-1c-1 0-1.3.6-1.3 1.2V12h2.3l-.4 3h-1.9v7A10 10 0 0 0 22 12"/></svg>
              )},
              { label: 'Twitter', href: '#', icon: (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" ><path d="M22 5.9c-.7.3-1.5.5-2.3.6a4 4 0 0 0 1.7-2.2 8.1 8.1 0 0 1-2.5 1 4 4 0 0 0-6.9 3.6A11.4 11.4 0 0 1 3 4.8a4 4 0 0 0 1.2 5.3c-.6 0-1.2-.2-1.7-.5a4 4 0 0 0 3.2 3.9 4 4 0 0 1-1.7.1 4 4 0 0 0 3.7 2.8A8 8 0 0 1 2 18.6a11.4 11.4 0 0 0 6.2 1.8c7.5 0 11.7-6.3 11.7-11.7v-.5c.8-.5 1.5-1.2 2.1-2z"/></svg>
              )},
              { label: 'Instagram', href: '#', icon: (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" ><path d="M7 2h10a5 5 0 0 1 5 5v10a5 5 0 0 1-5 5H7a5 5 0 0 1-5-5V7a5 5 0 0 1 5-5zm5 6.5A4.5 4.5 0 1 0 16.5 13 4.5 4.5 0 0 0 12 8.5zM18 6.2a1.2 1.2 0 1 0 1.2 1.2A1.2 1.2 0 0 0 18 6.2z"/></svg>
              )},
              { label: 'LinkedIn', href: '#', icon: (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" ><path d="M6.94 6.94A2.06 2.06 0 1 1 4.88 4.9a2.06 2.06 0 0 1 2.06 2.05zM4.75 8.75h4.25v10.5H4.75zM14 8.75a5.25 5.25 0 0 1 5.25 5.25v5.25H15v-5.25a1.25 1.25 0 0 0-2.5 0v5.25H8.75V8.75H12c.7 0 1.34.32 1.75.83.69-.52 1.54-.83 2.25-.83z"/></svg>
              )},
            ].map((s) => (
              <a key={s.label} aria-label={s.label} href={s.href} className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/5 ring-1 ring-white/10 transition hover:bg-white/10">
                {s.icon}
              </a>
            ))}
          </div>
        </div>

        {/* Link columns */}
        <div className="md:col-span-8 grid grid-cols-2 gap-8 sm:grid-cols-3">
          <div>
            <h4 className="text-sm font-bold tracking-wide ">Gapa Naija</h4>
            <ul className="mt-3 space-y-2 text-sm">
              <li><a className="hover:text-white" href="#">Car Brands</a></li>
              <li><a className="hover:text-white" href="#">Car Parts</a></li>
              <li><a className="hover:text-white" href="#">Tyres</a></li>
              <li><a className="hover:text-white" href="#">Accessories</a></li>
              <li><a className="hover:text-white" href="#">Engine Oil</a></li>
            </ul>
          </div>
          <div>
            <h4 className="text-sm font-bold tracking-wide">Services</h4>
            <ul className="mt-3 space-y-2 text-sm">
              <li><a className="hover:text-white" href="#">Help Center</a></li>
              <li><a className="hover:text-white" href="#">Returns & Refunds</a></li>
              <li><a className="hover:text-white" href="#">Shipping</a></li>
              <li><a className="hover:text-white" href="#">Contact</a></li>
              <li><a className="hover:text-white" href="#">Privacy Policy</a></li>
              <li><a className="hover:text-white" href="#">Terms of Service</a></li>
            </ul>
          </div>
          <div>
            <h4 className="text-sm font-bold tracking-wide ">Company</h4>
            <ul className="mt-3 space-y-2 text-sm">
              <li><a className="hover:text-white" href="#">About Us</a></li>
              <li><a className="hover:text-white" href="#">Contact Us</a></li>
              <li><a className="hover:text-white" href="#">Terms & Policies</a></li>
              <li><a className="hover:text-white" href="#">How it Works</a></li>
            </ul>
          </div>
          
        </div>
      </div>

      {/* Bottom bar */}
      <div className="border-t border-white/10 !text-[#503535]">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-4 py-6 text-sm  sm:flex-row sm:px-6">
          <p>Gapa, {new Date().getFullYear()} all rights reserved</p>
          <div className="flex items-center gap-4">
            <Link to="/login" className="text-gray-700 hover:text-brand">Sign in</Link>
            <Link to="/signup" className="text-gray-700 hover:text-brand">Create account</Link>
            <a href="#privacy" className="text-gray-700 hover:text-brand">Privacy</a>
            <a href="#terms" className="text-gray-700 hover:text-brand">Terms</a>
          </div>
        </div>
      </div>
    </footer>
  )
}
