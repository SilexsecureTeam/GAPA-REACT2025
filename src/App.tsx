import Header from './components/Header'
import PageTitle from './components/PageTitle'
import Footer from './components/Footer'
import Home from './pages/Home'
import CarParts from './pages/CarParts'
import AirFresheners from './pages/AirFresheners'
import ProductDetails from './pages/ProductDetails'
import CarPartDetails from './pages/CarPartDetails'
import { Routes, Route, useLocation, Navigate, useNavigate } from 'react-router-dom'
import SearchError from './pages/SearchError'
import Tyres from './pages/Tyres'
import EngineOil from './pages/EngineOil'
import Login from './pages/Login'
import SignUp from './pages/SignUp'
// import AuthHeader from './components/AuthHeader'
import Profile from './pages/Profile'
import ForgotPassword from './pages/ForgotPassword'
import ResetPassword from './pages/ResetPassword'
import VerifyOtp from './pages/VerifyOtp'
import ChangePassword from './pages/ChangePassword'
import Tools from './pages/Tools'
import Brakes from './pages/Brakes'
import Checkout from './pages/Checkout'
import { useEffect, useState } from 'react'
import CartPopup from './components/CartPopup'
import PrivacyPolicy from './pages/PrivacyPolicy'
import TermsAndConditions from './pages/TermsAndConditions'
import AccountSettings from './pages/AccountSettings'
import About from './pages/About'
import Contact from './pages/Contact'
import GapaToaster from './components/GapaToaster'
import OrderSuccess from './pages/OrderSuccess'
import OrderHistory from './pages/OrderHistory'
import Wishlist from './pages/Wishlist'
import { warmupCache } from './services/api'

