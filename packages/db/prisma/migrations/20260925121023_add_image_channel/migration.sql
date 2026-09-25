-- AlterEnum
ALTER TYPE "Channel" ADD VALUE 'IMAGE';

-- DropForeignKey
ALTER TABLE "audit_log" DROP CONSTRAINT "audit_log_trip_id_fkey";

-- DropForeignKey
ALTER TABLE "briefing_generation" DROP CONSTRAINT "briefing_generation_trip_id_fkey";

-- DropForeignKey
ALTER TABLE "budget" DROP CONSTRAINT "budget_trip_id_fkey";

-- DropForeignKey
ALTER TABLE "channel_binding" DROP CONSTRAINT "channel_binding_traveler_id_fkey";

-- DropForeignKey
ALTER TABLE "conflict" DROP CONSTRAINT "conflict_trip_id_fkey";

-- DropForeignKey
ALTER TABLE "connection" DROP CONSTRAINT "connection_from_segment_id_fkey";

-- DropForeignKey
ALTER TABLE "connection" DROP CONSTRAINT "connection_to_segment_id_fkey";

-- DropForeignKey
ALTER TABLE "connection" DROP CONSTRAINT "connection_trip_id_fkey";

-- DropForeignKey
ALTER TABLE "consent" DROP CONSTRAINT "consent_traveler_id_fkey";

-- DropForeignKey
ALTER TABLE "consent" DROP CONSTRAINT "consent_trip_id_fkey";

-- DropForeignKey
ALTER TABLE "document" DROP CONSTRAINT "document_segment_id_fkey";

-- DropForeignKey
ALTER TABLE "document" DROP CONSTRAINT "document_trip_id_fkey";

-- DropForeignKey
ALTER TABLE "event_log" DROP CONSTRAINT "event_log_trip_id_fkey";

-- DropForeignKey
ALTER TABLE "expense" DROP CONSTRAINT "expense_group_trip_id_fkey";

-- DropForeignKey
ALTER TABLE "expense" DROP CONSTRAINT "expense_traveler_id_fkey";

-- DropForeignKey
ALTER TABLE "expense" DROP CONSTRAINT "expense_trip_id_fkey";

-- DropForeignKey
ALTER TABLE "group_trip" DROP CONSTRAINT "group_trip_owner_traveler_id_fkey";

-- DropForeignKey
ALTER TABLE "group_trip" DROP CONSTRAINT "group_trip_trip_id_fkey";

-- DropForeignKey
ALTER TABLE "group_trip_participant" DROP CONSTRAINT "group_trip_participant_group_trip_id_fkey";

-- DropForeignKey
ALTER TABLE "group_trip_participant" DROP CONSTRAINT "group_trip_participant_traveler_id_fkey";

-- DropForeignKey
ALTER TABLE "ingestion_record" DROP CONSTRAINT "ingestion_record_document_id_fkey";

-- DropForeignKey
ALTER TABLE "ingestion_record" DROP CONSTRAINT "ingestion_record_traveler_id_fkey";

-- DropForeignKey
ALTER TABLE "ingestion_record" DROP CONSTRAINT "ingestion_record_trip_id_fkey";

-- DropForeignKey
ALTER TABLE "notification_delivery" DROP CONSTRAINT "notification_delivery_briefing_generation_id_fkey";

-- DropForeignKey
ALTER TABLE "notification_delivery" DROP CONSTRAINT "notification_delivery_trip_id_fkey";

-- DropForeignKey
ALTER TABLE "preference_set" DROP CONSTRAINT "preference_set_traveler_id_fkey";

-- DropForeignKey
ALTER TABLE "preference_set" DROP CONSTRAINT "preference_set_trip_id_fkey";

-- DropForeignKey
ALTER TABLE "referral_click" DROP CONSTRAINT "referral_click_trip_id_fkey";

-- DropForeignKey
ALTER TABLE "safety_checkin" DROP CONSTRAINT "safety_checkin_traveler_id_fkey";

-- DropForeignKey
ALTER TABLE "safety_checkin" DROP CONSTRAINT "safety_checkin_trip_id_fkey";

-- DropForeignKey
ALTER TABLE "segment" DROP CONSTRAINT "segment_trip_id_fkey";

-- DropForeignKey
ALTER TABLE "trip" DROP CONSTRAINT "trip_owner_traveler_id_fkey";

-- DropForeignKey
ALTER TABLE "trusted_contact" DROP CONSTRAINT "trusted_contact_traveler_id_fkey";

