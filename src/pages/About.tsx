import { Link } from 'react-router-dom'
import aboutHero from '../assets/about.png'
import about1 from '../assets/about1.png'
import about2 from '../assets/about2.png'
import team1 from '../assets/team1.png'
import team2 from '../assets/team2.png'
import team3 from '../assets/team3.png'
import team4 from '../assets/team4.png'

const BRAND = {
  primary: '#5A1E78',
  accent: '#FA8232',
}

export default function About() {
  return (
    <div className="bg-white">
      {/* Hero: Welcome + Mission */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 pt-16 sm:pt-24">
        <div className="grid grid-cols-1 gap-10 md:grid-cols-2 md:items-center">
          <div>
            <img src={aboutHero} alt="Delivery professional in a van writing on clipboard" className="w-full rounded-2xl object-cover shadow-sm" />
          </div>
          <div>
            <h1 className="text-3xl sm:text-4xl font-semibold text-[#0F1020]">Welcome to Gapa Naija</h1>
            <p className="mt-4 text-[#4B5563] leading-7">
              At Gapa Naija, we’re passionate about keeping you on the road with confidence. From genuine car parts to essential tools and accessories, we provide everything you need to maintain, repair, and upgrade your vehicle. Our goal is to make car care simple, affordable, and accessible to every driver.
            </p>
            <h2 className="mt-8 text-2xl font-semibold text-[#0F1020]">Our mission</h2>
            <p className="mt-3 text-[#4B5563] leading-7">
              At Gapa Naija, our mission is to deliver high-quality auto parts and accessories at prices you can trust. We work to exceed customer expectations by offering a wide range of reliable products, fast delivery, and excellent customer support. Your safety and satisfaction are always our priority, and we’re committed to making every shopping experience seamless — from search to checkout.
            </p>
          </div>
        </div>
      </section>

      {/* Our Story with paired images */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 mt-16 sm:mt-24">
        <div className="grid grid-cols-1 gap-10 md:grid-cols-2 md:items-start">
          <div>
            <h3 className="text-2xl sm:text-3xl font-extrabold text-[#0F1020]">Our Story</h3>
            <p className="mt-4 text-[#4B5563] leading-7">
              Founded in 2024, Gapa Naija began with a clear vision: to make high-quality car parts, tools, and accessories accessible and affordable for drivers across Nigeria. What started as a small venture has grown into a trusted auto parts marketplace, helping thousands of car owners and mechanics find the right products with ease.
            </p>
            <Link to="/" className="inline-flex items-center gap-2 mt-6 rounded-md px-5 py-3 text-sm font-semibold text-[#0F1020]" style={{ backgroundColor: BRAND.accent }}>
              Start Shopping
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-4 md:gap-6">
            <img src={about1} alt="Car dashboard and steering" className="col-span-2 md:col-span-1 w-full rounded-xl h-full object-cover" />
            <img src={about2} alt="Happy customer" className="col-span-2 md:col-span-1 w-full rounded-xl object-cover h-full" />
          </div>
        </div>
      </section>

      {/* Why choose us */}
      <section className="mt-16 sm:mt-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="rounded-2xl border border-[#EEE] bg-[#F7F5FB] p-6 sm:p-8 md:p-10">
            <div className="grid grid-cols-1 gap-10 md:grid-cols-2">
              <div>
                <span className="inline-block rounded-full bg-white px-3 py-1 text-xs font-semibold text-[#5A1E78] ring-1 ring-[#E6D9F4]">Why Choose Us</span>
                <h3 className="mt-3 text-2xl sm:text-3xl font-extrabold text-[#0F1020]">Reliable car parts, trusted service, and unbeatable value</h3>
              </div>
              <p className="text-[#4B5563] leading-7">
                At Gapa Naija, we uphold the highest standards of quality across all our auto parts and services. From sourcing and selection to delivery and customer support, every step is guided by strict quality checks to ensure reliability, safety, and satisfaction for our customers.
              </p>
            </div>
            <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {[
                { title: 'Trusted Quality', text: 'We source only genuine and certified car parts, ensuring your vehicle stays safe, efficient, and road-ready.' },
                { title: 'Parts for Every Car', text: 'From brake pads to engine oil, tyres, tools, and accessories, we cover every system of your car with thousands of parts in stock.' },
                { title: 'Affordable Prices', text: 'Get the best deals on high-quality car parts. With fair pricing and regular offers, maintaining your vehicle has never been easier.' },
                { title: 'Expert Support', text: 'Our support team is here to guide you — from choosing the right part for your car model to ensuring quick delivery and after-sales assistance.' },
              ].map((f, i) => (
                <div key={f.title} className="rounded-xl bg-white p-5 shadow-sm">
                  <div className="flex items-center gap-3">
                    <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[#5A1E78]/10 text-[#5A1E78]">
                      {/* simple icon placeholder */}
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>
                    </span>
                    <span className="text-sm font-semibold text-[#0F1020]">{i + 1}. {f.title}</span>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-[#4B5563]">{f.text}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Team */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 mt-16 sm:mt-24">
        <h3 className="text-2xl sm:text-3xl font-extrabold text-[#0F1020]">Meet our team.</h3>
        <p className="mt-2 text-[#4B5563]">The passionate minds and hands driving Gapa Naija’s commitment to quality auto parts and trusted service.</p>
        <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { img: team1, name: 'Chinedu Okafor', role: 'Founder & CEO' },
            { img: team2, name: 'Aisha Bello', role: 'Head of Operations' },
            { img: team3, name: 'Emeka Johnson', role: 'Customer Success Lead' },
            { img: team4, name: 'Grace Adeyemi', role: 'Marketing & Partnerships Manager' },
          ].map((m) => (
            <div key={m.name} className="rounded-2xl border border-[#EEE] bg-white p-3 shadow-sm">
              <img src={m.img} alt={m.name} className="h-52 w-full rounded-xl object-cover" />
              <div className="p-2">
                <div className="font-semibold text-[#0F1020]">{m.name}</div>
                <div className="text-xs text-[#6B7280]">{m.role}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Promo/video */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 mt-12 sm:mt-16 mb-24">
        <div className="relative overflow-hidden rounded-2xl shadow-2xl">
          <video 
            className="w-full h-[360px] sm:h-[480px] object-cover" 
            controls 
            preload="metadata"
            playsInline
          >
            <source src="/about_video.mp4" type="video/mp4" />
            Your browser does not support the video tag.
          </video>
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-black/40 to-transparent opacity-0 hover:opacity-100 transition-opacity duration-300"></div>
        </div>
        
        {/* Video Description */}
        <div className="mt-6 text-center">
          <h4 className="text-2xl sm:text-3xl font-extrabold text-[#0F1020]">Your trusted and reliable Car parts shop</h4>
          <p className="mt-3 text-[#4B5563] max-w-2xl mx-auto leading-7">
            Watch how we deliver quality auto parts and exceptional service to thousands of satisfied customers across Nigeria. From genuine parts to fast delivery, see why Gapa Naija is your best choice for all car maintenance needs.
          </p>
        </div>
      </section>
    </div>
  )
}
