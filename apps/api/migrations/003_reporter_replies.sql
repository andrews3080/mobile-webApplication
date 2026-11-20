-- Answers an anonymous reporter gives on the tracking page to an officer's question
CREATE TABLE reporter_replies (
  reference  text NOT NULL REFERENCES reports (reference),
  seq        integer NOT NULL,
  answer     text NOT NULL CHECK (length(answer) BETWEEN 1 AND 1000),
  at         timestamptz NOT NULL,
  PRIMARY KEY (reference, seq)
);
