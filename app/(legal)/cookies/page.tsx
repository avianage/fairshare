export const metadata = { title: "Cookie Policy — Fairshare" }

export default function CookiesPage() {
  return (
    <article className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-extrabold tracking-tight">Cookie Policy</h1>
        <p className="text-sm text-muted-foreground">Last updated: June 2026</p>
      </div>

      <p className="text-muted-foreground leading-relaxed">
        This Cookie Policy explains how Fairshare uses cookies and similar technologies when you visit or use our service.
      </p>

      <section className="space-y-3">
        <h2 className="text-xl font-bold">1. What Are Cookies?</h2>
        <p className="text-muted-foreground leading-relaxed">
          Cookies are small text files stored on your device by your web browser. They help websites remember information about your visit, such as your login session, to make your experience more consistent and functional.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-bold">2. Cookies We Use</h2>
        <p className="text-muted-foreground leading-relaxed">
          Fairshare uses a minimal set of cookies strictly necessary for the service to function:
        </p>
        <div className="overflow-x-auto rounded-xl border bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="px-4 py-3 font-medium">Cookie</th>
                <th className="px-4 py-3 font-medium">Purpose</th>
                <th className="px-4 py-3 font-medium">Duration</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              <tr>
                <td className="px-4 py-3 font-mono text-xs">next-auth.session-token</td>
                <td className="px-4 py-3 text-muted-foreground">Maintains your authenticated session</td>
                <td className="px-4 py-3 text-muted-foreground">Session / 30 days</td>
              </tr>
              <tr>
                <td className="px-4 py-3 font-mono text-xs">next-auth.csrf-token</td>
                <td className="px-4 py-3 text-muted-foreground">Protects against cross-site request forgery</td>
                <td className="px-4 py-3 text-muted-foreground">Session</td>
              </tr>
              <tr>
                <td className="px-4 py-3 font-mono text-xs">theme</td>
                <td className="px-4 py-3 text-muted-foreground">Stores your light/dark mode preference</td>
                <td className="px-4 py-3 text-muted-foreground">1 year</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-bold">3. Local Storage</h2>
        <p className="text-muted-foreground leading-relaxed">
          In addition to cookies, Fairshare uses browser local storage for lightweight preferences such as whether you have dismissed the push notification prompt. This data never leaves your device and is not transmitted to our servers.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-bold">4. No Third-Party Tracking</h2>
        <p className="text-muted-foreground leading-relaxed">
          Fairshare does not use any third-party analytics, advertising, or tracking cookies. We do not embed third-party trackers or share cookie data with advertisers.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-bold">5. Managing Cookies</h2>
        <p className="text-muted-foreground leading-relaxed">
          You can control and delete cookies through your browser settings. Please note that disabling session cookies will prevent you from logging in. Refer to your browser's help documentation for instructions on managing cookies.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-bold">6. Changes to This Policy</h2>
        <p className="text-muted-foreground leading-relaxed">
          We may update this Cookie Policy as the service evolves. Any changes will be reflected on this page with an updated date.
        </p>
      </section>
    </article>
  )
}
