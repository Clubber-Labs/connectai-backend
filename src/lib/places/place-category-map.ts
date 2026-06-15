import type { EventCategory } from '../event-categories'

// Mapa categoria de rolê -> tipos do Google Places (New), usados como
// includedTypes na busca. Ancorado na taxonomia REAL do Places (tipos validados
// contra a API). Partição limpa: cada tipo do Places tem UM dono (ver o reverso),
// então todo candidato volta rotulado na categoria certa, sem ambiguidade.
//
// Categorias sem equivalente social no Places ficam órfãs de propósito (TECH,
// BUSINESS, VOLUNTEERING, OTHER) — o service barra com 400 quando TODAS as
// preferências caem aqui. RELIGION é legado (não selecionável); mantida só por
// completude de tipo e para rotular dado antigo.
const CATEGORY_TO_PLACE_TYPES: Record<EventCategory, string[]> = {
  // Vida noturna repartida em 3 preferências distintas:
  PARTY: ['night_club', 'dance_hall'], // balada / dançar
  NIGHTLIFE: ['bar', 'pub', 'wine_bar'], // beber / sair à noite
  MUSIC: ['concert_hall', 'karaoke', 'amphitheatre'], // show / música ao vivo

  GASTRONOMY: [
    'restaurant',
    'bar_and_grill',
    'fast_food_restaurant',
    'meal_takeaway',
    'fine_dining_restaurant',
    'steak_house',
    'pizza_restaurant',
    'sushi_restaurant',
    'brunch_restaurant',
  ],
  CAFE: [
    'cafe',
    'coffee_shop',
    'tea_house',
    'bakery',
    'dessert_shop',
    'ice_cream_shop',
    'juice_shop',
  ],
  MARKETS: ['market', 'food_court'],

  SPORTS: [
    'gym',
    'fitness_center',
    'stadium',
    'arena',
    'sports_complex',
    'sports_club',
    'sports_activity_location',
    'athletic_field',
    'swimming_pool',
    'golf_course',
    'ski_resort',
    'skateboard_park',
    'ice_skating_rink',
  ],
  HEALTH_WELLNESS: [
    'spa',
    'sauna',
    'wellness_center',
    'yoga_studio',
    'beauty_salon',
    'massage',
  ],

  ART: [
    'art_gallery',
    'museum',
    'art_studio',
    'cultural_center',
    'monument',
    'sculpture',
    'planetarium',
  ],
  FILM_THEATER: ['movie_theater', 'performing_arts_theater', 'auditorium'],
  COMEDY: ['comedy_club'],

  GAMING: [
    'amusement_center',
    'video_arcade',
    'casino',
    'internet_cafe',
    'bowling_alley',
  ],
  FAMILY: [
    'amusement_park',
    'water_park',
    'zoo',
    'aquarium',
    'playground',
    'childrens_camp',
    'wildlife_park',
    'wildlife_refuge',
  ],

  OUTDOORS: [
    'park',
    'national_park',
    'state_park',
    'hiking_area',
    'beach',
    'garden',
    'botanical_garden',
    'marina',
    'campground',
    'picnic_ground',
    'plaza',
    'observation_deck',
    'tourist_attraction',
  ],

  FASHION: ['shopping_mall', 'clothing_store', 'department_store'],
  EDUCATION: ['library', 'university', 'school'],
  PETS: ['dog_park', 'pet_store', 'veterinary_care'],

  RELIGION: ['church'], // legado (não selecionável) — só para rotular dado antigo

  // Sem venue social no Places (New): órfãs de propósito.
  TECH: [],
  BUSINESS: [],
  VOLUNTEERING: [],
  OTHER: [],
}

