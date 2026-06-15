-- Novas categorias de rolê/evento, ancoradas em clusters ricos do Google Places
-- (CAFE: cafeterias/docerias; COMEDY: comédia/stand-up; MARKETS: feiras/mercados).
-- ADD VALUE é aditivo e idempotente; não usa os valores na mesma transação.
ALTER TYPE "EventCategory" ADD VALUE IF NOT EXISTS 'CAFE';
ALTER TYPE "EventCategory" ADD VALUE IF NOT EXISTS 'COMEDY';
ALTER TYPE "EventCategory" ADD VALUE IF NOT EXISTS 'MARKETS';
