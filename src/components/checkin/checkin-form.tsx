"use client";

import { useId, useState } from "react";
import { ArrowRightIcon, CheckCircle2Icon, ClockIcon, Loader2Icon, RotateCcwIcon, SendIcon, TriangleAlertIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Wordmark } from "@/components/shell/wordmark";
import { VideoPlayer } from "@/components/video-player";
import { api, ApiRequestError } from "@/lib/client/api";
import { bestTimeSchema, type BestTime, type CheckinAnswers, type CheckinStatus, type Language, type VideoScript } from "@/lib/schemas";
import { cn } from "@/lib/utils";

export type CheckinInitial =
  | { kind: "invalid"; language: Language }
  | { kind: "ok"; status: CheckinStatus; expiresAt: string; patientFirstName: string; language: Language };

/** The clinician-approved "before your visit" video, shown before the questions. */
export type CheckinVideo = { script: VideoScript; preferredName: string; language: Language; backdrop: string };

type View = "form" | "sending" | "success" | "error" | "expired" | "submitted" | "invalid";

const COPY = {
  en: {
    eyebrow: "Before your visit",
    greeting: (name: string) => `Hi ${name}.`,
    intro: "A few quick questions so your care team can talk with you the way you prefer. About two minutes.",
    introShort: "One quick question so your care team can support you.",
    videoIntro: "First, a short video about your visit. The question comes right after.",
    continue: "Continue",
    replay: "Watch the video again",
    hideVideo: "Hide video",
    whatMatters: "Help us understand what support you need before, during and after your visit?",
    whatMattersHelp: "Anything you want your care team to know, in your own words.",
    whatMattersPlaceholder: "For example: I want to understand my options before anything is decided.",
    language: "Which language do you prefer?",
    includeWho: "Who else should get messages?",
    includeWhoHelp: "A family member or caregiver, if you like. Leave it blank for just you.",
    includeWhoPlaceholder: "Just me",
    bestTime: "When is the best time to reach you?",
    bestTimes: { morning: "Morning", afternoon: "Afternoon", no_preference: "No preference" } as Record<BestTime, string>,
    submit: "Send my answers",
    sending: "Sending…",
    required: "Please write at least one line.",
    tooLong: (n: number) => `Please keep it under ${n} characters.`,
    chars: (n: number, max: number) => `${n} / ${max}`,
    successTitle: "Thank you, we have your answers.",
    successBody: "Your care team will read this before your visit.",
    submittedTitle: "Thank you, we have your answers.",
    submittedBody: "This link was already used. If you need to change something, ask your clinic.",
    expiredTitle: "This link has expired.",
    expiredBody: "Ask your clinic for a new one.",
    invalidTitle: "This link isn't valid.",
    invalidBody: "Ask your clinic for a new one.",
    errorTitle: "We couldn't send your answers.",
    errorBody: "Please check your connection and try again. Nothing you wrote was lost.",
    retry: "Try again",
    footer: "Your clinic uses what you write here to talk with you in the way you prefer. It is not a medical record.",
  },
  es: {
    eyebrow: "Antes de su visita",
    greeting: (name: string) => `Hola, ${name}.`,
    intro: "Unas preguntas breves para que su equipo de atención se comunique con usted como usted prefiera. Unos dos minutos.",
    introShort: "Una pregunta breve para que su equipo de atención pueda apoyarle.",
    videoIntro: "Primero, un video corto sobre su visita. La pregunta viene justo después.",
    continue: "Continuar",
    replay: "Ver el video de nuevo",
    hideVideo: "Ocultar el video",
    whatMatters: "¿Nos ayuda a entender qué apoyo necesita antes, durante y después de su visita?",
    whatMattersHelp: "Todo lo que quiera que su equipo sepa, en sus propias palabras.",
    whatMattersPlaceholder: "Por ejemplo: quiero entender mis opciones antes de que se decida algo.",
    language: "¿Qué idioma prefiere?",
    includeWho: "¿Quién más debería recibir los mensajes?",
    includeWhoHelp: "Un familiar o cuidador, si lo desea. Déjelo en blanco si es solo para usted.",
    includeWhoPlaceholder: "Solo yo",
    bestTime: "¿Cuál es el mejor momento para comunicarnos con usted?",
    bestTimes: { morning: "Por la mañana", afternoon: "Por la tarde", no_preference: "Sin preferencia" } as Record<BestTime, string>,
    submit: "Enviar mis respuestas",
    sending: "Enviando…",
    required: "Por favor escriba al menos una línea.",
    tooLong: (n: number) => `Por favor, no más de ${n} caracteres.`,
    chars: (n: number, max: number) => `${n} / ${max}`,
    successTitle: "Gracias, ya tenemos sus respuestas.",
    successBody: "Su equipo de atención leerá esto antes de su visita.",
    submittedTitle: "Gracias, ya tenemos sus respuestas.",
    submittedBody: "Este enlace ya se usó. Si necesita cambiar algo, pida ayuda a su clínica.",
    expiredTitle: "Este enlace ha expirado.",
    expiredBody: "Pida uno nuevo a su clínica.",
    invalidTitle: "Este enlace no es válido.",
    invalidBody: "Pida uno nuevo a su clínica.",
    errorTitle: "No pudimos enviar sus respuestas.",
    errorBody: "Revise su conexión e inténtelo de nuevo. No se perdió nada de lo que escribió.",
    retry: "Intentar de nuevo",
    footer: "Su clínica usa lo que escribe aquí para comunicarse con usted de la manera que prefiera. No es un expediente médico.",
  },
} as const;

