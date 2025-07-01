CREATE TABLE "auto_issue_configs" (
	"id" text PRIMARY KEY NOT NULL,
	"server_id" text NOT NULL,
	"role_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"created_by" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "passports" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"issuer_id" text NOT NULL,
	"issued_at" timestamp DEFAULT now() NOT NULL,
	"issued_by" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "server_permissions" (
	"id" text PRIMARY KEY NOT NULL,
	"server_id" text NOT NULL,
	"issuer_id" text NOT NULL,
	"role_id" text,
	"added_at" timestamp DEFAULT now() NOT NULL,
	"added_by" text NOT NULL
);