-- AlterTable
ALTER TABLE "audit_log" ALTER COLUMN "audit_id" DROP DEFAULT,
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "briefing_generation" ALTER COLUMN "briefing_generation_id" DROP DEFAULT,
ALTER COLUMN "travel_date" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "generated_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "budget" ALTER COLUMN "budget_id" DROP DEFAULT,
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updated_at" DROP DEFAULT,
ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "channel_binding" ALTER COLUMN "channel_binding_id" DROP DEFAULT,
ALTER COLUMN "expires_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updated_at" DROP DEFAULT,
ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "conflict" ALTER COLUMN "conflict_id" DROP DEFAULT,
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updated_at" DROP DEFAULT,
ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "detected_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "reviewed_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "resolved_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "connection" ALTER COLUMN "connection_id" DROP DEFAULT,
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updated_at" DROP DEFAULT,
ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "consent" ALTER COLUMN "consent_id" DROP DEFAULT,
ALTER COLUMN "granted_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "withdrawn_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updated_at" DROP DEFAULT,
ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "dedup_decision" ALTER COLUMN "dedup_decision_id" DROP DEFAULT,
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "document" ALTER COLUMN "document_id" DROP DEFAULT,
ALTER COLUMN "received_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "legal_hold_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updated_at" DROP DEFAULT,
ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "event_log" ALTER COLUMN "event_id" DROP DEFAULT,
ALTER COLUMN "occurred_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "expense" ALTER COLUMN "expense_id" DROP DEFAULT,
ALTER COLUMN "incurred_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "confirmed_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updated_at" DROP DEFAULT,
ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "field_provenance" ALTER COLUMN "provenance_id" DROP DEFAULT,
ALTER COLUMN "recorded_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "group_trip" ALTER COLUMN "group_trip_id" DROP DEFAULT,
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updated_at" DROP DEFAULT,
ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "group_trip_participant" ALTER COLUMN "joined_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "left_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "idempotency_record" ALTER COLUMN "idempotency_id" DROP DEFAULT,
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updated_at" DROP DEFAULT,
ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "ingestion_record" ALTER COLUMN "ingestion_id" DROP DEFAULT,
ALTER COLUMN "received_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updated_at" DROP DEFAULT,
ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "notification_delivery" ALTER COLUMN "notification_delivery_id" DROP DEFAULT,
ALTER COLUMN "attempted_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "delivered_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "outbox_event" ALTER COLUMN "outbox_id" DROP DEFAULT,
ALTER COLUMN "available_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "published_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "preference_set" ALTER COLUMN "preference_set_id" DROP DEFAULT,
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updated_at" DROP DEFAULT,
ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "referral_click" ALTER COLUMN "referral_click_id" DROP DEFAULT,
ALTER COLUMN "clicked_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "safety_checkin" ALTER COLUMN "safety_checkin_id" DROP DEFAULT,
ALTER COLUMN "shared_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "segment" ALTER COLUMN "segment_id" DROP DEFAULT,
ALTER COLUMN "departure_utc" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "arrival_utc" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updated_at" DROP DEFAULT,
ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "source_candidate" ALTER COLUMN "candidate_id" DROP DEFAULT,
ALTER COLUMN "extracted_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "traveler" ALTER COLUMN "traveler_id" DROP DEFAULT,
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updated_at" DROP DEFAULT,
ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "trip" ALTER COLUMN "trip_id" DROP DEFAULT,
ALTER COLUMN "start_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "end_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "last_briefing_generated_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updated_at" DROP DEFAULT,
ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "trusted_contact" ALTER COLUMN "trusted_contact_id" DROP DEFAULT,
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updated_at" DROP DEFAULT,
ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "validation_result" ALTER COLUMN "validation_id" DROP DEFAULT,
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3);