const LANGUAGE_LABEL: Record<Language, string> = { en: "English", es: "Español" };
const MAX_WHAT_MATTERS = 2000;
const MAX_INCLUDE_WHO = 120;

function initialView(initial: CheckinInitial): View {
  if (initial.kind === "invalid") return "invalid";
  if (initial.status === "expired") return "expired";
  if (initial.status === "submitted") return "submitted";
  return "form";
}

export function CheckinForm({
  token,
  initial,
  extraQuestions = false,
  video = null,
  preview,
}: {
  token: string;
  initial: CheckinInitial;
  extraQuestions?: boolean;
  video?: CheckinVideo | null;
  /** Walkthrough only: prefills the answer and never submits. */
  preview?: { answer: string };
}) {
  const [view, setView] = useState<View>(() => initialView(initial));
  // With an approved video the intake opens on it; the questions follow when it ends or the patient moves on.
  const [watching, setWatching] = useState(video !== null);
  const [replays, setReplays] = useState(0);
  const [replaying, setReplaying] = useState(false);
  const [language, setLanguage] = useState<Language>(initial.language);
  const [whatMatters, setWhatMatters] = useState(preview?.answer ?? "");
  const [includeWho, setIncludeWho] = useState("");
  const [bestTime, setBestTime] = useState<BestTime>("no_preference");
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const ids = { whatMatters: useId(), includeWho: useId(), language: useId(), bestTime: useId(), error: useId() };

  const t = COPY[language];
  const other = COPY[language === "en" ? "es" : "en"];
  const firstName = initial.kind === "ok" ? initial.patientFirstName : "";

  const answers = (): CheckinAnswers => ({ whatMatters: whatMatters.trim(), language, includeWho: includeWho.trim(), bestTime });

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (preview) return;
    const body = answers();
    if (!body.whatMatters) {
      setFieldError(t.required);
      document.getElementById(ids.whatMatters)?.focus();
      return;
    }
    if (body.whatMatters.length > MAX_WHAT_MATTERS) {
      setFieldError(t.tooLong(MAX_WHAT_MATTERS));
      return;
    }
    setFieldError(null);
    setServerError(null);
    setView("sending");
    try {
      await api.checkinSubmit(token, body);
      setView("success");
    } catch (err) {
      if (err instanceof ApiRequestError && err.status === 410) return setView("expired");
      if (err instanceof ApiRequestError && err.status === 409) return setView("submitted");
      if (err instanceof ApiRequestError && err.status === 404) return setView("invalid");
      setServerError(err instanceof ApiRequestError && err.status === 400 ? err.message : null);
      setView("error");
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-5 py-10 sm:px-8 sm:py-14">
      <header className="flex items-center justify-between gap-4">
        <Wordmark />
        <p className="text-sm font-medium uppercase tracking-[0.16em] text-voice-muted">{t.eyebrow}</p>
      </header>

      {video && watching && view === "form" ? (
        <section className="mt-10 flex flex-1 flex-col gap-6">
          <div>
            {firstName && <p className="text-2xl font-semibold leading-tight sm:text-3xl">{t.greeting(firstName)}</p>}
            <p className="mt-2 text-lg leading-relaxed text-voice-muted">{t.videoIntro}</p>
          </div>
          <VideoPlayer script={video.script} preferredName={video.preferredName} language={video.language} backdrop={video.backdrop} autoPlay onEnded={() => setWatching(false)} />
          <div className="mt-auto flex flex-col gap-3 pt-2 sm:flex-row-reverse">
            <Button type="button" size="lg" onClick={() => setWatching(false)} className="h-14 rounded-xl text-lg sm:flex-1">
              {t.continue} <ArrowRightIcon aria-hidden />
            </Button>
          </div>
        </section>
      ) : view === "form" || view === "sending" || view === "error" ? (
        <form onSubmit={submit} className="mt-10 flex flex-1 flex-col gap-10" noValidate aria-busy={view === "sending"}>
          <div>
            {firstName && <p className="text-2xl font-semibold leading-tight sm:text-3xl">{t.greeting(firstName)}</p>}
            <p className="mt-2 text-lg leading-relaxed text-voice-muted">{extraQuestions ? t.intro : t.introShort}</p>
            {video && (
              <Button
                type="button"
                variant="outline"
                size="lg"
                onClick={() => {
                  if (replaying) return setReplaying(false);
                  setReplays((n) => n + 1);
                  setReplaying(true);
                }}
                className="mt-4 h-12 rounded-xl text-base"
                aria-expanded={replaying}
              >
                {replaying ? <XIcon aria-hidden /> : <RotateCcwIcon aria-hidden />} {replaying ? t.hideVideo : t.replay}
              </Button>
            )}
            {video && replaying && (
              <VideoPlayer key={replays} className="mt-4" script={video.script} preferredName={video.preferredName} language={video.language} backdrop={video.backdrop} autoPlay />
            )}
          </div>

          <div className="grid gap-3">
            <label htmlFor={ids.whatMatters} className="text-2xl font-semibold leading-snug sm:text-[1.75rem]">
              {t.whatMatters}
            </label>
            <p className="text-base text-voice-muted">{t.whatMattersHelp}</p>
            <Textarea
              id={ids.whatMatters}
              value={whatMatters}
              onChange={(e) => {
                setWhatMatters(e.target.value);
                if (fieldError) setFieldError(null);
              }}
              rows={5}
              maxLength={MAX_WHAT_MATTERS}
              required
              aria-required
              aria-invalid={fieldError ? true : undefined}
              aria-describedby={fieldError ? ids.error : undefined}
              placeholder={t.whatMattersPlaceholder}
              disabled={view === "sending"}
              className="min-h-36 rounded-xl border-2 bg-voice-card px-4 py-3 text-lg leading-relaxed md:text-lg"
            />
            <div className="flex items-start justify-between gap-3 text-sm">
              {fieldError ? (
                <p id={ids.error} role="alert" className="font-medium text-bad">
                  {fieldError}
                </p>
              ) : (
                <span />
              )}
              <span className="tabular-nums text-voice-muted">{t.chars(whatMatters.length, MAX_WHAT_MATTERS)}</span>
            </div>
          </div>

          {/* Off by default (OFF_THE_CHART_CHECKIN_EXTRA_QUESTIONS); answers then keep their neutral defaults. */}
          {extraQuestions && (
            <>
              <fieldset className="grid gap-3" disabled={view === "sending"}>
                <legend id={ids.language} className="text-2xl font-semibold leading-snug sm:text-[1.75rem]">
                  {t.language}
                </legend>
                <div role="radiogroup" aria-labelledby={ids.language} className="grid grid-cols-2 gap-3">
                  {(["en", "es"] as Language[]).map((l) => (
                    <ChoiceCard key={l} name="language" value={l} checked={language === l} onChange={() => setLanguage(l)} label={LANGUAGE_LABEL[l]} />
                  ))}
                </div>
              </fieldset>

              <div className="grid gap-3">
                <label htmlFor={ids.includeWho} className="text-2xl font-semibold leading-snug sm:text-[1.75rem]">
                  {t.includeWho}
                </label>
                <p className="text-base text-voice-muted">{t.includeWhoHelp}</p>
                <Input
                  id={ids.includeWho}
                  value={includeWho}
                  onChange={(e) => setIncludeWho(e.target.value.slice(0, MAX_INCLUDE_WHO))}
                  maxLength={MAX_INCLUDE_WHO}
                  placeholder={t.includeWhoPlaceholder}
                  autoComplete="off"
                  disabled={view === "sending"}
                  className="h-12 rounded-xl border-2 bg-voice-card px-4 text-lg md:text-lg"
                />
              </div>

              <fieldset className="grid gap-3" disabled={view === "sending"}>
                <legend id={ids.bestTime} className="text-2xl font-semibold leading-snug sm:text-[1.75rem]">
                  {t.bestTime}
                </legend>
                <div role="radiogroup" aria-labelledby={ids.bestTime} className="grid gap-3 sm:grid-cols-3">
                  {bestTimeSchema.options.map((b) => (
                    <ChoiceCard key={b} name="bestTime" value={b} checked={bestTime === b} onChange={() => setBestTime(b)} label={t.bestTimes[b]} />
                  ))}
                </div>
              </fieldset>
            </>
          )}

          {view === "error" && (
            <div role="alert" className="rounded-xl border-2 border-bad/40 bg-bad-soft/60 p-4 text-bad">
              <p className="flex items-center gap-2 text-lg font-semibold">
                <TriangleAlertIcon aria-hidden className="size-5" /> {t.errorTitle}
              </p>
              <p className="mt-1 text-base">{serverError ?? t.errorBody}</p>
            </div>
          )}

          <div className="mt-auto flex flex-col gap-3 pt-2">
            <Button type="submit" size="lg" disabled={view === "sending" || Boolean(preview)} className="h-14 rounded-xl text-lg">
              {view === "sending" ? <Loader2Icon aria-hidden className="animate-spin" /> : <SendIcon aria-hidden />}
              {view === "sending" ? t.sending : view === "error" ? t.retry : t.submit}
            </Button>
            <p className="text-sm leading-relaxed text-voice-muted">{t.footer}</p>
          </div>
        </form>
      ) : (
        <Terminal
          icon={view === "success" || view === "submitted" ? CheckCircle2Icon : view === "expired" ? ClockIcon : TriangleAlertIcon}
          tone={view === "success" || view === "submitted" ? "ok" : "warn"}
          title={view === "success" ? t.successTitle : view === "submitted" ? t.submittedTitle : view === "expired" ? t.expiredTitle : t.invalidTitle}
          body={view === "success" ? t.successBody : view === "submitted" ? t.submittedBody : view === "expired" ? t.expiredBody : t.invalidBody}
          secondary={
            view === "success"
              ? null
              : `${view === "submitted" ? other.submittedTitle : view === "expired" ? other.expiredTitle : other.invalidTitle} ${view === "submitted" ? other.submittedBody : view === "expired" ? other.expiredBody : other.invalidBody}`
          }
          footer={t.footer}
        />
      )}
    </div>
  );
}

