export const metadata = { title: "Privacy Policy — Fairshare" }

export default function PrivacyPage() {
  return (
    <article className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-extrabold tracking-tight">Privacy Policy</h1>
        <p className="text-sm text-muted-foreground">Last updated: June 2026</p>
      </div>

      <p className="text-muted-foreground leading-relaxed">
        Fairshare is committed to protecting your privacy. This policy explains what data we collect, how we use it, and your rights regarding your personal information.
      </p>

      <section className="space-y-3">
        <h2 className="text-xl font-bold">1. Information We Collect</h2>
        <p className="text-muted-foreground leading-relaxed">
          We collect information you provide directly — such as your name, username, email address, and password when you register. We also collect data you enter while using the service, including expense details, group information, and settlement records.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-bold">2. Automatically Collected Data</h2>
        <p className="text-muted-foreground leading-relaxed">
          We automatically collect certain technical data when you use Fairshare, including your IP address (used for security monitoring and rate limiting), browser type, and access timestamps. This data is stored in our audit log and is used solely for security and operational purposes.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-bold">3. How We Use Your Data</h2>
        <p className="text-muted-foreground leading-relaxed">
          We use your data to provide and improve the Fairshare service — including processing expenses, sending push notifications you opt into, detecting suspicious activity, and communicating account-related information. We do not sell your personal data to third parties.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-bold">4. Push Notifications</h2>
        <p className="text-muted-foreground leading-relaxed">
          If you choose to enable push notifications, we store a push subscription token associated with your account. This token is used exclusively to deliver in-app notifications (such as expense updates and settlement reminders). You can revoke this permission at any time from your profile settings or browser settings.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-bold">5. Data Retention</h2>
        <p className="text-muted-foreground leading-relaxed">
          We retain your data for as long as your account is active. You may request deletion of your account and associated data at any time by contacting us. Some data may be retained for a limited period for legal or security purposes.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-bold">6. Data Security</h2>
        <p className="text-muted-foreground leading-relaxed">
          We use industry-standard security measures including bcrypt password hashing, JWT-based authentication, and HTTPS encryption in transit. Despite these measures, no system is completely secure, and we cannot guarantee absolute security.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-bold">7. Your Rights</h2>
        <p className="text-muted-foreground leading-relaxed">
          You have the right to access, correct, or request deletion of your personal data. You may also object to certain processing or request data portability where applicable. To exercise any of these rights, please contact us through the GitHub repository.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-bold">8. Changes to This Policy</h2>
        <p className="text-muted-foreground leading-relaxed">
          We may update this Privacy Policy periodically. We will notify users of significant changes through the platform. Continued use of Fairshare after changes are posted constitutes acceptance of the updated policy.
        </p>
      </section>
    </article>
  )
}
