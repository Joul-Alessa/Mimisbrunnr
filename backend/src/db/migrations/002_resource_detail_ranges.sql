-- Adds range support to resource_detail: a card can cite a page range in a
-- book (page_number..page_number_end) or a time range in a video
-- (timestamp_seconds..timestamp_seconds_end), not just a single point.

ALTER TABLE resource_detail ADD COLUMN page_number_end INTEGER;
ALTER TABLE resource_detail ADD COLUMN timestamp_seconds_end INTEGER;
