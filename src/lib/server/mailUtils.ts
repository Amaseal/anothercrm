import nodemailer from 'nodemailer';
import { env } from '$env/dynamic/private';

const transporter = nodemailer.createTransport({
	host: env.SMTP_HOST, // Your Stalwart Mail server
	port: parseInt(env.SMTP_PORT || '587'),
	secure: env.SMTP_PORT === '465', // true for 465, false for other ports
	auth: {
		user: env.SMTP_USER,
		pass: env.SMTP_PASS
	}
});
// todo: i18n, error handling, logging
export async function sendPasswordResetEmail(to: string, resetLink: string) {
	await transporter.sendMail({
		from: env.SMTP_FROM || 'noreply@yourdomain.com',
		to: to,
		subject: 'Password Reset Request',
		html: `
            <h1>Reset Your Password</h1>
            <p>Click the link below to reset your password:</p>
            <a href="${resetLink}">${resetLink}</a>
            <p>This link will expire in 1 hour.</p>
            <p>If you didn't request this, please ignore this email.</p>
        `
	});
}

export async function sendEmail(to: string, subject: string, html: string) {
	await transporter.sendMail({
		from: env.SMTP_FROM || 'noreply@yourdomain.com',
		to: to,
		subject: subject,
		html: html
	});
}
