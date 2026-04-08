-- CRM Enums
-- Defines the core enum types for the CRM map system

CREATE TYPE crm_status_enum AS ENUM (
  'uncontacted',
  'contacted',
  'negotiating',
  'customer',
  'inactive'
);

CREATE TYPE venue_type_enum AS ENUM (
  'bar',
  'restaurant',
  'hotel',
  'wholesaler',
  'private_customer',
  'other'
);

CREATE TYPE crm_interaction_type_enum AS ENUM (
  'email',
  'call',
  'meeting',
  'note',
  'file'
);
