export type CourtType = "outdoor" | "indoor";
export type SkillLevel = "Beginner" | "Intermediate" | "Advanced" | "Pro";
export type SurfaceType = "asphalt" | "hardwood" | "concrete";

export interface Court {
  id: string;
  name: string;
  shortName: string;
  address: string;
  latitude: number;
  longitude: number;
  type: CourtType;
  surface: SurfaceType;
  hoops: number;
  description: string;
  basePlayersPlaying: number;
  maxPlayers: number;
  image?: string;
}

export const COURTS: Court[] = [
  {
    id: "venice-beach",
    name: "Venice Beach Basketball Courts",
    shortName: "Venice Beach",
    address: "1800 Ocean Front Walk, Venice, CA",
    latitude: 33.985,
    longitude: -118.4695,
    type: "outdoor",
    surface: "asphalt",
    hoops: 8,
    description:
      "Legendary outdoor courts on the Venice Beach boardwalk. Known for high-level streetball and a competitive atmosphere.",
    basePlayersPlaying: 10,
    maxPlayers: 10,
  },
  {
    id: "pan-pacific",
    name: "Pan Pacific Recreation Center",
    shortName: "Pan Pacific",
    address: "7600 Beverly Blvd, Los Angeles, CA",
    latitude: 34.076,
    longitude: -118.3606,
    type: "outdoor",
    surface: "asphalt",
    hoops: 4,
    description:
      "Popular outdoor courts in the heart of LA. Great for pickup games and organized runs.",
    basePlayersPlaying: 8,
    maxPlayers: 10,
  },
  {
    id: "ymca-metro",
    name: "YMCA Metro LA",
    shortName: "YMCA Metro",
    address: "401 S Hope St, Los Angeles, CA",
    latitude: 34.0522,
    longitude: -118.2437,
    type: "indoor",
    surface: "hardwood",
    hoops: 4,
    description:
      "Premium indoor hardwood courts in downtown LA. Organized leagues and open runs daily.",
    basePlayersPlaying: 5,
    maxPlayers: 10,
  },
  {
    id: "aliso-pico",
    name: "Aliso Pico Recreation Center",
    shortName: "Aliso Pico",
    address: "3000 S Gates St, Los Angeles, CA",
    latitude: 34.0538,
    longitude: -118.2391,
    type: "outdoor",
    surface: "concrete",
    hoops: 2,
    description:
      "Community courts with a loyal local crowd. Competitive runs every weekend morning.",
    basePlayersPlaying: 4,
    maxPlayers: 10,
  },
  {
    id: "lincoln-park",
    name: "Lincoln Park Recreation Center",
    shortName: "Lincoln Park",
    address: "3501 Valley Blvd, Los Angeles, CA",
    latitude: 34.0698,
    longitude: -118.2182,
    type: "outdoor",
    surface: "asphalt",
    hoops: 4,
    description:
      "Classic LA park courts. Long history of competitive ball and local legends.",
    basePlayersPlaying: 6,
    maxPlayers: 10,
  },
  {
    id: "stoner-park",
    name: "Stoner Recreation Center",
    shortName: "Stoner Park",
    address: "1835 Stoner Ave, Los Angeles, CA",
    latitude: 34.034,
    longitude: -118.4502,
    type: "outdoor",
    surface: "asphalt",
    hoops: 4,
    description:
      "West LA courts popular with college players. Fast-paced runs in a relaxed setting.",
    basePlayersPlaying: 3,
    maxPlayers: 10,
  },
  {
    id: "la-fitness-century",
    name: "LA Fitness Century City",
    shortName: "LA Fitness CC",
    address: "10889 Lindbrook Dr, Los Angeles, CA",
    latitude: 34.0589,
    longitude: -118.4257,
    type: "indoor",
    surface: "hardwood",
    hoops: 2,
    description:
      "Air-conditioned indoor courts. Members-only runs but the level is consistently high.",
    basePlayersPlaying: 8,
    maxPlayers: 10,
  },
  {
    id: "culver-city",
    name: "Culver City Park Courts",
    shortName: "Culver City",
    address: "9770 Culver Blvd, Culver City, CA",
    latitude: 34.0211,
    longitude: -118.3964,
    type: "outdoor",
    surface: "asphalt",
    hoops: 6,
    description:
      "Well-maintained courts in Culver City. Mix of skill levels, great for getting regular games.",
    basePlayersPlaying: 7,
    maxPlayers: 10,
  },
];

export const SKILL_LEVELS: SkillLevel[] = [
  "Beginner",
  "Intermediate",
  "Advanced",
  "Pro",
];

export const INITIAL_REGION = {
  latitude: 34.052,
  longitude: -118.35,
  latitudeDelta: 0.25,
  longitudeDelta: 0.25,
};
