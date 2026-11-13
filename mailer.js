// ============================================================
// DORAGON DOJO CLUB — GESTIONNAIRE D'EMAILS TRANSACTIONNELS
// Emails épurés, modernes et professionnels pour le club :
// 1. Bienvenue & Création de Compte Adhérent
// 2. Confirmation de Commande & Reçu Officiel
// ============================================================

const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');

const ROOT_DIR = __dirname;
const LOGO_PATH = path.join(ROOT_DIR, 'assets', 'logo.jpg');

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatEuro(amount) {
  return `${Number(amount).toFixed(2).replace('.', ',')} €`;
}

function isSmtpConfigured() {
  const user = (process.env.SMTP_USER || '').trim();
  const pass = (process.env.SMTP_PASS || '').trim();
  return Boolean(
    user &&
    pass &&
    !user.includes('votre.email@') &&
    !pass.includes('votre-mot-de-passe')
  );
}

function createTransporter() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: Number(process.env.SMTP_PORT) || 465,
    secure: String(process.env.SMTP_SECURE || 'true').toLowerCase() === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });
}

// ------------------------------------------------------------
// TEMPLATE 1 : BIENVENUE & CRÉATION DE COMPTE ADHÉRENT
// ------------------------------------------------------------
function buildWelcomeEmail(user, clubName, siteUrl) {
  const safeClub = escapeHtml(clubName || 'DORAGON DOJO CLUB');
  const safeName = escapeHtml(user.name);
  const safeEmail = escapeHtml(user.email);
  const safePhone = escapeHtml(user.phone || 'Non renseigné');
  const safeRash = escapeHtml(user.favoriteRashguardSize || 'M');
  const safeGloves = escapeHtml(user.favoriteGlovesSize || 'L/XL');
  const targetUrl = siteUrl || process.env.SITE_URL || 'https://doragon-dojo-boutique.onrender.com';

  const html = `
  <!DOCTYPE html>
  <html lang="fr">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Bienvenue au dojo</title>
  </head>
  <body style="margin:0;padding:20px;background-color:#071326;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#f1f5f9;">
    <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:#0c1e3d;border:1px solid rgba(229,178,76,0.3);border-radius:14px;overflow:hidden;box-shadow:0 12px 30px rgba(0,0,0,0.4);">
      <!-- Header -->
      <tr>
        <td style="padding:28px 24px 20px;text-align:center;background:linear-gradient(180deg,#0a1832 0%,#0c1e3d 100%);border-bottom:1px solid rgba(255,255,255,0.08);">
          <div style="display:inline-block;padding:4px 12px;background:rgba(229,178,76,0.15);border:1px solid #e5b24c;border-radius:20px;font-size:11px;font-weight:700;letter-spacing:1.5px;color:#e5b24c;text-transform:uppercase;margin-bottom:10px;">
            Espace Adhérent
          </div>
          <h1 style="margin:0 0 6px;font-size:22px;font-weight:800;letter-spacing:0.5px;color:#ffffff;">
            Bienvenue au Dojo !
          </h1>
          <p style="margin:0;font-size:13px;color:#94a3b8;letter-spacing:1px;text-transform:uppercase;font-weight:600;">
            ${safeClub}
          </p>
        </td>
      </tr>

      <!-- Body Content -->
      <tr>
        <td style="padding:24px;">
          <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#e2e8f0;">
            Bonjour <strong>${safeName}</strong>,
          </p>
          <p style="margin:0 0 20px;font-size:14px;line-height:1.6;color:#cbd5e1;">
            Votre compte adhérent officiel a bien été créé. Vous pouvez désormais commander vos tenues de club, suivre vos réservations et retrouver tous vos reçus PDF en un clic.
          </p>

          <!-- Fiche profil adhérent épurée -->
          <div style="background:#071326;border:1px solid rgba(255,255,255,0.1);border-radius:10px;padding:16px 18px;margin-bottom:24px;">
            <div style="font-size:12px;font-weight:700;color:#e5b24c;letter-spacing:1px;text-transform:uppercase;margin-bottom:12px;border-bottom:1px solid rgba(255,255,255,0.06);padding-bottom:6px;">
              Coordonnées de l'adhérent
            </div>
            <table width="100%" cellpadding="0" cellspacing="0" style="font-size:13px;line-height:1.8;">
              <tr>
                <td style="color:#94a3b8;width:120px;">Email :</td>
                <td style="color:#ffffff;font-weight:600;">${safeEmail}</td>
              </tr>
              <tr>
                <td style="color:#94a3b8;">Téléphone :</td>
                <td style="color:#ffffff;">${safePhone}</td>
              </tr>
              <tr>
                <td style="color:#94a3b8;">Taille Rashguard :</td>
                <td style="color:#e5b24c;font-weight:700;">${safeRash}</td>
              </tr>
              <tr>
                <td style="color:#94a3b8;">Taille Gants :</td>
                <td style="color:#e5b24c;font-weight:700;">${safeGloves}</td>
              </tr>
            </table>
          </div>

          <!-- Bouton Action -->
          <div style="text-align:center;margin-bottom:10px;">
            <a href="${targetUrl}" target="_blank" style="display:inline-block;background:linear-gradient(135deg,#e5b24c 0%,#c99532 100%);color:#071326;font-size:14px;font-weight:800;letter-spacing:0.5px;text-decoration:none;padding:14px 28px;border-radius:8px;box-shadow:0 4px 15px rgba(229,178,76,0.35);">
              🥋 Accéder à la Boutique du Dojo
            </a>
          </div>
        </td>
      </tr>

      <!-- Footer sobre -->
      <tr>
        <td style="padding:16px 24px;background:#061021;border-top:1px solid rgba(255,255,255,0.06);text-align:center;font-size:12px;color:#64748b;line-height:1.5;">
          ${safeClub} — Luta Livre & Grappling<br/>
          Cet email confirme la création de votre compte adhérent.
        </td>
      </tr>
    </table>
  </body>
  </html>
  `;

  const text = [
    `Bienvenue au ${clubName} !`,
    '',
    `Bonjour ${user.name},`,
    'Votre compte adhérent officiel a bien été créé.',
    '',
    'Vos coordonnées enregistrées :',
    `- Email : ${user.email}`,
    `- Téléphone : ${user.phone || 'Non renseigné'}`,
    `- Taille Rashguard favorite : ${user.favoriteRashguardSize || 'M'}`,
    `- Taille Gants favorite : ${user.favoriteGlovesSize || 'L/XL'}`,
    '',
    `Accéder à la boutique : ${targetUrl}`,
    '',
    `${clubName} — Luta Livre & Grappling`
  ].join('\n');

  return { html, text };
}

