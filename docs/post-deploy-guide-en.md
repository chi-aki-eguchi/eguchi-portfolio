# Portfolio Kit: Quick Setup Guide

This is the short English guide for publishing your Portfolio Kit after purchase.
No programming knowledge is required. Allow about 10–15 minutes, including a few
minutes while Railway prepares the site.

> Keep the Deploy link from your purchase email private. It is for the buyer only
> and should not be posted on a public page or shared as a general template link.

## Before you begin

- Use a computer if possible; the Railway setup screen is easier to read there.
- Sign in to Railway. You can use a GitHub account to sign in.
- Choose an admin password with at least eight characters and keep it somewhere
  safe. This is the only setup value you need to enter.

Railway is the separate service that hosts the site. Its prices can change and are
based on usage. If it asks for a payment card while activating hosting, that is an
expected part of its setup. Ask before continuing if the cost is unclear.

## Publish the site

1. Open the private Deploy link from your purchase email.
2. On the screen labelled **2 services and 1 bucket**, find
   **eguchi-portfolio-app** and select **Configure**. Enter your password in
   **ADMIN_PASSWORD**, then select **Save Config**. Do not change the other values.
3. Select **Deploy**. Wait until **eguchi-portfolio-app** and **Postgres** show
   **Online**. A Bucket marked **empty** is normal before photographs are added.
4. Open **eguchi-portfolio-app**, select **Settings**, scroll to **Networking**,
   and select **Generate Domain**. The new `xxxx.up.railway.app` address is your
   public site URL; save it somewhere easy to find.
5. Open the public URL. An empty portfolio is normal at this point. Add
   `/admin/login` to the end of the address and sign in with ADMIN_PASSWORD.
6. Open the Japanese **「はじめに」** screen (Getting started). Add the site name,
   profile and contact details, then upload one photograph and confirm that it
   appears on the public site.

## Admin language and support

The admin panel is currently Japanese-first; an English admin UI is in progress.
Support is provided in Japanese and simple English. The English purchase start
page is <https://akieguchi.com/start/en>.

## If something stops

- **Deploy is disabled:** confirm that ADMIN_PASSWORD was entered under Configure
  and that you selected Save Config.
- **The public URL is missing:** use eguchi-portfolio-app → Settings → Networking
  → Generate Domain. Do not look for it inside Postgres or Bucket.
- **The site does not open yet:** wait one or two minutes, then reload. Railway may
  still be starting the app.
- **ADMIN_PASSWORD is reported missing:** open eguchi-portfolio-app → Variables,
  add the password, save it, and wait for the new deployment to return Online.
- **You need help:** send screenshots of the Railway project overview and the
  eguchi-portfolio-app Logs screen. If you show Variables, include names only and
  hide every password, access key, and secret value.

Do not keep changing unrelated settings after an error. A screenshot of the exact
message is usually the fastest way to solve it.
