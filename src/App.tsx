import Header from './components/Header'
import Footer from './components/Footer'
import Home from './pages/Home'
import CarParts from './pages/CarParts'
import AirFresheners from './pages/AirFresheners'
import ProductDetails from './pages/ProductDetails'
import CarPartDetails from './pages/CarPartDetails'
import { Routes, Route, useLocation, Navigate } from 'react-router-dom'
import SearchError from './pages/SearchError'
import Tyres from './pages/Tyres'
import EngineOil from './pages/EngineOil'
import Login from './pages/Login'
import SignUp from './pages/SignUp'
import AuthHeader from './components/AuthHeader'
import { Toaster } from 'react-hot-toast'
import Profile from './pages/Profile'
import ForgotPassword from './pages/ForgotPassword'
import ResetPassword from './pages/ResetPassword'
import VerifyOtp from './pages/VerifyOtp'
import ChangePassword from './pages/ChangePassword'

function App() {
  const location = useLocation()
  const onAuth = ['/login', '/signup', '/forgot-password', '/reset-password', '/verify-otp', '/change-password'].includes(location.pathname)

  return (
    <>
      {onAuth ? <AuthHeader /> : <Header />}
      <main className={`bg-white ${onAuth ? 'pt-0' : 'pt-30 sm:pt-34'}`}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/parts" element={<CarParts />} />
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
        </Routes>
      </main>
      {onAuth ? '' : <Footer />}
      <Toaster position="top-right" toastOptions={{ duration: 4000 }} />
    </>
  )
}

export default App
