-- Seed German city coordinates for test partners
-- Assigns each partner without coordinates a real German city location (with a small random offset)

WITH german_cities(city_lat, city_lng, rn) AS (
  VALUES
    (52.5200, 13.4050, 0),  -- Berlin
    (48.1351, 11.5820, 1),  -- Munich
    (53.5753,  9.9948, 2),  -- Hamburg
    (50.9333,  6.9500, 3),  -- Cologne
    (50.1109,  8.6821, 4),  -- Frankfurt
    (48.7758,  9.1829, 5),  -- Stuttgart
    (51.2217,  6.7762, 6),  -- Düsseldorf
    (51.3397, 12.3731, 7),  -- Leipzig
    (51.0504, 13.7373, 8),  -- Dresden
    (49.4521, 11.0767, 9),  -- Nuremberg
    (52.3759,  9.7320, 10), -- Hannover
    (53.0793,  8.8017, 11)  -- Bremen
),
ranked_partners AS (
  SELECT id, (ROW_NUMBER() OVER (ORDER BY created_at) - 1) AS rn
  FROM partners
  WHERE lat IS NULL
)
UPDATE partners p
SET
  lat = c.city_lat + (RANDOM() * 0.04 - 0.02),
  lng = c.city_lng + (RANDOM() * 0.06 - 0.03)
FROM ranked_partners rp
JOIN german_cities c ON (rp.rn % 12) = c.rn
WHERE p.id = rp.id;