function App() {
  const location = useLocation()
  const navigate = useNavigate()
  const onAuth = ['/login', '/signup', '/forgot-password', '/reset-password', '/verify-otp', '/change-password'].includes(location.pathname)

  // Global cart popup state controlled via URL hash (#cart)
  const [cartOpen, setCartOpen] = useState(false)
  const [cartRefreshKey, setCartRefreshKey] = useState(0)

  useEffect(() => {
    warmupCache()
  }, [])

  useEffect(() => {
    if (location.hash === '#cart') {
      setCartOpen(true)
      // bump refresh to re-fetch items whenever #cart is revisited
      setCartRefreshKey((k) => k + 1)
    }
  }, [location.hash])

  useEffect(() => {
    // Skip auto scroll when merely opening cart popup via hash
    if (location.hash === '#cart') return
    // Defer to next frame for smoother transition after route mount
    requestAnimationFrame(() => {
      try { window.scrollTo({ top: 0, left: 0, behavior: 'instant' as ScrollBehavior }) } catch { window.scrollTo(0,0) }
    })
  }, [location.pathname, location.search])

  const handleCloseCart = () => {
    setCartOpen(false)
    // remove hash cleanly while preserving path + search
    navigate({ pathname: location.pathname, search: location.search, hash: '' }, { replace: true })
  }

  const handleProceedToCheckout = () => {
    setCartOpen(false)
    navigate('/checkout')
  }

  const handleViewCart = () => {
    setCartOpen(false)
    navigate('/checkout')
  }

  return (
    <>
      {/* Header */}
      {onAuth ? <Header /> : <Header />}
      <main className={`bg-white ${onAuth ? 'pt-30 sm:pt-34' : 'pt-30 sm:pt-34'}`}>
        <Routes>
          <Route path="/" element={<><PageTitle title="GAPA Naija - Genuine Auto Parts" /><Home /></>} />
          <Route path="/parts" element={<><PageTitle title="Car Parts - GAPA Naija" /><CarParts /></>} />
          <Route path="/tools" element={<><PageTitle title="Tools - GAPA Naija" /><Tools /></>} />
          <Route path="/brakes" element={<><PageTitle title="Brakes - GAPA Naija" /><Brakes /></>} />
          <Route path="/tyres" element={<><PageTitle title="Tyres - GAPA Naija" /><Tyres /></>} />
          <Route path="/engine-oil" element={<><PageTitle title="Engine Oil - GAPA Naija" /><EngineOil /></>} />
          <Route path="/login" element={<><PageTitle title="Login - GAPA Naija" /><Login /></>} />
          <Route path="/signup" element={<><PageTitle title="Sign Up - GAPA Naija" /><SignUp /></>} />
          <Route path="/profile" element={<><PageTitle title="Profile - GAPA Naija" /><Profile /></>} />
          <Route path="/forgot-password" element={<><PageTitle title="Forgot Password - GAPA Naija" /><ForgotPassword /></>} />
          <Route path="/reset-password" element={<><PageTitle title="Reset Password - GAPA Naija" /><ResetPassword /></>} />
          <Route path="/verify-otp" element={<><PageTitle title="Verify OTP - GAPA Naija" /><VerifyOtp /></>} />
          <Route path="/change-password" element={<><PageTitle title="Change Password - GAPA Naija" /><ChangePassword /></>} />
          <Route path="/parts/air-fresheners" element={<><PageTitle title="Air Fresheners - GAPA Naija" /><AirFresheners /></>} />
          <Route path="/product/:id" element={<><PageTitle title="Product Details - GAPA Naija" /><ProductDetails /></>} />
          {/* Legacy product route: redirect to search-error for now */}
          <Route path="/parts/product/:slug" element={<Navigate to="/search-error" replace />} />
          <Route path="/search-error" element={<><PageTitle title="Not Found - GAPA Naija" /><SearchError /></>} />
          <Route path="/parts/:brand/:part" element={<><PageTitle title="Car Part Details - GAPA Naija" /><CarPartDetails /></>} />
          <Route path="/parts/:part" element={<><PageTitle title="Car Part Details - GAPA Naija" /><CarPartDetails /></>} />
          <Route path="/checkout" element={<><PageTitle title="Checkout - GAPA Naija" /><Checkout /></>} />
          <Route path="/order-success" element={<><PageTitle title="Order Success - GAPA Naija" /><OrderSuccess /></>} />
          <Route path="/order-history" element={<><PageTitle title="Order History - GAPA Naija" /><OrderHistory /></>} />
          <Route path="/wishlist" element={<><PageTitle title="Wishlist - GAPA Naija" /><Wishlist /></>} />
          {/* New static pages */}
          <Route path="/privacy-policy" element={<><PageTitle title="Privacy Policy - GAPA Naija" /><PrivacyPolicy /></>} />
          <Route path="/terms" element={<><PageTitle title="Terms & Conditions - GAPA Naija" /><TermsAndConditions /></>} />
          <Route path="/about" element={<><PageTitle title="About Us - GAPA Naija" /><About /></>} />
          <Route path="/contact" element={<><PageTitle title="Contact - GAPA Naija" /><Contact /></>} />
          {/* Account settings */}
          <Route path="/account-settings" element={<><PageTitle title="Account Settings - GAPA Naija" /><AccountSettings /></>} />
        </Routes>
      </main>
      {onAuth ? <Footer /> : <Footer />}
      <GapaToaster />
      {/* Global Cart Popup */}
      <CartPopup
        open={cartOpen}
        onClose={handleCloseCart}
        onProceed={handleProceedToCheckout}
        onViewCart={handleViewCart}
        refreshKey={cartRefreshKey}
      />

      {/* Floating WhatsApp Button */}
      <a
        href="https://wa.me/+2347088885268"
        target="_blank"
        rel="noopener noreferrer"
        className="fixed bottom-6 right-6 z-50 flex items-center justify-center w-14 h-14 bg-[#25D366] text-white rounded-full shadow-lg hover:bg-[#1ebd5b] transition-transform hover:scale-110 duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#25D366]"
        aria-label="Chat with us on WhatsApp"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="currentColor"
          viewBox="0 0 24 24"
          className="w-8 h-8"
        >
          <path d="M12.031 0C5.385 0 0 5.385 0 12.031c0 2.115.552 4.148 1.6 5.961L.226 23.633l5.772-1.516c1.748.955 3.693 1.458 5.706 1.458h.008c6.646 0 12.031-5.386 12.031-12.032C23.743 5.385 18.677 0 12.031 0zm0 21.564c-1.803 0-3.57-.484-5.116-1.4l-.367-.217-3.804.997.997-3.804-.217-.367c-.915-1.545-1.4-3.312-1.4-5.115 0-5.545 4.512-10.057 10.057-10.057 5.546 0 10.057 4.512 10.057 10.057 0 5.545-4.512 10.057-10.057 10.057zm5.518-7.551c-.302-.151-1.785-.882-2.062-.983-.277-.101-.48-.151-.682.151-.202.302-.782.983-.958 1.185-.176.201-.353.226-.655.075-1.29-.64-2.58-1.517-3.483-2.65-.23-.292.112-.27.4-.853.076-.151.038-.282-.019-.408-.057-.126-.682-1.644-.934-2.253-.245-.592-.495-.512-.682-.522-.176-.008-.378-.01-.58-.01-.202 0-.53.076-.807.378-.277.302-1.058 1.034-1.058 2.52 0 1.486 1.084 2.922 1.235 3.123.151.201 2.128 3.251 5.156 4.555 2.064.888 2.857.942 3.864.791.848-.127 2.062-.843 2.352-1.657.29-.814.29-1.511.203-1.657-.087-.146-.314-.234-.616-.385z" />
        </svg>
      </a>
    </>
  )
}

export default App
