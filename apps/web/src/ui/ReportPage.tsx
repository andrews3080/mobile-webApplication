import { useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import { categoryLabel, districtsOf, formatDate, GHANA_REGIONS, isGhanaRegion, unknownDistrictArea } from "@asaase-ani/shared";
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
import { PhotoThumb } from "./PhotoThumb";
import { PrivacyNotice } from "./PrivacyNotice";
import { SubmittedScreen } from "./SubmittedScreen";
import type { ReportServices } from "./services";
import { useReportDraft } from "./use-report-draft";

interface Props {
  services: ReportServices;
  autosaveMs?: number;
}

// One question per screen (design direction A): a first-time reporter only ever faces one simple step.
// Pattern from the 21st.dev "Segmented Progress Questionnaire" and "Radio Card" components, rebuilt in plain CSS.
interface Step {
  key: string;
  title: string;
  fields: DraftField[];
  optional?: boolean;
}

const STEPS: Step[] = [
  { key: "what", title: "What did you see?", fields: ["category"] },
  { key: "describe", title: "Describe what you saw", fields: ["description"] },
  { key: "where", title: "Where and when", fields: ["region", "area", "placeDetails", "observedAt", "location"] },
  { key: "photos", title: "Photos", fields: ["photos"], optional: true },
  { key: "contact", title: "Your contact details", fields: ["contactPhone", "contactEmail"], optional: true },
  { key: "check", title: "Check and send", fields: [] },
];
const LAST = STEPS.length - 1;
const stepOf = (field: DraftField) => STEPS.findIndex((step) => step.fields.includes(field));

// A short line under each choice, in everyday words
const CATEGORY_HINTS: Record<string, string> = {
  excavation_site: "Pits, diggings or people washing soil",
  river_pollution: "Brown or muddy water, oil on the water",
  forest_clearing: "Trees cut down, farms dug up",
  machinery_or_equipment: "Excavators, pumps or changfan machines",
  other: "Anything else that worries you",
};

// Where each problem is shown, and the element to jump to from the summary
const FIELD_IDS: Record<DraftField, string> = {
  category: "category-excavation_site", // the first choice
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
const FIELD_ORDER: DraftField[] = STEPS.flatMap((step) => step.fields);

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

  const [stepIndex, setStepIndex] = useState(0);
  const [checkedSteps, setCheckedSteps] = useState<ReadonlySet<number>>(new Set()); // steps where "Next" was pressed
  const [attempted, setAttempted] = useState(false); // "Send" was pressed: show every problem
  const [touched, setTouched] = useState<ReadonlySet<DraftField>>(new Set()); // fields filled in and left
  const [confirmingStartOver, setConfirmingStartOver] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<SubmitReceipt | null>(null);
  const [photoNotes, setPhotoNotes] = useState<string[]>([]);
  const [addingPhotos, setAddingPhotos] = useState(false);
  const [locating, setLocating] = useState(false);
  const [locationNote, setLocationNote] = useState<string | null>(null);
  const [focusTarget, setFocusTarget] = useState<string | null>(null); // element to focus after the step renders
  const summaryRef = useRef<HTMLDivElement>(null);
  const placedOnStep = useRef(false);

  const allProblems: DraftProblems = useMemo(() => (draft ? validateDraft(draft, services.clock.now()) : {}), [draft, services.clock]);
  const problems: DraftProblems = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(allProblems).filter(
          ([field]) => attempted || touched.has(field as DraftField) || checkedSteps.has(stepOf(field as DraftField)),
        ),
      ),
    [allProblems, attempted, touched, checkedSteps],
  );

  // A restored draft opens at the first step that still needs something; a finished one at "Check and send"
  useEffect(() => {
    if (!draft || placedOnStep.current) return;
    placedOnStep.current = true;
    if (!handle.restored) return;
    const first = FIELD_ORDER.find((field) => allProblems[field]);
    setStepIndex(first ? stepOf(first) : LAST);
  }, [draft, handle.restored, allProblems]);

  // After moving to another step, put the cursor where the reporter needs it
  useEffect(() => {
    if (!focusTarget) return;
    document.getElementById(focusTarget)?.focus();
    setFocusTarget(null);
  }, [focusTarget, stepIndex]);

  const goTo = (index: number, focusId = `step-title-${STEPS[index]?.key}`) => {
    setStepIndex(index);
    setFocusTarget(focusId);
    window.scrollTo?.(0, 0);
  };

  const resetForm = () => {
    setStepIndex(0);
    setCheckedSteps(new Set());
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

  const step = STEPS[stepIndex] as Step;
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

  // "Next" checks only this step; "Send" (last step) checks everything and sends
  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!draft || sending) return;
    const now = services.clock.now();

    if (stepIndex < LAST) {
      const current = validateDraft(draft, now);
      const firstProblem = step.fields.find((field) => current[field]);
      if (firstProblem) {
        setCheckedSteps(new Set(checkedSteps).add(stepIndex));
        setFocusTarget(FIELD_IDS[firstProblem]);
        return;
      }
      goTo(stepIndex + 1);
      return;
    }

    setAttempted(true);
    setSendError(null);
    if (Object.keys(validateDraft(draft, now)).length > 0) {
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
  const contactGiven = [draft.contactName, draft.contactPhone, draft.contactEmail].map((v) => v.trim()).filter(Boolean);

  // Visible text is just "Change"; screen readers hear which answer it changes
  const change = (index: number, what: string) => (
    <button type="button" className="link change" aria-label={`Change ${what}`} onClick={() => goTo(index)}>
      Change
    </button>
  );

  return (
    <form className="report wizard" onSubmit={(event) => void onSubmit(event)} noValidate aria-busy={sending}>
      {stepIndex === 0 && (
        <>
          <div className="intro">
            <h1>Report illegal mining</h1>
            <p className="lead">You do not need to give your name. Your answers are saved on this phone as you go.</p>
          </div>
          <p className="safety">
            <Icon name="alert" size={22} />
            <span>
              <strong>Your safety comes first.</strong> Do not go close to the site or let anyone see you taking photos.
            </span>
          </p>
        </>
      )}

      {handle.restored && stepIndex !== 0 && !attempted && (
        <p className="notice">We kept the report you started earlier. You can carry on where you stopped.</p>
      )}

      <div
        className="progress"
        role="progressbar"
        aria-valuemin={1}
        aria-valuemax={STEPS.length}
        aria-valuenow={stepIndex + 1}
        aria-valuetext={`Step ${stepIndex + 1} of ${STEPS.length}: ${step.title}`}
      >
        <div className="progress-segments" aria-hidden="true">
          {STEPS.map((s, index) => (
            <span key={s.key} className={index <= stepIndex ? "done" : undefined} />
          ))}
        </div>
        <p className="progress-label">
          Step {stepIndex + 1} of {STEPS.length}
          {step.optional && <span className="tag">Optional</span>}
        </p>
      </div>

      <h2 className="step-heading" id={`step-title-${step.key}`} tabIndex={-1}>
        {step.title}
      </h2>

      {problemList.length > 0 && (
        <div className="summary" role="alert" tabIndex={-1} ref={summaryRef} aria-labelledby="summary-title">
          <h2 id="summary-title">Please check these before sending</h2>
          <ul>
            {problemList.map((field) => (
              <li key={field}>
                <a
                  href={`#${FIELD_IDS[field]}`}
                  onClick={(event) => {
                    // Go to the step that has the problem and put the cursor in the field
                    event.preventDefault();
                    goTo(stepOf(field), FIELD_IDS[field]);
                  }}
                >
                  {problems[field]}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      <fieldset disabled={sending} className="step-body">
        {step.key === "what" && (
          <div className="field" role="radiogroup" aria-labelledby="step-title-what" aria-describedby={problems.category ? `${FIELD_IDS.category}-problem` : undefined}>
            <p className="hint">Choose the one closest to what you saw.</p>
            <div className="choices">
              {REPORT_CATEGORIES.map((category) => (
                <label key={category.value} className="choice" htmlFor={`category-${category.value}`}>
                  <input
                    id={`category-${category.value}`}
                    type="radio"
                    name="category"
                    value={category.value}
                    checked={draft.category === category.value}
                    aria-invalid={problems.category ? true : undefined}
                    onChange={() => text("category")(category.value)}
                  />
                  <span className="choice-dot" aria-hidden="true" />
                  <span className="choice-text">
                    <span className="choice-label">{category.label}</span>
                    <span className="choice-hint">{CATEGORY_HINTS[category.value]}</span>
                  </span>
                </label>
              ))}
            </div>
            {problemText("category")}
          </div>
        )}

        {step.key === "describe" && (
          <div className="field">
            <label htmlFor="description" className="visually-hidden">
              Describe what you saw
            </label>
            <p className="hint">
              For example: how many people or machines, what they were doing, the colour of the water. Please describe the
              activity, not who did it.
            </p>
            <textarea
              {...fieldProps("description")}
              rows={7}
              maxLength={2000}
              value={draft.description}
              onChange={(e) => text("description")(e.target.value)}
            />
            {problemText("description")}
          </div>
        )}

        {step.key === "where" && (
          <>
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
          </>
        )}

        {step.key === "photos" && (
          <div className="field">
            <p className="hint">
              Only take photos if it is safe. Try not to show people&apos;s faces, especially children. Hidden details such as
              location are removed from photos. You can skip this step.
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
          </div>
        )}

        {step.key === "contact" && (
          <>
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
          </>
        )}

        {step.key === "check" && (
          <>
            <dl className="review">
              <div>
                <dt>What you saw</dt>
                <dd>{draft.category ? categoryLabel(draft.category) : <em>Not chosen yet</em>}</dd>
                {change(0, "what you saw")}
              </div>
              <div>
                <dt>Description</dt>
                <dd className="review-text">{draft.description.trim() || <em>Not written yet</em>}</dd>
                {change(1, "the description")}
              </div>
              <div>
                <dt>Where and when</dt>
                <dd>
                  {draft.area || <em>District not chosen yet</em>}
                  {draft.region && draft.area && !draft.area.includes(draft.region) ? `, ${draft.region} Region` : ""}
                  {draft.placeDetails.trim() && <span className="review-sub">{draft.placeDetails.trim()}</span>}
                  <span className="review-sub">Seen {formatDate(draft.observedAt) || "(time not set)"}</span>
                  {hasPosition && <span className="review-sub">Exact position added</span>}
                </dd>
                {change(2, "where and when")}
              </div>
              <div>
                <dt>Photos</dt>
                <dd>{draft.photos.length === 0 ? "None" : `${draft.photos.length} photo${draft.photos.length === 1 ? "" : "s"}`}</dd>
                {change(3, "photos")}
              </div>
              <div>
                <dt>Contact details</dt>
                <dd>{contactGiven.length === 0 ? "None: you stay anonymous" : contactGiven.join(", ")}</dd>
                {change(4, "contact details")}
              </div>
            </dl>
            <PrivacyNotice />
          </>
        )}
      </fieldset>

      {/* Stays at the bottom of the screen while scrolling, so the next action is always one tap away */}
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
        <div className={stepIndex > 0 ? "step-nav" : "step-nav single"}>
          {stepIndex > 0 && (
            <button type="button" className="secondary" disabled={sending} onClick={() => goTo(stepIndex - 1)}>
              Back
            </button>
          )}
          {stepIndex < LAST ? (
            <button type="submit" disabled={addingPhotos}>
              {step.optional && step.fields.every((field) => !draftHasValue(draft, field)) ? "Skip" : "Next"}
            </button>
          ) : (
            <button type="submit" className="with-icon" disabled={sending || addingPhotos}>
              <Icon name="send" />
              {sending ? "Sending… keep this page open" : "Send report"}
            </button>
          )}
        </div>
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

// An optional step shows "Skip" until the reporter has put something in it
function draftHasValue(draft: NonNullable<ReturnType<typeof useReportDraft>["draft"]>, field: DraftField): boolean {
  if (field === "photos") return draft.photos.length > 0;
  if (field === "contactPhone") return [draft.contactName, draft.contactPhone, draft.contactEmail].some((v) => v.trim() !== "");
  if (field === "contactEmail") return draft.contactEmail.trim() !== "";
  return false;
}