// ------------------------------------------------------------
// TEMPLATE 2 : CONFIRMATION DE COMMANDE & REÇU OFFICIEL
// ------------------------------------------------------------
function buildOrderConfirmationEmail(order, clubName, siteUrl) {
  const safeClub = escapeHtml(clubName || 'DORAGON DOJO CLUB');
  const safeName = escapeHtml(order.memberName);
  const safeRef = escapeHtml(order.ref);
  const safeDate = escapeHtml(order.dateLabel);
  const safePayment = escapeHtml(order.paymentMethod);
  const safeStatus = escapeHtml(order.paymentStatus || 'Validé');
  const targetUrl = siteUrl || process.env.SITE_URL || 'https://doragon-dojo-boutique.onrender.com';

  const isOnline = safePayment.toLowerCase().includes('en ligne');
  const badgeLabel = isOnline ? 'Paiement Validé (CB)' : 'Réservation Enregistrée';
  const badgeColor = isOnline ? '#10b981' : '#e5b24c';

  const itemsHtml = order.items.map((item) => `
    <tr>
      <td style="padding:10px 12px;border-bottom:1px solid rgba(255,255,255,0.06);color:#f1f5f9;font-weight:600;font-size:13px;">
        ${escapeHtml(item.name)}<br/>
        <span style="font-size:11px;color:#94a3b8;font-weight:400;">Taille : ${escapeHtml(item.size)}</span>
      </td>
      <td style="padding:10px 12px;border-bottom:1px solid rgba(255,255,255,0.06);text-align:center;color:#cbd5e1;font-size:13px;">
        ${item.qty}
      </td>
      <td style="padding:10px 12px;border-bottom:1px solid rgba(255,255,255,0.06);text-align:right;color:#e5b24c;font-weight:700;font-size:13px;">
        ${formatEuro(item.lineTotal)}
      </td>
    </tr>
  `).join('');

  const html = `
  <!DOCTYPE html>
  <html lang="fr">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Commande confirmée</title>
  </head>
  <body style="margin:0;padding:20px;background-color:#071326;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#f1f5f9;">
    <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:#0c1e3d;border:1px solid rgba(229,178,76,0.3);border-radius:14px;overflow:hidden;box-shadow:0 12px 30px rgba(0,0,0,0.4);">
      <!-- Header -->
      <tr>
        <td style="padding:28px 24px 20px;text-align:center;background:linear-gradient(180deg,#0a1832 0%,#0c1e3d 100%);border-bottom:1px solid rgba(255,255,255,0.08);">
          <div style="display:inline-block;padding:4px 12px;background:rgba(255,255,255,0.08);border:1px solid ${badgeColor};border-radius:20px;font-size:11px;font-weight:700;letter-spacing:1px;color:${badgeColor};text-transform:uppercase;margin-bottom:10px;">
            ${badgeLabel}
          </div>
          <h1 style="margin:0 0 6px;font-size:22px;font-weight:800;color:#ffffff;">
            Merci pour votre commande !
          </h1>
          <p style="margin:0;font-size:14px;color:#94a3b8;font-weight:600;">
            Référence : <strong style="color:#ffffff;">${safeRef}</strong> • ${safeDate}
          </p>
        </td>
      </tr>

      <!-- Body Content -->
      <tr>
        <td style="padding:24px;">
          <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#cbd5e1;">
            Bonjour <strong>${safeName}</strong>, votre commande a bien été enregistrée pour retrait direct au dojo.
          </p>

          <!-- Tableau des articles -->
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#071326;border:1px solid rgba(255,255,255,0.08);border-radius:10px;overflow:hidden;margin-bottom:20px;">
            <thead>
              <tr style="background:rgba(255,255,255,0.04);border-bottom:1px solid rgba(255,255,255,0.08);">
                <th style="padding:10px 12px;text-align:left;font-size:11px;text-transform:uppercase;color:#94a3b8;letter-spacing:1px;">Article</th>
                <th style="padding:10px 12px;text-align:center;font-size:11px;text-transform:uppercase;color:#94a3b8;letter-spacing:1px;">Qté</th>
                <th style="padding:10px 12px;text-align:right;font-size:11px;text-transform:uppercase;color:#94a3b8;letter-spacing:1px;">Prix</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
              <tr style="background:rgba(229,178,76,0.06);">
                <td colspan="2" style="padding:12px;font-weight:700;font-size:14px;color:#ffffff;">
                  Total à régler / réglé :
                </td>
                <td style="padding:12px;text-align:right;font-weight:800;font-size:16px;color:#e5b24c;">
                  ${formatEuro(order.total)}
                </td>
              </tr>
            </tbody>
          </table>

          <!-- Informations retrait & règlement -->
          <div style="background:#071326;border-radius:10px;padding:14px 16px;font-size:13px;color:#94a3b8;line-height:1.7;margin-bottom:22px;border-left:3px solid #e5b24c;">
            <div><strong style="color:#ffffff;">Règlement :</strong> ${safePayment} (${safeStatus})</div>
            <div><strong style="color:#ffffff;">Retrait :</strong> Directement au club lors de votre entraînement (Gratuit).</div>
            ${order.memberPhone ? `<div><strong style="color:#ffffff;">Téléphone :</strong> ${escapeHtml(order.memberPhone)}</div>` : ''}
            ${order.memberNote ? `<div><strong style="color:#ffffff;">Remarque :</strong> ${escapeHtml(order.memberNote)}</div>` : ''}
          </div>

          <!-- Bouton Reçu PDF -->
          <div style="text-align:center;margin-bottom:6px;">
            <a href="${targetUrl}" target="_blank" style="display:inline-block;background:linear-gradient(135deg,#e5b24c 0%,#c99532 100%);color:#071326;font-size:14px;font-weight:800;letter-spacing:0.5px;text-decoration:none;padding:12px 26px;border-radius:8px;box-shadow:0 4px 15px rgba(229,178,76,0.3);">
              📄 Retrouver mon Reçu PDF sur mon Compte
            </a>
          </div>
        </td>
      </tr>

      <!-- Footer -->
      <tr>
        <td style="padding:16px 24px;background:#061021;border-top:1px solid rgba(255,255,255,0.06);text-align:center;font-size:12px;color:#64748b;line-height:1.5;">
          ${safeClub} — Luta Livre & Grappling<br/>
          Vos reçus officiels restent archivés dans votre espace adhérent.
        </td>
      </tr>
    </table>
  </body>
  </html>
  `;

  const text = [
    `Merci pour votre commande chez ${clubName} !`,
    '',
    `Référence : ${order.ref}`,
    `Date : ${order.dateLabel}`,
    `Adhérent : ${order.memberName}`,
    `Email : ${order.memberEmail}`,
    order.memberPhone ? `Téléphone : ${order.memberPhone}` : null,
    `Règlement : ${order.paymentMethod} (${order.paymentStatus || 'Validé'})`,
    order.memberNote ? `Remarque : ${order.memberNote}` : null,
    '',
    'Articles commandés :',
    ...order.items.map((i) => `- ${i.qty}x ${i.name} (${i.size}) : ${formatEuro(i.lineTotal)}`),
    '',
    `TOTAL : ${formatEuro(order.total)}`,
    'Retrait direct au club lors de votre prochain entraînement.',
    '',
    `Télécharger votre reçu PDF officiel dans votre espace adhérent : ${targetUrl}`
  ].filter(Boolean).join('\n');

  return { html, text };
}

