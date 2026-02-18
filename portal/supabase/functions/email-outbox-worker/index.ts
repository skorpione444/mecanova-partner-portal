// Edge Function: email-outbox-worker
// Processes pending emails from email_outbox table and sends via Resend API
// Production-ready with retry logic, locking, and security

import { createClient } from "jsr:@supabase/supabase-js@2";

const RESEND_API_URL = "https://api.resend.com/emails";
const BATCH_SIZE = 25;
const MAX_RETRY_ATTEMPTS = 10;
const WORKER_ID = `worker-${Date.now()}`;

interface EmailOutboxRow {
  id: string;
  to_email: string;
  template: string;
  subject: string;
  payload: Record<string, any>;
  order_request_id: string;
  attempt_count: number;
  next_retry_at: string | null;
  locked_at: string | null;
  locked_by: string | null;
}

interface ResendResponse {
  id?: string;
  error?: {
    message: string;
    statusCode?: number;
  };
}

/**
 * Calculate next retry time based on attempt count (exponential backoff)
 */
function calculateNextRetry(attemptCount: number): Date {
  const minutes = attemptCount === 0 ? 1
    : attemptCount === 1 ? 5
    : attemptCount === 2 ? 15
    : attemptCount === 3 ? 60
    : 360; // 6 hours for attempt >= 4
  const nextRetry = new Date();
  nextRetry.setMinutes(nextRetry.getMinutes() + minutes);
  return nextRetry;
}

/**
 * Determine if we're in production mode
 */
function isProduction(): boolean {
  const appEnv = Deno.env.get("APP_ENV");
  const nodeEnv = Deno.env.get("NODE_ENV");
  return appEnv === "production" || nodeEnv === "production";
}

