import Header from './components/Header'
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
          <Route path="/" element={<Home />} />
          <Route path="/parts" element={<CarParts />} />
          <Route path="/tools" element={<Tools />} />
          <Route path="/brakes" element={<Brakes />} />
          <Route path="/tyres" element={<Tyres />} />
          <Route path="/engine-oil" element={<EngineOil />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<SignUp />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/verify-otp" element={<VerifyOtp />} />
          <Route path="/change-password" element={<ChangePassword />} />
          <Route path="/parts/air-fresheners" element={<AirFresheners />} />
          <Route path="/product/:id" element={<ProductDetails />} />
          {/* Legacy product route: redirect to search-error for now */}
          <Route path="/parts/product/:slug" element={<Navigate to="/search-error" replace />} />
          <Route path="/search-error" element={<SearchError />} />
          <Route path="/parts/:brand/:part" element={<CarPartDetails />} />
          <Route path="/parts/:part" element={<CarPartDetails />} />
          <Route path="/checkout" element={<Checkout />} />
          {/* New static pages */}
          <Route path="/privacy-policy" element={<PrivacyPolicy />} />
          <Route path="/terms" element={<TermsAndConditions />} />
          <Route path="/about" element={<About />} />
          <Route path="/contact" element={<Contact />} />
          {/* Account settings */}
          <Route path="/account-settings" element={<AccountSettings />} />
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
