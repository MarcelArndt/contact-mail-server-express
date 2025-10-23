import express from "express";
import nodemailer from "nodemailer";
import dotenv from "dotenv";
import cors from "cors";

import hbs from "nodemailer-express-handlebars";
import path from "path";
import { fileURLToPath } from "url";


dotenv.config();
const app = express();
app.use(express.json());
app.use(cors());

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
  const { name, email, message } = req.body;
  try {
    await writeMails(name, email, message);
    res.status(200).json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
});

async function writeMails(name, email, message) {
  await sendMailToMe(name, email, message);
  await sendFeedbackEmail(name, email, message);
}

async function sendMailToMe(name, email, message){
  await transporter.sendMail({
    from: `"${name}" <${email}>`,
    to: process.env.EMAIL_HOST_USER,
    subject: `Neue Kontaktanfrage von ${name}`,
    template: "contact",
    context: {
      name,
      email,
      message,
      website: "https://arndt-marcel.de",
    },
  });
}

async function sendFeedbackEmail(name, email, message){
  await transporter.sendMail({
      from: `"Marcel Arndt - No Reply" <${process.env.EMAIL_HOST_USER}>`,
      to: email,
      subject: `I have received your message`,
      template: "feedback-email",
      context: {
        name,
        email,
        message,
      },
    });
}


app.listen(PORT, () => {console.log(`Server läuft auf Port ${PORT}`)});