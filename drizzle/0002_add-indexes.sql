CREATE INDEX "auto_issue_configs_server_id_idx" ON "auto_issue_configs" USING btree ("server_id");--> statement-breakpoint
CREATE INDEX "auto_issue_configs_role_id_idx" ON "auto_issue_configs" USING btree ("role_id");--> statement-breakpoint
CREATE INDEX "passports_user_id_idx" ON "passports" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "passports_issuer_id_idx" ON "passports" USING btree ("issuer_id");--> statement-breakpoint
CREATE INDEX "passports_user_issuer_idx" ON "passports" USING btree ("user_id","issuer_id");--> statement-breakpoint
CREATE INDEX "server_permissions_server_id_idx" ON "server_permissions" USING btree ("server_id");--> statement-breakpoint
CREATE INDEX "server_permissions_issuer_id_idx" ON "server_permissions" USING btree ("issuer_id");