// ------------------------------------------------------------
// FONCTIONS D'ENVOI PROPRES
// ------------------------------------------------------------
async function sendWelcomeEmail(user, clubName) {
  if (!user || !user.email) return { sent: false, error: 'Email manquant' };
  const effectiveClub = clubName || process.env.CLUB_NAME || 'DORAGON DOJO CLUB';

  if (!isSmtpConfigured()) {
    console.log(`[Mailer] Simulation Bienvenue (SMTP non configuré) pour ${user.email} (${user.name})`);
    return { sent: false, simulated: true };
  }

  try {
    const transporter = createTransporter();
    const { html, text } = buildWelcomeEmail(user, effectiveClub);
    const attachments = fs.existsSync(LOGO_PATH)
      ? [{ filename: 'logo.jpg', path: LOGO_PATH, cid: 'club-logo' }]
      : [];

    await transporter.sendMail({
      from: `"${effectiveClub}" <${process.env.SMTP_USER}>`,
      to: user.email,
      subject: `🥋 Bienvenue au dojo — Votre compte adhérent ${effectiveClub}`,
      text,
      html,
      attachments
    });

    console.log(`[Mailer] Email de bienvenue envoyé avec succès à ${user.email}`);
    return { sent: true };
  } catch (err) {
    console.error(`[Mailer] Erreur envoi bienvenue à ${user.email} :`, err.message);
    return { sent: false, error: err.message };
  }
}

