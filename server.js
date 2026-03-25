import express from "express";
import nodemailer from "nodemailer";
import dotenv from "dotenv";
import cors from "cors";

import hbs from "nodemailer-express-handlebars";
import path from "path";
import { fileURLToPath } from "url";


import rateLimit from "express-rate-limit";

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

dotenv.config();
const app = express();

const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 5 });
app.use("/send-mail", limiter);


const allowedOrigins = process.env.CORS_ALLOWED_URLS? process.env.CORS_ALLOWED_URLS.split(',').map(url => url.trim()).filter(Boolean) : [];

app.use(cors({
  origin: (origin, callback) => {
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    } else {
      return callback(new Error(`CORS blockiert Anfrage von: ${origin}`));
    }
  },
  methods: ['POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type'],
  credentials: true,
  optionsSuccessStatus: 200
}));

app.use(express.json());

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = process.env.PORT || 3000;

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: Number(process.env.EMAIL_PORT),
  secure: process.env.EMAIL_USE_SSL === "true",
  auth: {
    user: process.env.EMAIL_HOST_USER,
    pass: process.env.EMAIL_HOST_PASSWORD,
  },
});

transporter.use("compile", hbs({
  viewEngine: {
    extname: ".hbs",
    layoutsDir: path.join(__dirname, "views/email"),
    defaultLayout: false,
  },
  viewPath: path.join(__dirname, "views/email"),
  extName: ".hbs",
}));


app.post("/send-mail", async (req, res) => {
  const { name, email, message, firstname, lastname, subject } = req.body;
  try {
    const validated = validateData({ name, email, message, firstname, lastname, subject });
    await writeMails(validated.name, validated.email, validated.message, validated.subject);
    res.status(200).json({ success: true });
  } catch (err) {
    if (err.isValidation) {
      return res.status(400).json({ success: false, error: err.message });
    }
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
});


function validateData({ name, email, message, firstname, lastname, subject }) {

  let resolvedName = name?.trim();
  if (!resolvedName) {
    const first = firstname?.trim();
    const last = lastname?.trim();
    if (first && last) {
      resolvedName = `${first} ${last}`;
    } else {
      throw Object.assign(new Error("Ein Name muss angegeben sein."), { isValidation: true });
    }
  }

  let resolvedMessage = message?.trim();
  if (!resolvedMessage) {
    throw Object.assign(new Error("Eine Nachricht muss angegeben sein."), { isValidation: true });
  }

  const resolvedSubject = subject?.trim()
  if(!resolvedSubject){
     throw Object.assign(new Error("Ein Betreff muss angegeben sein."), { isValidation: true });
  }

  if (!emailRegex.test(email)) {
    throw Object.assign(new Error("Keine gültige E-Mail Adresse."), { isValidation: true });
  }

  return { name: resolvedName, email, message: resolvedMessage , subject: resolvedSubject};
}


async function writeMails(name, email, message, subject) {
  await sendMailToMe(name, email, message, subject);
  await sendFeedbackEmail(name, email, message, subject);
}

async function sendMailToMe(name, email, message, subject){
  await transporter.sendMail({
    from: `"${name}" <${email}>`,
    to: process.env.EMAIL_HOST_USER,
    subject: `Neue Kontaktanfrage von ${name} | ${subject}`,
    template: "contact",
    context: {
      name,
      email,
      message,
      subject,
      website:  process.env.ORIGIN_WEBSEITE_URL,
    },
  });
}

async function sendFeedbackEmail(name, email, message, subject){
  await transporter.sendMail({
      from: `"Marcel Arndt - No Reply" <${process.env.EMAIL_HOST_USER}>`,
      to: email,
      subject: `I have received your message | ${subject}`,
      template: "feedback-email",
      context: {
        name,
        email,
        message,
        subject,
      },
    });
}


app.listen(PORT, () => {console.log(`Server läuft auf Port ${PORT}`)});