Deno.serve(async (req) => {
  try {
    const isProd = isProduction();
    
    // ========================================================================
    // A) Security: CRON_SECRET authentication
    // ========================================================================
    const cronSecret = Deno.env.get("CRON_SECRET");
    const providedSecret = req.headers.get("x-cron-secret");

    if (isProd) {
      // Production: CRON_SECRET is REQUIRED
      if (!cronSecret) {
        console.error("CRON_SECRET not configured in production");
        return new Response(
          JSON.stringify({ error: "Server configuration error" }),
          { status: 500, headers: { "Content-Type": "application/json" } }
        );
      }
      if (!providedSecret || providedSecret !== cronSecret) {
        return new Response(
          JSON.stringify({ error: "Unauthorized" }),
          { status: 401, headers: { "Content-Type": "application/json" } }
        );
      }
    } else {
      // Local/dev: Allow without secret but warn
      if (cronSecret && (!providedSecret || providedSecret !== cronSecret)) {
        console.warn("Local/dev: x-cron-secret header missing or invalid (allowed in dev)");
      }
    }

    // ========================================================================
    // B) Environment variables and DRY_RUN logic
    // ========================================================================
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const portalBaseUrl = Deno.env.get("PORTAL_BASE_URL");
    
    // Determine dryRun from environment
    const dryRunEnv = (Deno.env.get("DRY_RUN") ?? "").toLowerCase();
    let dryRun = dryRunEnv === "true" || dryRunEnv === "1";
    
    // Read Resend environment variables
    const resendKey = Deno.env.get("RESEND_API_KEY") ?? "";
    const resendFrom = Deno.env.get("RESEND_FROM") ?? "";
    const resendReplyTo = Deno.env.get("RESEND_REPLY_TO") ?? "";

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      return new Response(
        JSON.stringify({ error: "Missing Supabase configuration" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    // DRY_RUN logic: strict in production, lenient in local
    if (isProd) {
      // Production: Missing Resend config is a hard error
      if (!dryRun && (resendKey === "" || resendFrom === "")) {
        return new Response(
          JSON.stringify({ 
            error: "Missing Resend configuration",
            details: "RESEND_API_KEY and RESEND_FROM are required in production when DRY_RUN=false"
          }),
          { status: 500, headers: { "Content-Type": "application/json" } }
        );
      }
    } else {
      // Local/dev: Auto-fallback to DRY_RUN if Resend config missing
      if ((resendKey === "" || resendFrom === "") && !dryRun) {
        dryRun = true;
        console.log("Local dev: Resend not configured, DRY_RUN enabled");
      }
    }

    console.log(`Mode: ${isProd ? "PRODUCTION" : "LOCAL/DEV"}, DRY_RUN: ${dryRun}`);

    // ========================================================================
    // C) Query and lock pending emails
    // ========================================================================
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    // First, unlock stale locks (older than 5 minutes)
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    await supabase
      .from("email_outbox")
      .update({ locked_at: null, locked_by: null })
      .lt("locked_at", fiveMinutesAgo);

    // Query for emails ready to process:
    // - status IN ('pending', 'failed')
    // - next_retry_at IS NULL OR next_retry_at <= now()
    // - locked_at IS NULL (or stale, handled above)
    const now = new Date().toISOString();
    const { data: readyEmails, error: queryError } = await supabase
      .from("email_outbox")
      .select("*")
      .in("status", ["pending", "failed"])
      .or(`next_retry_at.is.null,next_retry_at.lte.${now}`)
      .is("locked_at", null)
      .order("created_at", { ascending: true })
      .limit(BATCH_SIZE);

    if (queryError) {
      console.error("Error querying email_outbox:", queryError);
      return new Response(
        JSON.stringify({ error: "Failed to query email_outbox", details: queryError.message }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    if (!readyEmails || readyEmails.length === 0) {
      return new Response(
        JSON.stringify({ processed: 0, sent: 0, failed: 0, dry_run: dryRun }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    // Lock selected rows
    const emailIds = readyEmails.map(e => e.id);
    const { error: lockError } = await supabase
      .from("email_outbox")
      .update({ locked_at: now, locked_by: WORKER_ID })
      .in("id", emailIds);

    if (lockError) {
      console.error("Error locking emails:", lockError);
      return new Response(
        JSON.stringify({ error: "Failed to lock emails", details: lockError.message }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    console.log(`Found ${readyEmails.length} pending emails, locked for processing`);

    // ========================================================================
    // D) Process each email
    // ========================================================================
    let sentCount = 0;
    let failedCount = 0;

    for (const email of readyEmails as EmailOutboxRow[]) {
      try {
        // Build email content
        const emailContent = buildEmailContent(email.template, email.payload, portalBaseUrl);

        if (dryRun) {
          // DRY_RUN mode: Log and mark as sent
          console.log(`[DRY_RUN] Would send email:`, {
            id: email.id,
            to: email.to_email,
            template: email.template,
            subject: email.subject,
          });

          const { error: updateError } = await supabase
            .from("email_outbox")
            .update({
              status: "sent",
              sent_at: new Date().toISOString(),
              last_error: null,
              locked_at: null,
              locked_by: null,
            })
            .eq("id", email.id);

          if (updateError) {
            console.error(`Error updating email ${email.id} to sent:`, updateError);
          } else {
            console.log(`Marked sent: ${email.id}`);
            sentCount++;
          }
        } else {
          // Production mode: Send via Resend
          if (resendKey === "" || resendFrom === "") {
            throw new Error("Resend configuration missing");
          }

          const resendBody: any = {
            from: resendFrom,
            to: email.to_email,
            subject: email.subject,
            html: emailContent.html,
            text: emailContent.text,
          };

          if (resendReplyTo) {
            resendBody.reply_to = resendReplyTo;
          }

          const resendResponse = await fetch(RESEND_API_URL, {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${resendKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(resendBody),
          });

          const resendData: ResendResponse = await resendResponse.json();

          if (!resendResponse.ok || resendData.error) {
            throw new Error(resendData.error?.message || `Resend API error: ${resendResponse.status}`);
          }

          console.log(`Sent via Resend: ${email.id} (attempt ${email.attempt_count + 1})`);

          // Mark as sent
          const { error: updateError } = await supabase
            .from("email_outbox")
            .update({
              status: "sent",
              sent_at: new Date().toISOString(),
              last_error: null,
              locked_at: null,
              locked_by: null,
            })
            .eq("id", email.id);

          if (updateError) {
            console.error(`Error updating email ${email.id} to sent:`, updateError);
          } else {
            console.log(`Marked sent: ${email.id}`);
            sentCount++;
          }
        }
      } catch (error) {
        // Handle failure with retry logic
        const errorMessage = error instanceof Error ? error.message : String(error);
        const truncatedError = errorMessage.substring(0, 1000);
        const newAttemptCount = (email.attempt_count || 0) + 1;

        if (newAttemptCount >= MAX_RETRY_ATTEMPTS) {
          // Max attempts reached - mark as permanently failed
          const { error: updateError } = await supabase
            .from("email_outbox")
            .update({
              status: "failed",
              last_error: truncatedError,
              attempt_count: newAttemptCount,
              locked_at: null,
              locked_by: null,
              next_retry_at: null, // Stop retrying
            })
            .eq("id", email.id);

          if (updateError) {
            console.error(`Error updating email ${email.id} to failed:`, updateError);
          } else {
            console.log(`Marked permanently failed: ${email.id} (${newAttemptCount} attempts)`);
          }
          failedCount++;
        } else {
          // Schedule retry
          const nextRetry = calculateNextRetry(newAttemptCount);
          const { error: updateError } = await supabase
            .from("email_outbox")
            .update({
              status: "failed",
              last_error: truncatedError,
              attempt_count: newAttemptCount,
              next_retry_at: nextRetry.toISOString(),
              locked_at: null,
              locked_by: null,
            })
            .eq("id", email.id);

          if (updateError) {
            console.error(`Error scheduling retry for email ${email.id}:`, updateError);
          } else {
            console.log(`Scheduled retry for ${email.id}: attempt ${newAttemptCount}, next retry at ${nextRetry.toISOString()}`);
          }
          failedCount++;
        }
      }
    }

    return new Response(
      JSON.stringify({
        processed: readyEmails.length,
        sent: sentCount,
        failed: failedCount,
        dry_run: dryRun,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Unexpected error in email-outbox-worker:", error);
    return new Response(
      JSON.stringify({
        error: "Internal server error",
        details: error instanceof Error ? error.message : String(error),
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});

/**
 * Build professional email content based on template and payload
 */
function buildEmailContent(
  template: string,
  payload: Record<string, any>,
  portalBaseUrl?: string
): { html: string; text: string } {
  const orderId = payload.order_request_id;
  const status = payload.status || "unknown";
  const orderUrl = portalBaseUrl
    ? `${portalBaseUrl}/dashboard/orders/${orderId}`
    : `#${orderId}`;

  let html = "";
  let text = "";

  switch (template) {
    case "order_submitted_to_distributor":
      html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background-color: #f8f9fa; border-radius: 8px; padding: 30px; margin-bottom: 20px;">
    <h1 style="color: #2c3e50; margin-top: 0;">New Order Submitted</h1>
    <p style="font-size: 16px;">A new order has been submitted and requires your attention.</p>
  </div>
  
  <div style="background-color: #ffffff; border: 1px solid #e0e0e0; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
    <h2 style="color: #2c3e50; margin-top: 0; font-size: 18px;">Order Details</h2>
    <p style="margin: 10px 0;"><strong>Order ID:</strong> <code style="background-color: #f4f4f4; padding: 2px 6px; border-radius: 3px;">${orderId}</code></p>
    <p style="margin: 10px 0;"><strong>Status:</strong> ${status}</p>
  </div>
  
  <div style="text-align: center; margin-top: 30px;">
    <a href="${orderUrl}" style="display: inline-block; background-color: #007bff; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 5px; font-weight: 500;">View Order in Portal</a>
  </div>
  
  <p style="color: #666; font-size: 14px; margin-top: 30px; text-align: center;">This is an automated notification from Mecanova Partner Portal</p>
</body>
</html>`;
      text = `New Order Submitted

A new order has been submitted and requires your attention.

Order Details:
Order ID: ${orderId}
Status: ${status}

View Order: ${orderUrl}

---
This is an automated notification from Mecanova Partner Portal`;
      break;

    case "order_accepted_to_client":
      html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background-color: #d4edda; border-radius: 8px; padding: 30px; margin-bottom: 20px;">
    <h1 style="color: #155724; margin-top: 0;">Order Accepted ✓</h1>
    <p style="font-size: 16px; color: #155724;">Great news! Your order has been accepted.</p>
  </div>
  
  <div style="background-color: #ffffff; border: 1px solid #e0e0e0; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
    <h2 style="color: #2c3e50; margin-top: 0; font-size: 18px;">Order Details</h2>
    <p style="margin: 10px 0;"><strong>Order ID:</strong> <code style="background-color: #f4f4f4; padding: 2px 6px; border-radius: 3px;">${orderId}</code></p>
    <p style="margin: 10px 0;"><strong>Status:</strong> <span style="color: #28a745; font-weight: 500;">${status}</span></p>
  </div>
  
  <div style="text-align: center; margin-top: 30px;">
    <a href="${orderUrl}" style="display: inline-block; background-color: #28a745; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 5px; font-weight: 500;">View Order in Portal</a>
  </div>
  
  <p style="color: #666; font-size: 14px; margin-top: 30px; text-align: center;">This is an automated notification from Mecanova Partner Portal</p>
</body>
</html>`;
      text = `Order Accepted ✓

Great news! Your order has been accepted.

Order Details:
Order ID: ${orderId}
Status: ${status}

View Order: ${orderUrl}

---
This is an automated notification from Mecanova Partner Portal`;
      break;

    case "order_rejected_to_client":
      html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background-color: #f8d7da; border-radius: 8px; padding: 30px; margin-bottom: 20px;">
    <h1 style="color: #721c24; margin-top: 0;">Order Rejected</h1>
    <p style="font-size: 16px; color: #721c24;">Unfortunately, your order has been rejected.</p>
  </div>
  
  <div style="background-color: #ffffff; border: 1px solid #e0e0e0; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
    <h2 style="color: #2c3e50; margin-top: 0; font-size: 18px;">Order Details</h2>
    <p style="margin: 10px 0;"><strong>Order ID:</strong> <code style="background-color: #f4f4f4; padding: 2px 6px; border-radius: 3px;">${orderId}</code></p>
    <p style="margin: 10px 0;"><strong>Status:</strong> <span style="color: #dc3545; font-weight: 500;">${status}</span></p>
  </div>
  
  <div style="text-align: center; margin-top: 30px;">
    <a href="${orderUrl}" style="display: inline-block; background-color: #6c757d; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 5px; font-weight: 500;">View Order in Portal</a>
  </div>
  
  <p style="color: #666; font-size: 14px; margin-top: 30px; text-align: center;">This is an automated notification from Mecanova Partner Portal</p>
</body>
</html>`;
      text = `Order Rejected

Unfortunately, your order has been rejected.

Order Details:
Order ID: ${orderId}
Status: ${status}

View Order: ${orderUrl}

---
This is an automated notification from Mecanova Partner Portal`;
      break;

    default:
      html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <p>Order status update for Order ID: ${orderId}</p>
  <p><a href="${orderUrl}">View Order in Portal</a></p>
</body>
</html>`;
      text = `Order status update for Order ID: ${orderId}\nView Order: ${orderUrl}`;
  }

  return { html, text };
}
