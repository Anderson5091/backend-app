import "dotenv/config";
import { prisma } from "../../config/database";
import { logger } from "../../utils/logger";
import { Resend } from "resend";
import twilio from "twilio";

function generateOtpCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

const resend = new Resend(process.env.RESEND_API_KEY);
const from = process.env.EMAIL_FROM || "Quick Send <noreply@quicksend.com.mx>";

const twilioClient =
  process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN
    ? twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
    : null;

const twilioFrom = process.env.TWILIO_PHONE_NUMBER || "";

async function sendSms(phone: string, code: string): Promise<boolean> {
  if (!twilioClient || !twilioFrom) {
    logger.warn("[OTP] Twilio not configured, skipping SMS");
    return false;
  }

  try {
    await twilioClient.messages.create({
      body: `Your Quick Send verification code is ${code}. It expires in 5 minutes.`,
      from: twilioFrom,
      to: phone,
    });

    logger.info(`[OTP] SMS sent to ${phone}`);
    return true;
  } catch (error: any) {
    logger.error(`[OTP] SMS failed for ${phone}: ${error.message}`);
    return false;
  }
}

export const otpService = {
  async sendOtp(userId: string, phone: string, email?: string): Promise<string> {
    const code = generateOtpCode();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    await prisma.otpCode.create({
      data: { userId, code, type: "PHONE_VERIFICATION", expiresAt },
    });

    if (phone) {
      await sendSms(phone, code);
    }

    if (email) {
      const { error } = await resend.emails.send({
        from,
        to: email,
        subject: "Your Quick Send verification code",
        html: `<h2>Quick Send Verification</h2><p>Your verification code is: <strong>${code}</strong></p><p>This code expires in 5 minutes.</p>`,
      });

      if (error) {
        logger.error(`[OTP] Email failed for ${email}: ${error.message}`);
      } else {
        logger.info(`[OTP] Email sent to ${email}`);
      }
    }

    return code;
  },

  async sendOtpEmailOnly(userId: string, email: string): Promise<string> {
    const code = generateOtpCode();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    await prisma.otpCode.create({
      data: { userId, code, type: "PHONE_VERIFICATION", expiresAt },
    });

    const { error } = await resend.emails.send({
      from,
      to: email,
      subject: "Your Quick Send verification code",
      html: `<h2>Quick Send Verification</h2><p>Your verification code is: <strong>${code}</strong></p><p>This code expires in 5 minutes.</p>`,
    });

    if (error) {
      logger.error(`[OTP] Email failed for ${email}: ${error.message}`);
    } else {
      logger.info(`[OTP] Email sent to ${email}`);
    }

    return code;
  },

  async verifyOtp(userId: string, code: string): Promise<boolean> {
    const otp = await prisma.otpCode.findFirst({
      where: {
        userId,
        code,
        type: "PHONE_VERIFICATION",
        verified: false,
        expiresAt: { gte: new Date() },
      },
      orderBy: { createdAt: "desc" },
    });

    if (!otp) return false;

    await prisma.otpCode.update({
      where: { id: otp.id },
      data: { verified: true },
    });

    await prisma.user.update({
      where: { id: userId },
      data: { phoneVerified: true },
    });

    return true;
  },
};
