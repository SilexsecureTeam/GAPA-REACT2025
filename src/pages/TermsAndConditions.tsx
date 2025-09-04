export default function TermsAndConditions() {
  return (
    <div className="bg-white">
      <header className="pt-14">
        <div className="mx-auto max-w-5xl px-4 sm:px-6">
          <h1 className="text-2xl sm:text-3xl !font-semibold text-[#0F1020]">Terms & Conditions</h1>
          {/* <p className="mt-2 text-sm text-gray-600">Please read these terms carefully before using Gapa Auto Parts Services.</p> */}
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-2 sm:px-6">
        <article className="prose prose-sm sm:prose max-w-none text-[#503535] !space-y-3">
          <section>
            <h2>Acceptance of Terms</h2>
            <p>
              By accessing or using the Services, you agree to be bound by these Terms & Conditions and our Privacy
              Policy. If you do not agree, do not use the Services.
            </p>
          </section>

          <section>
            <h2>Accounts</h2>
            <ul>
              <li>You must provide accurate information when creating an account.</li>
              <li>You are responsible for maintaining the confidentiality of your login credentials.</li>
              <li>You agree to notify us immediately of any unauthorized access to your account.</li>
            </ul>
          </section>

          <section>
            <h2>Orders and Payments</h2>
            <ul>
              <li>All orders are subject to acceptance and availability.</li>
              <li>Prices are subject to change without notice.</li>
              <li>We reserve the right to cancel or refuse any order at our discretion.</li>
            </ul>
          </section>

          <section>
            <h2>Returns and Refunds</h2>
            <p>
              Returns are accepted in accordance with our Returns Policy. Items must be unused and in original
              packaging, and a valid receipt is required. Refunds will be issued to the original payment method.
            </p>
          </section>

          <section>
            <h2>Prohibited Activities</h2>
            <ul>
              <li>Using the Services for any unlawful purpose.</li>
              <li>Attempting to interfere with or disrupt the integrity or performance of the Services.</li>
              <li>Infringing upon any intellectual property rights.</li>
            </ul>
          </section>

          <section>
            <h2>Disclaimer of Warranties</h2>
            <p>
              The Services are provided "as is" and "as available" without warranties of any kind, express or implied.
              We do not warrant that the Services will be uninterrupted or error-free.
            </p>
          </section>

          <section>
            <h2>Limitation of Liability</h2>
            <p>
              In no event shall Gapa Auto Parts be liable for any indirect, incidental, or consequential damages arising
              out of your use of the Services.
            </p>
          </section>

          <section>
            <h2>Governing Law</h2>
            <p>
              These Terms are governed by the laws of the Federal Republic of Nigeria, without regard to its conflict of
              law principles.
            </p>
          </section>

          <section>
            <h2>Changes to Terms</h2>
            <p>
              We may update these Terms from time to time. Continued use of the Services constitutes acceptance of the
              updated Terms.
            </p>
          </section>

          <section>
            <h2>Contact</h2>
            <p>
              For questions about these Terms, please contact <a className="text-[#5A1E78]" href="mailto:sales@gapaautoparts.com">sales@gapaautoparts.com</a>.
            </p>
          </section>
        </article>
      </main>
    </div>
  )
}
