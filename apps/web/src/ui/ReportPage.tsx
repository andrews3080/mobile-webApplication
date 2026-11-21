import { useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import { districtsOf, GHANA_REGIONS, isGhanaRegion, unknownDistrictArea } from "@asaase-ani/shared";
import { addPhoto, clearPosition, fromLocalInputValue, removePhoto, setObservedAt, setPosition, setRegion, setText, toLocalInputValue } from "../core/draft-editor";
import type { TextField } from "../core/draft-editor";
import { ApiError, DraftInvalidError, DraftStorageFullError, LocationUnavailableError } from "../core/errors";
import { preparePhotos } from "../core/photo-intake";
import type { SubmitReceipt } from "../core/ports";
import { MAX_PHOTOS, REPORT_CATEGORIES } from "../core/report-draft";
import { SubmitDraft } from "../core/submit-draft";
import { validateDraft } from "../core/validate-draft";
import type { DraftField, DraftProblems } from "../core/validate-draft";
import { Icon } from "./Icon";
import { CategoryArt } from "./illustrations/CategoryArt";
import { LandscapeHero } from "./illustrations/Landscape";
import { PhotoThumb } from "./PhotoThumb";
import { PrivacyNotice } from "./PrivacyNotice";
import { SubmittedScreen } from "./SubmittedScreen";
import type { ReportServices } from "./services";
import { useReportDraft } from "./use-report-draft";

interface Props {
  services: ReportServices;
  autosaveMs?: number;
}

// Where each problem is shown, and the element to jump to from the summary
const FIELD_IDS: Record<DraftField, string> = {
  category: "category-excavation_site", // the first picture tile
  description: "description",
  observedAt: "observedAt",
  region: "region",
  area: "area",
  placeDetails: "placeDetails",
  location: "location-button",
  photos: "photos-input",
  contactPhone: "contactPhone",
  contactEmail: "contactEmail",
};
const FIELD_ORDER: DraftField[] = [
  "category",
  "description",
  "region",
  "area",
  "placeDetails",
  "observedAt",
  "location",
  "photos",
  "contactPhone",
  "contactEmail",
];

function sendFailureMessage(error: unknown): string {
  if (error instanceof ApiError && error.kind === "rejected") return `The report was not accepted: ${error.message}`;
  if (error instanceof ApiError) {
    return "We could not send your report right now. It is saved on this device. Try again when you have a better connection.";
  }
  if (error instanceof DraftStorageFullError) return error.message;
  return "Something went wrong while sending. Your report is saved on this device. Please try again.";
}

export function ReportPage({ services, autosaveMs }: Props) {
  const handle = useReportDraft(services, autosaveMs);
  const { draft, update } = handle;

  const [attempted, setAttempted] = useState(false); // after the first try to send, show every problem
  const [touched, setTouched] = useState<ReadonlySet<DraftField>>(new Set()); // before that, only fields the reporter filled and left
  const [confirmingStartOver, setConfirmingStartOver] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<SubmitReceipt | null>(null);
  const [photoNotes, setPhotoNotes] = useState<string[]>([]);
  const [addingPhotos, setAddingPhotos] = useState(false);
  const [locating, setLocating] = useState(false);
  const [locationNote, setLocationNote] = useState<string | null>(null);
  const summaryRef = useRef<HTMLDivElement>(null);

  const allProblems: DraftProblems = useMemo(() => (draft ? validateDraft(draft, services.clock.now()) : {}), [draft, services.clock]);
  const problems: DraftProblems = useMemo(
    () => Object.fromEntries(Object.entries(allProblems).filter(([field]) => attempted || touched.has(field as DraftField))),
    [allProblems, attempted, touched],
  );

  const resetForm = () => {
    setAttempted(false);
    setTouched(new Set());
    setConfirmingStartOver(false);
    setSendError(null);
    setPhotoNotes([]);
    setLocationNote(null);
  };

  if (receipt) {
    return (
      <SubmittedScreen
        receipt={receipt}
        onAnother={() => {
          setReceipt(null);
          resetForm();
          void handle.startOver();
        }}
      />
    );
  }

  if (!draft) return <p role="status">Loading…</p>;

  const text = (field: TextField) => (value: string) => update((d, now) => setText(d, field, value, now));

  const fieldProps = (field: DraftField) => ({
    id: FIELD_IDS[field],
    "aria-invalid": problems[field] ? true : undefined,
    "aria-describedby": problems[field] ? `${FIELD_IDS[field]}-problem` : undefined,
    // Check a field when the reporter leaves it, but not if they only passed through without typing
    onBlur: (event: { currentTarget: { value?: string } }) => {
      if ((event.currentTarget.value ?? "").trim() !== "" && !touched.has(field)) setTouched(new Set(touched).add(field));
    },
  });

  const problemText = (field: DraftField) =>
    problems[field] ? (
      <p className="problem" id={`${FIELD_IDS[field]}-problem`}>
        {problems[field]}
      </p>
    ) : null;

  async function onPickPhotos(input: HTMLInputElement) {
    const files = Array.from(input.files ?? []);
    input.value = ""; // so picking the same file again still fires a change
    if (!draft || files.length === 0) return;
    setAddingPhotos(true);
    try {
      const result = await preparePhotos(files, draft.photos.length, services.compressor, services.ids);
      for (const photo of result.added) update((d, now) => addPhoto(d, photo, now));
      setPhotoNotes(result.problems);
    } finally {
      setAddingPhotos(false);
    }
  }

  async function onLocate() {
    setLocating(true);
    setLocationNote(null);
    try {
      const position = await services.location.current();
      update((d, now) => setPosition(d, position, now));
    } catch (error) {
      setLocationNote(error instanceof LocationUnavailableError ? error.message : new LocationUnavailableError().message);
    } finally {
      setLocating(false);
    }
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!draft || sending) return;
    setAttempted(true);
    setSendError(null);

    if (Object.keys(validateDraft(draft, services.clock.now())).length > 0) {
      requestAnimationFrame(() => summaryRef.current?.focus());
      return;
    }

    setSending(true);
    try {
      await handle.flush(); // the stored draft must match what we send
      const { drafts, photos, reports, clock, sleeper } = services;
      setReceipt(await new SubmitDraft(drafts, photos, reports, clock, sleeper).execute(draft));
    } catch (error) {
      if (!(error instanceof DraftInvalidError)) setSendError(sendFailureMessage(error));
      await handle.reload().catch(() => undefined); // keep the photos that did reach the server
    } finally {
      setSending(false);
    }
  }

  const problemList = attempted ? FIELD_ORDER.filter((field) => problems[field]) : [];
  const hasPosition = draft.latitude !== undefined && draft.longitude !== undefined;

  const step = (n: number, title: string, optional = false) => (
    <h2 className="step-title">
      <span className="step-number" aria-hidden="true">
        {n}
      </span>
      <span>
        <span className="visually-hidden">Step {n} of 4: </span>
        {title}
      </span>
      {optional && <span className="tag">Optional</span>}
    </h2>
  );

  return (
    <form className="report" onSubmit={(event) => void onSubmit(event)} noValidate aria-busy={sending}>
      <div className="hero">
        <LandscapeHero />
        <p className="hero-slogan">Report. Monitor. Protect our Land.</p>
      </div>

      <div className="intro">
        <h1>Report illegal mining</h1>
        <p className="lead">
          You do not need to give your name. Your report is saved on this phone as you type, so you can finish it later, even
          without a connection.
        </p>
      </div>

      <p className="safety">
        <Icon name="alert" size={22} />
        <span>
          <strong>Your safety comes first.</strong> Do not go close to the site or let anyone see you taking photos.
        </span>
      </p>

      {handle.restored && <p className="notice">We kept the report you started earlier. You can carry on where you stopped.</p>}

      {problemList.length > 0 && (
        <div className="summary" role="alert" tabIndex={-1} ref={summaryRef} aria-labelledby="summary-title">
          <h2 id="summary-title">Please check these before sending</h2>
          <ul>
            {problemList.map((field) => (
              <li key={field}>
                <a
                  href={`#${FIELD_IDS[field]}`}
                  onClick={(event) => {
                    // A plain #link only scrolls. Put the cursor in the field so the reporter can fix it at once.
                    const target = document.getElementById(FIELD_IDS[field]);
                    if (!target) return;
                    event.preventDefault();
                    target.focus(); // the browser scrolls it into view
                  }}
                >
                  {problems[field]}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      <fieldset disabled={sending} className="steps">
        <section className="card" aria-labelledby="step-1">
          <div id="step-1">{step(1, "What happened")}</div>
          <fieldset
            className="field category-field"
            aria-invalid={problems.category ? true : undefined}
            aria-describedby={problems.category ? "category-excavation_site-problem" : undefined}
          >
            <legend className="label">What did you see?</legend>
            <p className="hint">Choose the picture closest to what you saw.</p>
            <div className="category-tiles">
              {REPORT_CATEGORIES.map((category) => (
                <label key={category.value} className="category-tile" htmlFor={`category-${category.value}`}>
                  <input
                    id={`category-${category.value}`}
                    type="radio"
                    name="category"
                    value={category.value}
                    checked={draft.category === category.value}
                    onChange={() => text("category")(category.value)}
                  />
                  <CategoryArt category={category.value} />
                  <span className="category-name">{category.label}</span>
                </label>
              ))}
            </div>
            {problemText("category")}
          </fieldset>

          <div className="field">
            <label htmlFor="description">Describe what you saw</label>
            <p className="hint">
              For example: how many people or machines, what they were doing, the colour of the water. Please describe the
              activity, not who did it.
            </p>
            <textarea
              {...fieldProps("description")}
              rows={5}
              maxLength={2000}
              value={draft.description}
              onChange={(e) => text("description")(e.target.value)}
            />
            {problemText("description")}
          </div>
        </section>

        <section className="card" aria-labelledby="step-2">
          <div id="step-2">{step(2, "Where and when")}</div>
          <div className="field">
            <label htmlFor="region">Region</label>
            <select {...fieldProps("region")} value={draft.region} onChange={(e) => update((d, now) => setRegion(d, e.target.value, now))}>
              <option value="">Choose the region…</option>
              {GHANA_REGIONS.map((region) => (
                <option key={region} value={region}>
                  {region}
                </option>
              ))}
            </select>
            {problemText("region")}
          </div>

          <div className="field">
            <label htmlFor="area">District</label>
            <p className="hint" id="area-hint">
              {draft.region ? "The district decides which officers receive your report." : "Choose the region first."}
            </p>
            <select
              {...fieldProps("area")}
              aria-describedby={[problems.area ? "area-problem" : "", "area-hint"].filter(Boolean).join(" ")}
              value={draft.area}
              disabled={!draft.region}
              onChange={(e) => text("area")(e.target.value)}
            >
              <option value="">Choose the district…</option>
              {isGhanaRegion(draft.region) && <option value={unknownDistrictArea(draft.region)}>I don&apos;t know the district</option>}
              {districtsOf(draft.region).map((district) => (
                <option key={district} value={district}>
                  {district}
                </option>
              ))}
            </select>
            {problemText("area")}
          </div>

          <div className="field">
            <label htmlFor="placeDetails">
              Town, community or landmark <span className="tag">Optional</span>
            </label>
            <p className="hint">Helps officers find the place. Only officers see this; it is not shown on the tracking page.</p>
            <input
              {...fieldProps("placeDetails")}
              type="text"
              maxLength={200}
              value={draft.placeDetails}
              onChange={(e) => text("placeDetails")(e.target.value)}
            />
            {problemText("placeDetails")}
          </div>

          <div className="field">
            <label htmlFor="observedAt">When did you see it?</label>
            <input
              {...fieldProps("observedAt")}
              type="datetime-local"
              value={toLocalInputValue(draft.observedAt)}
              onChange={(e) => update((d, now) => setObservedAt(d, fromLocalInputValue(e.target.value), now))}
            />
            {problemText("observedAt")}
          </div>

          <div className="field">
            <span className="label">
              Exact position <span className="tag">Optional</span>
            </span>
            <p className="hint">Only press this if you are at the place now.</p>
            {hasPosition ? (
              <p className="position">
                <Icon name="pin" />
                <span>
                  Position saved: {draft.latitude!.toFixed(5)}, {draft.longitude!.toFixed(5)}
                </span>
                <button type="button" className="link" onClick={() => update((d, now) => clearPosition(d, now))}>
                  Remove
                </button>
              </p>
            ) : (
              <button {...fieldProps("location")} type="button" className="secondary with-icon" onClick={() => void onLocate()} disabled={locating}>
                <Icon name="pin" />
                {locating ? "Finding your position…" : "Use my current position"}
              </button>
            )}
            {locationNote && <p className="note">{locationNote}</p>}
            {problemText("location")}
          </div>
        </section>

        <section className="card" aria-labelledby="step-3">
          <div id="step-3">{step(3, "Photos", true)}</div>
          <p className="hint">
            Only take photos if it is safe. Try not to show people&apos;s faces, especially children. Hidden details such as
            location are removed from photos.
          </p>
          {draft.photos.length > 0 && (
            <ul className="photos">
              {draft.photos.map((photo, index) => (
                <li key={photo.id}>
                  <PhotoThumb photo={photo} alt={`Photo ${index + 1}`} />
                  <button type="button" className="link" onClick={() => update((d, now) => removePhoto(d, photo.id, now))}>
                    Remove photo {index + 1}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {draft.photos.length < MAX_PHOTOS && (
            <div className="file-picker">
              {/* The real input stays in the page (keyboard, screen readers, tests); the label is what people see and tap */}
              <input
                {...fieldProps("photos")}
                className="visually-hidden file-input"
                type="file"
                accept="image/*"
                multiple
                disabled={addingPhotos}
                onChange={(e) => void onPickPhotos(e.currentTarget)}
              />
              <label htmlFor={FIELD_IDS.photos} className="button secondary with-icon" aria-disabled={addingPhotos || undefined}>
                <Icon name="camera" />
                {addingPhotos ? "Preparing photos…" : `Add photos (${draft.photos.length} of ${MAX_PHOTOS})`}
              </label>
            </div>
          )}
          {addingPhotos && (
            <p role="status" className="visually-hidden">
              Preparing photos…
            </p>
          )}
          {photoNotes.map((note) => (
            <p key={note} className="note">
              {note}
            </p>
          ))}
          {problemText("photos")}
        </section>

        <section className="card" aria-labelledby="step-4">
          <div id="step-4">{step(4, "Your contact details", true)}</div>
          <p className="hint">Leave these empty to stay anonymous. Officers only use them if they need to ask you something.</p>
          <div className="field">
            <label htmlFor="contactName">Name</label>
            <input id="contactName" type="text" autoComplete="name" value={draft.contactName} onChange={(e) => text("contactName")(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="contactPhone">Phone</label>
            <input {...fieldProps("contactPhone")} type="tel" autoComplete="tel" value={draft.contactPhone} onChange={(e) => text("contactPhone")(e.target.value)} />
            {problemText("contactPhone")}
          </div>
          <div className="field">
            <label htmlFor="contactEmail">Email</label>
            <input {...fieldProps("contactEmail")} type="email" autoComplete="email" value={draft.contactEmail} onChange={(e) => text("contactEmail")(e.target.value)} />
            {problemText("contactEmail")}
          </div>
        </section>
      </fieldset>

      <PrivacyNotice />

      {/* Stays at the bottom of the screen while scrolling, so "Send" is always one tap away */}
      <div className="send-bar">
        {sendError && (
          <p className="error" role="alert">
            {sendError}
          </p>
        )}
        {handle.saveError && (
          <p className="error" role="alert">
            {handle.saveError}
          </p>
        )}
        <button type="submit" className="with-icon" disabled={sending || addingPhotos}>
          <Icon name="send" />
          {sending ? "Sending… please keep this page open" : "Send report"}
        </button>
        <p className="save-state" aria-live="polite">
          {handle.saveState === "saved" ? (
            <>
              <Icon name="saved" size={16} />
              Saved on this device
            </>
          ) : handle.saveState === "saving" ? (
            "Saving…"
          ) : (
            ""
          )}
        </p>
      </div>

      <div className="start-over">
        {confirmingStartOver ? (
          <div className="confirm" role="group" aria-labelledby="confirm-title">
            <p id="confirm-title">This deletes everything you have written in this report. Are you sure?</p>
            <div className="confirm-actions">
              <button type="button" className="danger" onClick={() => void handle.startOver().then(resetForm)}>
                Yes, delete it
              </button>
              <button type="button" className="secondary" onClick={() => setConfirmingStartOver(false)}>
                No, keep my report
              </button>
            </div>
          </div>
        ) : (
          <button type="button" className="link" disabled={sending} onClick={() => setConfirmingStartOver(true)}>
            Start a new report
          </button>
        )}
      </div>
    </form>
  );
}
