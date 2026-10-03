import type { Language, VideoScript } from "@/lib/schemas";

/**
 * Sample scripts for the preview page and tests. Synthetic people only; phone
 * numbers use the reserved 555-01xx range.
 */

export type VideoFixture = {
  id: string;
  label: string;
  preferredName: string;
  language: Language;
  script: VideoScript;
};

/**
 * Emily: cardiology follow-up with an echo in 2 days. Anxious detail-seeker who
 * wants a written plan; twins at home.
 */
export const emilyBeforeVisit: VideoScript = {
  stage: "before",
  title: "Your heart check-up on Thursday",
  scenes: [
    {
      kind: "title",
      title: "Here is your plan for Thursday",
      text: "Your heart check-up is in 2 days. This short video walks through what will happen, step by step.",
      voiceover: "Hi Emily. Your heart check-up is in two days. Here is what will happen, step by step.",
    },
    {
      kind: "card",
      title: "What the echo is",
      text: "An echo is an ultrasound picture of your heart. It does not hurt, and there are no needles. It takes about 30 to 40 minutes.",
      voiceover:
        "The echo is an ultrasound picture of your heart. No needles, and it takes about 30 to 40 minutes.",
    },
    {
      kind: "steps",
      title: "What will happen",
      text: "Four steps, start to finish.",
      items: [
        "Check in at the Cardiology desk on floor 2",
        "A tech puts small stickers and gel on your chest",
        "You rest on your side while they take pictures",
        "Your heart doctor goes over the results with you the same day",
      ],
      voiceover:
        "First you check in, then a tech takes pictures of your heart while you rest on your side. Your heart doctor goes over the results with you the same day.",
    },
    {
      kind: "choice",
      title: "You can choose what helps",
      text: "Tell us at check-in, or call ahead.",
      items: [
        "Bring the twins or someone to help",
        "Get a written copy of your plan",
        "Ask us to pause and explain at any point",
      ],
      voiceover:
        "You can bring someone with you, ask for a written copy of your plan, or ask us to pause and explain at any time.",
    },
    {
      kind: "closing",
      title: "We will see you Thursday, Emily",
      text: "Questions before then? Call the Cardiology clinic at 555-0142, Monday to Friday, 8 to 5.",
      voiceover:
        "See you Thursday, Emily. If anything comes up before then, call the clinic at 555-0142. We are glad to help.",
    },
  ],
};

/** Carmen: heart failure, daily routine after today's visit, Spanish. */
export const carmenAfterVisit: VideoScript = {
  stage: "after",
  title: "Su rutina diaria para el corazón",
  scenes: [
    {
      kind: "title",
      title: "Gracias por su visita de hoy",
      text: "Aquí está su rutina diaria para cuidar su corazón. Son tres pasos y toman unos cinco minutos.",
      voiceover: "Hola, Carmen. Gracias por venir hoy. Esta es su rutina diaria para cuidar su corazón.",
    },
    {
      kind: "steps",
      title: "Cada mañana",
      text: "Tres pasos, cinco minutos.",
      items: [
        "Pésese antes de desayunar y anote el número",
        "Tome sus pastillas con el desayuno",
        "Revise si tiene hinchazón en los pies o los tobillos",
      ],
      voiceover:
        "Cada mañana, pésese y anote el número. Tome sus pastillas con el desayuno y revise si tiene hinchazón en los pies.",
    },
    {
      kind: "choice",
      title: "Usted decide",
      text: "Elija lo que más le ayude.",
      items: [
        "Recibir un recordatorio por mensaje de texto",
        "Que llamemos también a su hija",
        "Una hoja impresa para la cocina",
      ],
      voiceover:
        "Usted puede recibir un recordatorio por texto, pedir que llamemos a su hija, o tener una hoja impresa para la cocina.",
    },
    {
      kind: "closing",
      title: "Estamos con usted, Carmen",
      text: "Si sube más de 1 kilo en un día, o le falta el aire, llame al 555-0188. Contestamos de lunes a viernes, de 8 a 5.",
      voiceover:
        "Si sube más de un kilo en un día o le falta el aire, llame al 555-0188. Estamos aquí para ayudarla.",
    },
  ],
};

export const videoFixtures: VideoFixture[] = [
  {
    id: "emily-before",
    label: "Emily · before the echo",
    preferredName: "Emily",
    language: "en",
    script: emilyBeforeVisit,
  },
  {
    id: "carmen-after",
    label: "Carmen · rutina diaria",
    preferredName: "Carmen",
    language: "es",
    script: carmenAfterVisit,
  },
];
