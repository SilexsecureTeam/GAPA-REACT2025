import { Link } from 'react-router-dom'

export default function PrivacyPolicy() {
  return (
    <div className="bg-white">
      <header className="pt-14">
        <div className="mx-auto max-w-5xl px-4 sm:px-6">
          <h1 className="text-2xl sm:text-3xl !font-semibold text-[#0F1020]">Privacy Policy</h1>
          {/* <p className="mt-2 text-sm text-gray-600">Your privacy matters to us. Learn how we collect, use, and protect your information.</p> */}
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-2 sm:px-6">
        <article className="prose prose-sm sm:prose max-w-none text-[#503535] !space-y-3">
          <section>
            <h2>Overview</h2>
            <p>
              This Privacy Policy describes how Gapa Auto Parts ("Gapa", "we", "us") collects, uses, and shares your
              personal information when you use our website, mobile applications, and related services (collectively, the
              "Services"). By using our Services, you agree to the terms of this policy.
            </p>
          </section>

          <section>
            <h2>Information We Collect</h2>
            <ul>
              <li>Account details such as name, email address, phone number, and delivery addresses.</li>
              <li>Order and payment details necessary to process your purchases.</li>
              <li>Device and usage data such as IP address, browser type, and pages visited.</li>
              <li>Communication preferences and interactions with our support team.</li>
            </ul>
          </section>

          <section>
            <h2>How We Use Your Information</h2>
            <ul>
              <li>To create and maintain your account and authenticate your access.</li>
              <li>To process orders, deliveries, returns, and customer support requests.</li>
              <li>To personalize your shopping experience and improve our Services.</li>
              <li>To send important updates, promotional messages, and service notifications.</li>
            </ul>
          </section>

          <section>
            <h2>Sharing and Disclosure</h2>
            <p>
              We may share your information with trusted service providers who help us operate our business (e.g.,
              payment processors, logistics partners). We require such parties to protect your data and use it only for
              the purposes we specify. We may also share information to comply with legal obligations or to protect our
              rights.
            </p>
          </section>

          <section>
            <h2>Data Security</h2>
            <p>
              We implement administrative, technical, and physical safeguards designed to protect your personal
              information. However, no method of transmission over the Internet is 100% secure, and we cannot guarantee
              absolute security.
            </p>
          </section>

          <section>
            <h2>Your Choices</h2>
            <ul>
              <li>Access and update your profile details in the <Link className="text-[#5A1E78]" to="/account-settings">Account Settings</Link>.</li>
              <li>Opt out of marketing emails by using the unsubscribe links or updating your preferences.</li>
              <li>Request deletion of your data by contacting our support team.</li>
            </ul>
          </section>

          <section>
            <h2>Cookies</h2>
            <p>
              We use cookies and similar technologies to keep you signed in, remember your preferences, and analyze site
              traffic. You can control cookies through your browser settings. Some features may not function properly
              without cookies.
            </p>
          </section>

          <section>
            <h2>Changes to This Policy</h2>
            <p>
              We may update this policy from time to time. If we make material changes, we will notify you by updating
              the date at the top of this page and, where appropriate, through additional notice in the Services.
            </p>
          </section>

          <section>
            <h2>Contact Us</h2>
            <p>
              Questions about this policy? Contact us at <a className="text-[#5A1E78]" href="mailto:sales@gapaautoparts.com">sales@gapaautoparts.com</a>.
            </p>
          </section>
        </article>
      </main>
    </div>
  )
}
