// The notice the Data Protection Act, 2012 (Act 843) calls for, shown before a report is sent
// (Milestone 1, section 4.4): what is collected, why, who can see it and how long it is kept.
// Short on purpose: people read the first lines, so those carry what matters most.
export function PrivacyNotice() {
  return (
    <section className="privacy" aria-labelledby="privacy-title">
      <h2 id="privacy-title">Before you send</h2>
      <ul>
        <li>
          <strong>Who sees your report:</strong> only authorised officers for that area. Your contact details and exact
          position are never shown to the public.
        </li>
        <li>
          <strong>What the tracking page shows:</strong> the status of the report and the general area, nothing else.
        </li>
        <li>
          <strong>Please describe what you saw, not who did it.</strong> Do not name or accuse anyone.
        </li>
      </ul>
      <details>
        <summary>More about your privacy</summary>
        <div className="privacy-more">
          <p>
            <strong>What we collect:</strong> what you write, your photos, the place and time you choose, and your name, phone
            or email only if you give them. You can report without giving your name.
          </p>
          <p>
            <strong>Why:</strong> so officers can check what you saw and, if you left contact details, ask you about it.
          </p>
          <p>
            <strong>Photos:</strong> they are made smaller on your phone, and hidden details inside the file, such as the
            camera's location, are removed.
          </p>
          <p>
            <strong>How long:</strong> your report is kept only as long as it is needed to follow it up.
          </p>
          <p>
            <strong>Your report is an allegation, not proof.</strong> Officers review every report before acting on it. Asaase
            Ani does not decide whether anyone is guilty.
          </p>
          <p>We handle your information under Ghana's Data Protection Act, 2012 (Act 843).</p>
        </div>
      </details>
      <p className="privacy-agree">By sending this report, you agree to this use of the information you give.</p>
    </section>
  );
}
