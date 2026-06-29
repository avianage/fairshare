export const metadata = { title: "Community Guidelines — Fairshare" }

export default function GuidelinesPage() {
  return (
    <article className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-extrabold tracking-tight">Community Guidelines</h1>
        <p className="text-sm text-muted-foreground">Last updated: June 2026</p>
      </div>

      <p className="text-muted-foreground leading-relaxed">
        Fairshare is built around trust — trust between friends, flatmates, and travel companions. These guidelines exist to keep that trust intact. We expect all users to follow them.
      </p>

      <section className="space-y-3">
        <h2 className="text-xl font-bold">1. Be Honest</h2>
        <p className="text-muted-foreground leading-relaxed">
          Only add expenses that genuinely occurred. Do not fabricate or inflate expenses to collect money from others. Fairshare is a tool built on good faith — misusing it to defraud other users is a violation of these guidelines and may result in account termination.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-bold">2. Respect Other Users</h2>
        <p className="text-muted-foreground leading-relaxed">
          Treat other users with respect. Do not use Fairshare to harass, threaten, or intimidate anyone. Group names, expense descriptions, and any other user-generated content must not contain hate speech, slurs, or content intended to demean others.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-bold">3. Protect Others' Privacy</h2>
        <p className="text-muted-foreground leading-relaxed">
          Do not share other users' personal information — including email addresses, phone numbers, or financial details — outside of Fairshare without their consent. Invite links are for personal use and should not be distributed publicly.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-bold">4. No Abuse of the Platform</h2>
        <p className="text-muted-foreground leading-relaxed">
          Do not attempt to circumvent security measures, exploit bugs, or gain unauthorized access to other accounts or data. Any vulnerabilities discovered should be responsibly disclosed via our GitHub repository rather than exploited.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-bold">5. One Account Per Person</h2>
        <p className="text-muted-foreground leading-relaxed">
          Each person should maintain a single account. Creating multiple accounts to evade bans or manipulate group balances is prohibited.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-bold">6. Settle Fairly</h2>
        <p className="text-muted-foreground leading-relaxed">
          While Fairshare cannot enforce real-world payments, we encourage all users to settle debts promptly and honestly. Deliberately refusing to acknowledge debts or marking settlements as complete without actual payment undermines the purpose of the app.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-bold">7. Reporting Issues</h2>
        <p className="text-muted-foreground leading-relaxed">
          If you encounter behavior that violates these guidelines or a bug that could affect other users, please report it through the GitHub repository. We review all reports and take appropriate action.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-bold">8. Enforcement</h2>
        <p className="text-muted-foreground leading-relaxed">
          Violations of these guidelines may result in warnings, temporary suspension, or permanent account termination at our discretion. We aim to be fair but reserve the right to act quickly when user safety or platform integrity is at risk.
        </p>
      </section>
    </article>
  )
}
