import { Link, useLocation } from 'react-router-dom'
import logo from '../assets/gapa-logo.png'

export default function AuthHeader() {
  const location = useLocation()
  const onLogin = location.pathname === '/login'

  return (
    <header className="sticky top-0 z-40 bg-white/80 backdrop-blur ring-1 ring-black/5">
      <div className="mx-auto max-w-7xl px-4 sm:px-14">
        <div className="flex h-16 items-center justify-between">
          <Link to="/" className="inline-flex items-center gap-2" aria-label="Go to homepage">
            <img src={logo} alt="Gapa Auto Parts" className="h-8" />
          </Link>

          <nav className="flex items-center gap-4">
            {onLogin ? (
              <Link to="/signup" className="text-xs font-medium text-[#5A1E78] hover:underline">
                Create account
              </Link>
            ) : (
              <Link to="/login" className="text-xs font-medium text-[#5A1E78] hover:underline">
                Sign in
              </Link>
            )}
            <Link to="/" className="text-xs text-gray-600 hover:text-[#5A1E78]" aria-label="Back to shopping">
              Back to shopping
            </Link>
          </nav>
        </div>
      </div>
      <div className="h-1 w-full bg-gradient-to-r from-[#5A1E78] via-[#BC81EA] to-[#5A1E78]" />
    </header>
  )
}