function ChoiceCard({ name, value, checked, onChange, label }: { name: string; value: string; checked: boolean; onChange: () => void; label: string }) {
  return (
    <label
      className={cn(
        "flex min-h-14 cursor-pointer items-center justify-center rounded-xl border-2 bg-voice-card px-4 py-3 text-center text-lg font-medium transition-colors",
        "has-focus-visible:ring-3 has-focus-visible:ring-ring/50",
        checked ? "border-voice-accent text-voice-accent" : "border-border hover:border-voice-accent/50",
      )}
    >
      <input type="radio" name={name} value={value} checked={checked} onChange={onChange} className="sr-only" />
      {label}
    </label>
  );
}

function Terminal({
  icon: Icon,
  tone,
  title,
  body,
  secondary,
  footer,
}: {
  icon: typeof CheckCircle2Icon;
  tone: "ok" | "warn";
  title: string;
  body: string;
  secondary: string | null;
  footer: string;
}) {
  return (
    <section aria-live="polite" className="mt-10 flex flex-1 flex-col">
      <div className={cn("flex size-14 items-center justify-center rounded-full", tone === "ok" ? "bg-ok-soft text-ok" : "bg-warn-soft text-warn")}>
        <Icon aria-hidden className="size-7" />
      </div>
      <h1 className="mt-6 text-3xl font-semibold leading-tight sm:text-4xl">{title}</h1>
      <p className="mt-3 text-xl leading-relaxed text-voice-muted">{body}</p>
      {secondary && <p className="mt-6 border-t pt-4 text-base leading-relaxed text-voice-muted">{secondary}</p>}
      <p className="mt-auto pt-10 text-sm leading-relaxed text-voice-muted">{footer}</p>
    </section>
  );
}
