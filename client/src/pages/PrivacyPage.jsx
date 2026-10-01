import Reveal from '../components/Reveal.jsx';
import DeveloperCredit from '../components/DeveloperCredit.jsx';

const LAST_UPDATED = '27 September 2026';

export default function PrivacyPage() {
  return (
    <div className="page">
      <div className="container container--narrow">
        <Reveal>
          <h1 className="page__title">Privacy</h1>
          <p className="page__lead">
            This page describes what the TrueTube service actually does with data. It reflects the current
            implementation rather than an idealised version of it.
          </p>
          <p className="updated">Last updated: {LAST_UPDATED}</p>
        </Reveal>

        <Reveal delay={0.05}>
          <div className="glass-card prose" style={{ marginTop: 32 }}>
            <h2>What is sent to the server</h2>
            <p>
              When you analyze a link, your browser sends the URL text to the TrueTube API. When you start a download,
              it sends the same URL together with the format identifier you selected. TrueTube does not require an
              account, and it never asks for platform credentials, cookies or session tokens.
            </p>

            <h2>Temporary files</h2>
            <p>
              A download is written to an isolated temporary directory on the server, streamed to your browser, and
              then deleted. The directory is removed on success, on failure, on timeout and when you cancel. A periodic
              sweeper deletes any job directory left behind by an interrupted process, together with its contents.
              TrueTube does not keep a copy of your media, and it does not build a library of what you downloaded.
            </p>

            <h2>Server logs</h2>
            <p>
              The server writes operational logs containing timestamps, request paths, HTTP methods, client IP
              addresses, response codes and error codes. Log lines never include your IP in a URL context, credentials
              or cookies; sensitive header names are redacted if they are ever logged. Logs are retained according to
              the configuration of the machine or host running the service, and are not shared with third parties.
            </p>

            <h2>Rate limiting and IP addresses</h2>
            <p>
              To protect the service, requests are rate limited per client IP address. Rate limiting requires the IP
              address to be known, so TrueTube does process it in memory while a request is being handled. If the
              service runs behind a reverse proxy, it uses the forwarded client address only when{' '}
              <code>TRUST_PROXY</code> is enabled by the operator.
            </p>

            <h2>Metadata cache</h2>
            <p>
              Extracted metadata (id, title and the available format identifiers) is held in a short-lived in-memory
              cache for a few minutes so a selected format can be verified before a download starts. The cache is
              process-local, is never written to disk and disappears when the process restarts.
            </p>

            <h2>Cookies, analytics and third parties</h2>
            <p>
              TrueTube sets no cookies and contains no analytics, tracking or advertising scripts. The interface loads
              two external resources that are requested directly by your browser: the Inter and JetBrains Mono web
              fonts from Google Fonts, and remote media thumbnails only when you analyze a link. Media files themselves
              are fetched by the server from the original source, not proxied through a third-party service.
            </p>

            <h2>Data retention</h2>
            <p>
              Beyond the transient handling described above, TrueTube stores no user accounts, no profiles, no
              favourites and no history of analyzed URLs. If you operate your own instance of TrueTube, you are
              responsible for the retention policy of your logs, your host and your backups.
            </p>

            <h2>Contact</h2>
            <p>
              This deployment does not collect personal data for any purpose beyond operating the service. Questions
              about this policy should be directed to the operator of the instance you are using.
            </p>
          </div>
        </Reveal>

        <DeveloperCredit align="start" />
      </div>
    </div>
  );
}