// Reverso: tipo do Places -> categoria de rolê, para rotular o candidato.
// Derivado do mapa acima (partição: 1 tipo -> 1 categoria).
const PLACE_TYPE_TO_CATEGORY: Record<string, EventCategory> = {
  night_club: 'PARTY',
  dance_hall: 'PARTY',
  bar: 'NIGHTLIFE',
  pub: 'NIGHTLIFE',
  wine_bar: 'NIGHTLIFE',
  concert_hall: 'MUSIC',
  karaoke: 'MUSIC',
  amphitheatre: 'MUSIC',
  restaurant: 'GASTRONOMY',
  bar_and_grill: 'GASTRONOMY',
  fast_food_restaurant: 'GASTRONOMY',
  meal_takeaway: 'GASTRONOMY',
  fine_dining_restaurant: 'GASTRONOMY',
  steak_house: 'GASTRONOMY',
  pizza_restaurant: 'GASTRONOMY',
  sushi_restaurant: 'GASTRONOMY',
  brunch_restaurant: 'GASTRONOMY',
  cafe: 'CAFE',
  coffee_shop: 'CAFE',
  tea_house: 'CAFE',
  bakery: 'CAFE',
  dessert_shop: 'CAFE',
  ice_cream_shop: 'CAFE',
  juice_shop: 'CAFE',
  market: 'MARKETS',
  food_court: 'MARKETS',
  gym: 'SPORTS',
  fitness_center: 'SPORTS',
  stadium: 'SPORTS',
  arena: 'SPORTS',
  sports_complex: 'SPORTS',
  sports_club: 'SPORTS',
  sports_activity_location: 'SPORTS',
  athletic_field: 'SPORTS',
  swimming_pool: 'SPORTS',
  golf_course: 'SPORTS',
  ski_resort: 'SPORTS',
  skateboard_park: 'SPORTS',
  ice_skating_rink: 'SPORTS',
  spa: 'HEALTH_WELLNESS',
  sauna: 'HEALTH_WELLNESS',
  wellness_center: 'HEALTH_WELLNESS',
  yoga_studio: 'HEALTH_WELLNESS',
  beauty_salon: 'HEALTH_WELLNESS',
  massage: 'HEALTH_WELLNESS',
  art_gallery: 'ART',
  museum: 'ART',
  art_studio: 'ART',
  cultural_center: 'ART',
  monument: 'ART',
  sculpture: 'ART',
  planetarium: 'ART',
  movie_theater: 'FILM_THEATER',
  performing_arts_theater: 'FILM_THEATER',
  auditorium: 'FILM_THEATER',
  comedy_club: 'COMEDY',
  amusement_center: 'GAMING',
  video_arcade: 'GAMING',
  casino: 'GAMING',
  internet_cafe: 'GAMING',
  bowling_alley: 'GAMING',
  amusement_park: 'FAMILY',
  water_park: 'FAMILY',
  zoo: 'FAMILY',
  aquarium: 'FAMILY',
  playground: 'FAMILY',
  childrens_camp: 'FAMILY',
  wildlife_park: 'FAMILY',
  wildlife_refuge: 'FAMILY',
  park: 'OUTDOORS',
  national_park: 'OUTDOORS',
  state_park: 'OUTDOORS',
  hiking_area: 'OUTDOORS',
  beach: 'OUTDOORS',
  garden: 'OUTDOORS',
  botanical_garden: 'OUTDOORS',
  marina: 'OUTDOORS',
  campground: 'OUTDOORS',
  picnic_ground: 'OUTDOORS',
  plaza: 'OUTDOORS',
  observation_deck: 'OUTDOORS',
  tourist_attraction: 'OUTDOORS',
  shopping_mall: 'FASHION',
  clothing_store: 'FASHION',
  department_store: 'FASHION',
  library: 'EDUCATION',
  university: 'EDUCATION',
  school: 'EDUCATION',
  dog_park: 'PETS',
  pet_store: 'PETS',
  veterinary_care: 'PETS',
  church: 'RELIGION',
}

/** Tipos de Places (deduplicados) para as categorias pedidas. */
export function placeTypesForCategories(categories: EventCategory[]): string[] {
  const types = new Set<string>()
  for (const c of categories) {
    for (const t of CATEGORY_TO_PLACE_TYPES[c]) types.add(t)
  }
  return [...types]
}

/** Primeira categoria conhecida entre os tipos do Places; OTHER se nenhuma. */
export function categoryForPlaceTypes(types: string[]): EventCategory {
  for (const t of types) {
    const c = PLACE_TYPE_TO_CATEGORY[t]
    if (c) return c
  }
  return 'OTHER'
}
