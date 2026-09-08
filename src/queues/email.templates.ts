import type { EmailJobData } from "./email.queue.js";

export const buildEmail = (data: EmailJobData): { subject: string; html: string } => {
  switch (data.type) {
    case "verification":
      return {
        subject: "Verify your email",
        html: `<p>Hi ${data.name},</p>
<p>Thanks for signing up. Please verify your email by clicking the link below:</p>
<p><a href="${data.verifyUrl}">${data.verifyUrl}</a></p>
<p>This link expires soon, so please use it right away.</p>`,
      };
    case "welcome":
      return {
        subject: "Welcome!",
        html: `<p>Hi ${data.name},</p><p>Your account is ready to use. Glad to have you here.</p>`,
      };
  }
};