-- AddForeignKey
ALTER TABLE "trip" ADD CONSTRAINT "trip_owner_traveler_id_fkey" FOREIGN KEY ("owner_traveler_id") REFERENCES "traveler"("traveler_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "group_trip" ADD CONSTRAINT "group_trip_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "trip"("trip_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "group_trip" ADD CONSTRAINT "group_trip_owner_traveler_id_fkey" FOREIGN KEY ("owner_traveler_id") REFERENCES "traveler"("traveler_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "group_trip_participant" ADD CONSTRAINT "group_trip_participant_group_trip_id_fkey" FOREIGN KEY ("group_trip_id") REFERENCES "group_trip"("group_trip_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "group_trip_participant" ADD CONSTRAINT "group_trip_participant_traveler_id_fkey" FOREIGN KEY ("traveler_id") REFERENCES "traveler"("traveler_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trusted_contact" ADD CONSTRAINT "trusted_contact_traveler_id_fkey" FOREIGN KEY ("traveler_id") REFERENCES "traveler"("traveler_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "safety_checkin" ADD CONSTRAINT "safety_checkin_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "trip"("trip_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "safety_checkin" ADD CONSTRAINT "safety_checkin_traveler_id_fkey" FOREIGN KEY ("traveler_id") REFERENCES "traveler"("traveler_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "segment" ADD CONSTRAINT "segment_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "trip"("trip_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "connection" ADD CONSTRAINT "connection_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "trip"("trip_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "connection" ADD CONSTRAINT "connection_from_segment_id_fkey" FOREIGN KEY ("from_segment_id") REFERENCES "segment"("segment_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "connection" ADD CONSTRAINT "connection_to_segment_id_fkey" FOREIGN KEY ("to_segment_id") REFERENCES "segment"("segment_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document" ADD CONSTRAINT "document_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "trip"("trip_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document" ADD CONSTRAINT "document_segment_id_fkey" FOREIGN KEY ("segment_id") REFERENCES "segment"("segment_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budget" ADD CONSTRAINT "budget_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "trip"("trip_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expense" ADD CONSTRAINT "expense_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "trip"("trip_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expense" ADD CONSTRAINT "expense_traveler_id_fkey" FOREIGN KEY ("traveler_id") REFERENCES "traveler"("traveler_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expense" ADD CONSTRAINT "expense_group_trip_id_fkey" FOREIGN KEY ("group_trip_id") REFERENCES "group_trip"("group_trip_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "preference_set" ADD CONSTRAINT "preference_set_traveler_id_fkey" FOREIGN KEY ("traveler_id") REFERENCES "traveler"("traveler_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "preference_set" ADD CONSTRAINT "preference_set_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "trip"("trip_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conflict" ADD CONSTRAINT "conflict_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "trip"("trip_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consent" ADD CONSTRAINT "consent_traveler_id_fkey" FOREIGN KEY ("traveler_id") REFERENCES "traveler"("traveler_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consent" ADD CONSTRAINT "consent_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "trip"("trip_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ingestion_record" ADD CONSTRAINT "ingestion_record_traveler_id_fkey" FOREIGN KEY ("traveler_id") REFERENCES "traveler"("traveler_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ingestion_record" ADD CONSTRAINT "ingestion_record_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "document"("document_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ingestion_record" ADD CONSTRAINT "ingestion_record_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "trip"("trip_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "source_candidate" ADD CONSTRAINT "source_candidate_ingestion_id_fkey" FOREIGN KEY ("ingestion_id") REFERENCES "ingestion_record"("ingestion_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "validation_result" ADD CONSTRAINT "validation_result_ingestion_id_fkey" FOREIGN KEY ("ingestion_id") REFERENCES "ingestion_record"("ingestion_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dedup_decision" ADD CONSTRAINT "dedup_decision_ingestion_id_fkey" FOREIGN KEY ("ingestion_id") REFERENCES "ingestion_record"("ingestion_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_log" ADD CONSTRAINT "event_log_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "trip"("trip_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "briefing_generation" ADD CONSTRAINT "briefing_generation_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "trip"("trip_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_delivery" ADD CONSTRAINT "notification_delivery_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "trip"("trip_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_delivery" ADD CONSTRAINT "notification_delivery_briefing_generation_id_fkey" FOREIGN KEY ("briefing_generation_id") REFERENCES "briefing_generation"("briefing_generation_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "trip"("trip_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referral_click" ADD CONSTRAINT "referral_click_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "trip"("trip_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "channel_binding" ADD CONSTRAINT "channel_binding_traveler_id_fkey" FOREIGN KEY ("traveler_id") REFERENCES "traveler"("traveler_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "audit_tenant_idx" RENAME TO "audit_log_tenant_id_created_at_idx";

-- RenameIndex
ALTER INDEX "briefing_trip_date_idx" RENAME TO "briefing_generation_tenant_id_trip_id_travel_date_idx";

-- RenameIndex
ALTER INDEX "budget_trip_idx" RENAME TO "budget_tenant_id_trip_id_idx";

-- RenameIndex
ALTER INDEX "conflict_trip_status_idx" RENAME TO "conflict_tenant_id_trip_id_status_idx";

-- RenameIndex
ALTER INDEX "connection_trip_idx" RENAME TO "connection_tenant_id_trip_id_idx";

-- RenameIndex
ALTER INDEX "consent_idx" RENAME TO "consent_tenant_id_traveler_id_consent_type_status_idx";

-- RenameIndex
ALTER INDEX "dedup_ingestion_idx" RENAME TO "dedup_decision_tenant_id_ingestion_id_idx";

-- RenameIndex
ALTER INDEX "document_trip_retention_idx" RENAME TO "document_tenant_id_trip_id_retention_state_idx";

-- RenameIndex
ALTER INDEX "event_name_time_idx" RENAME TO "event_log_tenant_id_event_name_occurred_at_idx";

-- RenameIndex
ALTER INDEX "event_trip_time_idx" RENAME TO "event_log_tenant_id_trip_id_occurred_at_idx";

-- RenameIndex
ALTER INDEX "expense_trip_category_idx" RENAME TO "expense_tenant_id_trip_id_category_idx";

-- RenameIndex
ALTER INDEX "expense_trip_time_idx" RENAME TO "expense_tenant_id_trip_id_incurred_at_idx";

-- RenameIndex
ALTER INDEX "provenance_entity_idx" RENAME TO "field_provenance_tenant_id_entity_type_entity_id_field_name_idx";

-- RenameIndex
ALTER INDEX "group_trip_tenant_idx" RENAME TO "group_trip_tenant_id_trip_id_idx";

-- RenameIndex
ALTER INDEX "idempotency_tenant_idx" RENAME TO "idempotency_record_tenant_id_created_at_idx";

-- RenameIndex
ALTER INDEX "ingestion_received_idx" RENAME TO "ingestion_record_tenant_id_received_at_idx";

-- RenameIndex
ALTER INDEX "ingestion_state_idx" RENAME TO "ingestion_record_tenant_id_product_state_idx";

-- RenameIndex
ALTER INDEX "notification_trip_idx" RENAME TO "notification_delivery_tenant_id_trip_id_attempted_at_idx";

-- RenameIndex
ALTER INDEX "outbox_publish_idx" RENAME TO "outbox_event_published_at_available_at_created_at_idx";

-- RenameIndex
ALTER INDEX "preference_traveler_idx" RENAME TO "preference_set_tenant_id_traveler_id_scope_idx";

-- RenameIndex
ALTER INDEX "preference_trip_idx" RENAME TO "preference_set_tenant_id_trip_id_scope_idx";

-- RenameIndex
ALTER INDEX "referral_trip_idx" RENAME TO "referral_click_tenant_id_trip_id_clicked_at_idx";

-- RenameIndex
ALTER INDEX "safety_checkin_idx" RENAME TO "safety_checkin_tenant_id_trip_id_shared_at_idx";

-- RenameIndex
ALTER INDEX "segment_booking_idx" RENAME TO "segment_tenant_id_supplier_name_booking_reference_idx";

-- RenameIndex
ALTER INDEX "segment_trip_departure_idx" RENAME TO "segment_tenant_id_trip_id_departure_utc_idx";

-- RenameIndex
ALTER INDEX "segment_trip_status_idx" RENAME TO "segment_tenant_id_trip_id_status_idx";

-- RenameIndex
ALTER INDEX "candidate_ingestion_idx" RENAME TO "source_candidate_tenant_id_ingestion_id_idx";

-- RenameIndex
ALTER INDEX "traveler_email_idx" RENAME TO "traveler_tenant_id_email_idx";

-- RenameIndex
ALTER INDEX "traveler_phone_idx" RENAME TO "traveler_tenant_id_phone_idx";

-- RenameIndex
ALTER INDEX "traveler_tenant_idx" RENAME TO "traveler_tenant_id_idx";

-- RenameIndex
ALTER INDEX "trip_owner_idx" RENAME TO "trip_tenant_id_owner_traveler_id_status_idx";

-- RenameIndex
ALTER INDEX "trip_time_idx" RENAME TO "trip_tenant_id_start_at_end_at_idx";

-- RenameIndex
ALTER INDEX "trusted_contact_idx" RENAME TO "trusted_contact_tenant_id_traveler_id_idx";

-- RenameIndex
ALTER INDEX "validation_ingestion_idx" RENAME TO "validation_result_tenant_id_ingestion_id_idx";
