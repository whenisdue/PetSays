import { PublicSiteFooter, PublicSiteHeader } from './components/PublicSiteChrome'

export type LegalPage = 'privacy' | 'terms'

const contactAddress = 'petsays.app@gmail.com'

function PrivacyPolicy() {
  return (
    <article className="legal-document">
      <section>
        <h2>Photos you choose</h2>
        <p>
          When you choose a pet photo, the current PetSays implementation handles it in your browser. The editor uses the photo for the local canvas editor and browser-based pet detection, then creates the exported image in the browser. Based on the current implementation, we did not find an application-level path that uploads or stores the selected photo on PetSays servers.
        </p>
        <p>
          Downloading or sharing an image uses your browser or device. The current export flow does not send the downloaded image back to PetSays through an application upload.
        </p>
      </section>

      <section>
        <h2>Browser storage</h2>
        <p>
          PetSays may temporarily use browser session storage to remember a selected thought-bubble line while you move from the ideas page to the editor. This small handoff includes the line and its vibe, not the uploaded photo, and is cleared after a valid photo handoff is handled. If browser storage is blocked or unavailable, the normal homepage flow still remains available.
        </p>
      </section>

      <section>
        <h2>Information collected automatically</h2>
        <p>
          When you request a website, ordinary technical request information may be visible to hosting and other infrastructure, such as the requested URL, browser, device, timing, or network information. We do not promise that those infrastructure providers keep no logs or use the same retention practices as PetSays.
        </p>
      </section>

      <section>
        <h2>Cookies and analytics</h2>
        <p>
          PetSays currently does not include app-level analytics, advertising trackers, tracking pixels, or non-essential cookie code in the implementation reviewed for this policy. This does not override technical mechanisms used by your browser, hosting provider, or other services involved in loading a website.
        </p>
      </section>

      <section>
        <h2>Third-party services</h2>
        <p>
          PetSays is hosted on Vercel. The editor also uses browser-delivered TensorFlow and Coco-SSD runtime assets for on-device pet detection. Your browser may fetch those runtime or model assets, along with ordinary site assets. Provider-side request handling and retention are infrastructure matters that are not fully determined by the PetSays application code.
        </p>
      </section>

      <section>
        <h2>Accounts and email</h2>
        <p>
          PetSays currently has no user accounts, profiles, or sign-in flow, and the tool does not require an email address. If you email us, your message and email address are handled as part of that email exchange.
        </p>
      </section>

      <section>
        <h2>Children</h2>
        <p>
          PetSays is a general-audience playful tool, not a service designed to collect information from children. We do not knowingly ask children to create accounts or submit profile information.
        </p>
      </section>

      <section>
        <h2>Changes to this policy</h2>
        <p>
          We may update this page if PetSays changes how it handles information. For example, adding analytics, advertising, accounts, server-side photo processing, storage, or forms would require another privacy review.
        </p>
      </section>

      <section className="legal-contact">
        <h2>Contact</h2>
        <p>
          Privacy questions can be sent to <a href={`mailto:${contactAddress}`}>{contactAddress}</a>.
        </p>
      </section>
    </article>
  )
}

function TermsOfUse() {
  return (
    <article className="legal-document">
      <section>
        <h2>Using PetSays</h2>
        <p>
          PetSays is a free browser-based tool for adding funny, fictional thought bubbles to pet photos. By using the service, you agree to use it in line with these terms. If you do not agree, please do not use PetSays.
        </p>
      </section>

      <section>
        <h2>Your photos and content</h2>
        <p>
          You are responsible for the photos and other content you choose to use, including having permission to use them. You keep the ownership rights you already have in your photos and content; PetSays does not claim ownership of your photos. Based on the current implementation, selected photos are handled in the browser and we did not find an application-level path that uploads them to PetSays servers.
        </p>
      </section>

      <section>
        <h2>Fictional thought-bubble lines</h2>
        <p>
          PetSays lines are made up for entertainment. They are not interpretations of an animal’s actual thoughts, health, mood, or behavior, and they are not medical or behavioral advice. Suggested lines are not promised to be exclusive or unique.
        </p>
      </section>

      <section>
        <h2>Acceptable use</h2>
        <p>Please do not use PetSays:</p>
        <ul>
          <li>unlawfully or to violate someone else’s rights;</li>
          <li>with images you do not have permission to use; or</li>
          <li>to abuse, overload, disrupt, or interfere with the service.</li>
        </ul>
      </section>

      <section>
        <h2>Service availability</h2>
        <p>
          PetSays may change, be interrupted, or be discontinued. We do not promise that the service will always be available or uninterrupted.
        </p>
      </section>

      <section>
        <h2>Intellectual property</h2>
        <p>
          PetSays retains its rights in the PetSays name, software, design, page copy, and materials it provides. These terms do not transfer those rights to you, and they do not take away rights you have in your own photos or content.
        </p>
      </section>

      <section>
        <h2>Disclaimer and limitation</h2>
        <p>
          To the extent permitted by law, PetSays is provided on an “as available” basis without a promise that it will be error-free, uninterrupted, or suitable for every purpose. Nothing in these terms limits rights or remedies that cannot legally be limited.
        </p>
      </section>

      <section>
        <h2>Changes to these terms</h2>
        <p>
          We may update these terms when the service or its practices change. The updated version will be posted on this page.
        </p>
      </section>

      <section className="legal-contact">
        <h2>Contact</h2>
        <p>
          Questions about these terms can be sent to <a href={`mailto:${contactAddress}`}>{contactAddress}</a>.
        </p>
      </section>
    </article>
  )
}

export function LegalPageApp({ page }: { page: LegalPage }) {
  const isPrivacy = page === 'privacy'

  return (
    <div className="app-shell legal-page">
      <PublicSiteHeader />

      <main className="legal-main">
        <header className="legal-page-header">
          <p className="eyebrow">{isPrivacy ? 'Privacy at PetSays' : 'Using PetSays'}</p>
          <h1>{isPrivacy ? 'Privacy Policy' : 'Terms of Use'}</h1>
          <p className="legal-intro">
            {isPrivacy
              ? 'PetSays is a small browser-based tool for turning pet photos into funny thought-bubble images. This page explains what information PetSays handles when you use the site.'
              : 'PetSays is a small browser-based tool for turning pet photos into funny thought-bubble images. These simple terms explain how to use it.'}
          </p>
        </header>

        {isPrivacy ? <PrivacyPolicy /> : <TermsOfUse />}
      </main>

      <PublicSiteFooter />
    </div>
  )
}
