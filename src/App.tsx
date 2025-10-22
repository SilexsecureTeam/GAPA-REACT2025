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

function App() {
  const location = useLocation()
  const navigate = useNavigate()
  const onAuth = ['/login', '/signup', '/forgot-password', '/reset-password', '/verify-otp', '/change-password'].includes(location.pathname)

  // Global cart popup state controlled via URL hash (#cart)
  const [cartOpen, setCartOpen] = useState(false)
  const [cartRefreshKey, setCartRefreshKey] = useState(0)

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
    </>
  )
}

export default App
