-- Drop old unique report indexes (replaced by regular indexes in the next migration)
DROP INDEX IF EXISTS "reports_reporter_event_status_unique";
DROP INDEX IF EXISTS "reports_reporter_comment_status_unique";
