export const metadata = { title: "Terms of Service — Fairshare" }

export default function TermsPage() {
  return (
    <article className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-extrabold tracking-tight">Terms of Service</h1>
        <p className="text-sm text-muted-foreground">Last updated: June 2026</p>
      </div>

      <p className="text-muted-foreground leading-relaxed">
        By accessing or using Fairshare, you agree to be bound by these Terms of Service. Please read them carefully before using the platform.
      </p>

      <section className="space-y-3">
        <h2 className="text-xl font-bold">1. Acceptance of Terms</h2>
        <p className="text-muted-foreground leading-relaxed">
          By creating an account or using any feature of Fairshare, you confirm that you are at least 13 years of age and agree to these terms. If you are using Fairshare on behalf of an organization, you represent that you have authority to bind that organization to these terms.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-bold">2. Description of Service</h2>
        <p className="text-muted-foreground leading-relaxed">
          Fairshare is a centralized expense-splitting platform that allows users to track shared expenses within groups or one-on-one, record settlements, and manage personal budgets. The service is provided as-is and is currently in early alpha — features may change without notice.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-bold">3. Account Responsibilities</h2>
        <p className="text-muted-foreground leading-relaxed">
          You are responsible for maintaining the confidentiality of your account credentials. You agree to notify us immediately of any unauthorized use of your account. Fairshare is not liable for any loss resulting from unauthorized access to your account.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-bold">4. Acceptable Use</h2>
        <p className="text-muted-foreground leading-relaxed">
          You agree not to use Fairshare to engage in fraudulent activity, harass other users, attempt to gain unauthorized access to any part of the platform, or violate any applicable laws or regulations. Fairshare reserves the right to suspend or terminate accounts that violate these terms.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-bold">5. Data and Privacy</h2>
        <p className="text-muted-foreground leading-relaxed">
          Your use of Fairshare is also governed by our <a href="/privacy" className="text-primary underline underline-offset-4 hover:text-primary/80">Privacy Policy</a>. By using the service, you consent to the collection and use of your data as described therein.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-bold">6. Intellectual Property</h2>
        <p className="text-muted-foreground leading-relaxed">
          Fairshare is open-source software. The source code is available under its respective license. However, the Fairshare name, logo, and branding are proprietary and may not be used without explicit written permission.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-bold">7. Limitation of Liability</h2>
        <p className="text-muted-foreground leading-relaxed">
          Fairshare is provided on an "as is" basis without warranties of any kind. We are not liable for any indirect, incidental, or consequential damages arising from your use of the service, including any loss of data or financial loss resulting from reliance on information displayed in the app.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-bold">8. Changes to Terms</h2>
        <p className="text-muted-foreground leading-relaxed">
          We may update these terms from time to time. Continued use of Fairshare after changes are posted constitutes acceptance of the revised terms. We will endeavour to notify users of significant changes via the platform.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-bold">9. Contact</h2>
        <p className="text-muted-foreground leading-relaxed">
          If you have questions about these terms, please reach out via the GitHub repository or the contact information provided on the site.
        </p>
      </section>
    </article>
  )
}