async function sendOrderConfirmationEmail(order, clubName, clubEmail) {
  if (!order || !order.memberEmail) return { sent: false, error: 'Email commande manquant' };
  const effectiveClub = clubName || process.env.CLUB_NAME || 'DORAGON DOJO CLUB';

  if (!isSmtpConfigured()) {
    console.log(`[Mailer] Simulation Confirmation Commande (SMTP non configuré) pour ${order.memberEmail} (${order.ref})`);
    return { sent: false, simulated: true };
  }

  try {
    const transporter = createTransporter();
    const { html, text } = buildOrderConfirmationEmail(order, effectiveClub);
    const attachments = fs.existsSync(LOGO_PATH)
      ? [{ filename: 'logo.jpg', path: LOGO_PATH, cid: 'club-logo' }]
      : [];

    const mailOptions = {
      from: `"${effectiveClub}" <${process.env.SMTP_USER}>`,
      to: order.memberEmail,
      subject: `📄 Confirmation commande ${order.ref} — ${effectiveClub}`,
      text,
      html,
      attachments
    };

    const bccEmail = (clubEmail || process.env.CLUB_EMAIL || '').trim();
    if (bccEmail && bccEmail !== order.memberEmail && !bccEmail.includes('monclub.fr')) {
      mailOptions.bcc = bccEmail;
    }

    await transporter.sendMail(mailOptions);
    console.log(`[Mailer] Email confirmation commande envoyé avec succès à ${order.memberEmail} (${order.ref})`);
    return { sent: true };
  } catch (err) {
    console.error(`[Mailer] Erreur envoi confirmation commande à ${order.memberEmail} :`, err.message);
    return { sent: false, error: err.message };
  }
}

module.exports = {
  isSmtpConfigured,
  buildWelcomeEmail,
  buildOrderConfirmationEmail,
  sendWelcomeEmail,
  sendOrderConfirmationEmail
};
