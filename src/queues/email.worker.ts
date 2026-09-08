import { Worker } from "bullmq";
import nodemailer from "nodemailer";
import { env } from "../config/env.js";
import { EMAIL_QUEUE_NAME, type EmailJobData } from "./email.queue.js";
import { buildEmail } from "./email.templates.js";

// If SMTP creds aren't configured (e.g. local dev), fall back to logging the
// email to the console instead of failing the job - keeps the queue/worker
// demonstrable without requiring a real mailbox.
const hasSmtpConfig = Boolean(env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS);

const transporter = hasSmtpConfig
  ? nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_PORT === 465,
      auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
    })
  : null;

export const startEmailWorker = () => {
  const worker = new Worker<EmailJobData, void, string>(
    EMAIL_QUEUE_NAME,
    async (job) => {
      const { subject, html } = buildEmail(job.data);

      if (!transporter) {
        console.log(`[email:dev] to=${job.data.to} subject="${subject}"\n${html}`);
        return;
      }

      await transporter.sendMail({
        from: env.SMTP_FROM,
        to: job.data.to,
        subject,
        html,
      });
    },
    { connection: { url: env.REDIS_URL }, concurrency: 5 },
  );

  worker.on("completed", (job) => console.log(`[email] sent job ${job.id} (${job.name})`));
  worker.on("failed", (job, err) => console.error(`[email] job ${job?.id} failed:`, err.message));

  return worker;
};
