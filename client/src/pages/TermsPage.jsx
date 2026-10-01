import Reveal from '../components/Reveal.jsx';
import DeveloperCredit from '../components/DeveloperCredit.jsx';

const LAST_UPDATED = '27 September 2026';

export default function TermsPage() {
  return (
    <div className="page">
      <div className="container container--narrow">
        <Reveal>
          <h1 className="page__title">Terms of use</h1>
          <p className="page__lead">
            These terms describe the acceptable use of this TrueTube instance. By using the service you agree to them.
          </p>
          <p className="updated">Last updated: {LAST_UPDATED}</p>
        </Reveal>

        <Reveal delay={0.05}>
          <div className="glass-card prose" style={{ marginTop: 32 }}>
            <h2>1. What the service does</h2>
            <p>
              TrueTube analyses URLs that you submit, using a server-side installation of yt-dlp, and streams media
              that the source makes publicly available. It is a general-purpose utility. It is not affiliated with,
              endorsed by, or operated on behalf of any platform whose content it processes.
            </p>

            <h2>2. Your responsibilities</h2>
            <p>You are responsible for every request you send to the service. In particular, you must:</p>
            <ul>
              <li>only download content you own, have permission to download, or that the relevant platform allows you to download;</li>
              <li>comply with copyright law in your jurisdiction;</li>
              <li>comply with the terms of the platform hosting the media;</li>
              <li>not use the service to infringe copyright, to circumvent access controls, or to distribute material unlawfully.</li>
            </ul>

            <h2>3. Prohibited access</h2>
            <p>
              TrueTube is designed so that protected content cannot be reached through it. The service does not accept
              credentials, cookies, session tokens or netrc data, and it refuses to process private, unlisted,
              members-only, sign-in-gated, age-restricted and DRM-protected media. Attempts to use the service to reach
              such content, to bypass paywalls, or to attack, overload or probe the infrastructure are prohibited and
              may be rate limited or blocked.
            </p>

            <h2>4. Fair use and limits</h2>
            <p>
              Analysis and download endpoints are rate limited per client address. Exceeding a limit returns HTTP 429.
              Automated or bulk use of the service is not permitted without the operator's written agreement. The
              operator may change or withdraw limits at any time.
            </p>

            <h2>5. Availability</h2>
            <p>
              The service is provided on an &ldquo;as is&rdquo; and &ldquo;as available&rdquo; basis, with no guarantee of
              uptime. Availability depends on the installed yt-dlp and FFmpeg binaries, on the upstream platforms, and
              on their own rate limits and changes. Support for any particular link can change at any time, and a
              previously working link can start failing without notice.
            </p>

            <h2>6. Third-party platforms</h2>
            <p>
              Media is retrieved from third-party services whose terms, availability and behaviour TrueTube does not
              control. Links to original pages are provided so that you can verify provenance and licensing before
              using any file.
            </p>

            <h2>7. No warranty</h2>
            <p>
              TrueTube makes no warranty about the accuracy, completeness, legality or fitness for a particular
              purpose of any media it returns. Results depend entirely on what the source reports and on third-party
              software.
            </p>

            <h2>8. Limitation of liability</h2>
            <p>
              To the maximum extent permitted by law, the operator of this instance is not liable for any indirect,
              incidental, special or consequential damages arising from your use of the service, including any claim
              arising from copyright infringement or from reliance on media obtained through it.
            </p>

            <h2>9. Changes</h2>
            <p>
              These terms may be updated as the service changes. Continued use after an update constitutes acceptance of
              the revised terms.
            </p>
          </div>
        </Reveal>

        <DeveloperCredit align="start" />
      </div>
    </div>
  );
}
