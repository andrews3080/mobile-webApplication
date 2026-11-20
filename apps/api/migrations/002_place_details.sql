-- Town, community or landmark in the reporter's own words. Seen by officers only:
-- the public tracking page shows the district ("area") and nothing more precise.
ALTER TABLE reports ADD COLUMN place_details text;
ALTER TABLE reports ADD CONSTRAINT reports_place_details_length CHECK (place_details IS NULL OR length(place_details) <= 200);
