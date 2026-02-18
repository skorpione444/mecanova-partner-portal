drop extension if exists "pg_net";

drop trigger if exists "trigger_enqueue_order_emails" on "public"."order_requests";

drop policy "Service role can manage email_outbox" on "public"."email_outbox";

revoke delete on table "public"."email_outbox" from "anon";

revoke insert on table "public"."email_outbox" from "anon";

revoke references on table "public"."email_outbox" from "anon";

revoke select on table "public"."email_outbox" from "anon";

revoke trigger on table "public"."email_outbox" from "anon";

revoke truncate on table "public"."email_outbox" from "anon";

revoke update on table "public"."email_outbox" from "anon";

revoke delete on table "public"."email_outbox" from "authenticated";

revoke insert on table "public"."email_outbox" from "authenticated";

revoke references on table "public"."email_outbox" from "authenticated";

revoke select on table "public"."email_outbox" from "authenticated";

revoke trigger on table "public"."email_outbox" from "authenticated";

revoke truncate on table "public"."email_outbox" from "authenticated";

revoke update on table "public"."email_outbox" from "authenticated";

revoke delete on table "public"."email_outbox" from "service_role";

revoke insert on table "public"."email_outbox" from "service_role";

revoke references on table "public"."email_outbox" from "service_role";

revoke select on table "public"."email_outbox" from "service_role";

revoke trigger on table "public"."email_outbox" from "service_role";

revoke truncate on table "public"."email_outbox" from "service_role";

revoke update on table "public"."email_outbox" from "service_role";

alter table "public"."email_outbox" drop constraint "email_outbox_order_request_id_fkey";

alter table "public"."email_outbox" drop constraint "email_outbox_status_check";

drop function if exists "public"."enqueue_order_emails"();

alter table "public"."email_outbox" drop constraint "email_outbox_pkey";

drop index if exists "public"."email_outbox_pkey";

drop index if exists "public"."idx_email_outbox_order_request_id";

drop index if exists "public"."idx_email_outbox_retry";

drop index if exists "public"."idx_email_outbox_status_created_at";

drop table "public"."email_outbox";


