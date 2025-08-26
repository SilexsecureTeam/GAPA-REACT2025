import Header from './components/Header'
import Footer from './components/Footer'
import Home from './pages/Home'
import CarParts from './pages/CarParts'
import AirFresheners from './pages/AirFresheners'
import ProductDetails from './pages/ProductDetails'
import CarPartDetails from './pages/CarPartDetails'
import { Routes, Route } from 'react-router-dom'
import CarPartProduct from './pages/CarPartProduct'
import Tyres from './pages/Tyres'
import EngineOil from './pages/EngineOil'

function App() {
  return (
    <>
      <Header />
      <main className="bg-white pt-30 sm:pt-34">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/parts" element={<CarParts />} />
          <Route path="/tyres" element={<Tyres />} />
          <Route path="/engine-oil" element={<EngineOil />} />
          <Route path="/parts/air-fresheners" element={<AirFresheners />} />
          <Route path="/product/:id" element={<ProductDetails />} />
          {/* Specific product route under parts must come before other dynamic parts routes */}
          <Route path="/parts/product/:slug" element={<CarPartProduct />} />
          <Route path="/parts/:brand/:part" element={<CarPartDetails />} />
          <Route path="/parts/:part" element={<CarPartDetails />} />
        </Routes>
      </main>
      <Footer />
    </>
  )
}

export default App
