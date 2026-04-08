alter table order_request_items
  add column if not exists price_per_case numeric(10, 2);
