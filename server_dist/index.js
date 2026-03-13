// server/index.ts
import express from "express";

// server/routes.ts
import { createServer } from "node:http";
import { Pool } from "pg";
import * as fs from "fs";
import * as path from "path";

// server/ca-courts.ts
var CA_COURTS = [
  { id: "venice-beach", name: "Venice Beach Basketball Courts", shortName: "Venice Beach", address: "1800 Ocean Front Walk, Venice, CA", city: "Los Angeles", state: "California", stateAbbr: "CA", latitude: 33.985, longitude: -118.4695, type: "outdoor", surface: "asphalt", hoops: 8, description: "Legendary outdoor courts on the Venice Beach boardwalk. Known for high-level streetball and a fiercely competitive atmosphere year-round.", basePlayersPlaying: 10, maxPlayers: 10 },
  { id: "pan-pacific", name: "Pan Pacific Recreation Center", shortName: "Pan Pacific", address: "7600 Beverly Blvd, Los Angeles, CA", city: "Los Angeles", state: "California", stateAbbr: "CA", latitude: 34.076, longitude: -118.3606, type: "outdoor", surface: "asphalt", hoops: 4, description: "Popular outdoor courts in the heart of LA. Great for pickup games and organized runs throughout the week.", basePlayersPlaying: 8, maxPlayers: 10 },
  { id: "ymca-metro", name: "YMCA Metro LA", shortName: "YMCA Metro", address: "401 S Hope St, Los Angeles, CA", city: "Los Angeles", state: "California", stateAbbr: "CA", latitude: 34.0522, longitude: -118.2437, type: "indoor", surface: "hardwood", hoops: 4, description: "Premium indoor hardwood courts in downtown LA. Organized leagues and open runs daily in a climate-controlled facility.", basePlayersPlaying: 5, maxPlayers: 10 },
  { id: "lincoln-park", name: "Lincoln Park Recreation Center", shortName: "Lincoln Park", address: "3501 Valley Blvd, Los Angeles, CA", city: "Los Angeles", state: "California", stateAbbr: "CA", latitude: 34.0698, longitude: -118.2182, type: "outdoor", surface: "asphalt", hoops: 4, description: "Classic LA park courts with a long history of competitive ball and local legends making their name.", basePlayersPlaying: 6, maxPlayers: 10 },
  { id: "stoner-park", name: "Stoner Recreation Center", shortName: "Stoner Park", address: "1835 Stoner Ave, Los Angeles, CA", city: "Los Angeles", state: "California", stateAbbr: "CA", latitude: 34.034, longitude: -118.4502, type: "outdoor", surface: "asphalt", hoops: 4, description: "West LA courts popular with college players. Fast-paced runs in a relaxed neighborhood setting.", basePlayersPlaying: 3, maxPlayers: 10 },
  { id: "la-fitness-century", name: "LA Fitness Century City", shortName: "LA Fitness CC", address: "10889 Lindbrook Dr, Los Angeles, CA", city: "Los Angeles", state: "California", stateAbbr: "CA", latitude: 34.0589, longitude: -118.4257, type: "indoor", surface: "hardwood", hoops: 2, description: "Air-conditioned indoor courts near Century City. Members-only runs but the competition level is consistently high.", basePlayersPlaying: 8, maxPlayers: 10 },
  { id: "culver-city", name: "Culver City Park Courts", shortName: "Culver City Park", address: "9770 Culver Blvd, Culver City, CA", city: "Los Angeles", state: "California", stateAbbr: "CA", latitude: 34.0211, longitude: -118.3964, type: "outdoor", surface: "asphalt", hoops: 6, description: "Well-maintained courts with a mixed skill crowd. A great spot to get consistent games going any day of the week.", basePlayersPlaying: 7, maxPlayers: 10 },
  { id: "exposition-park", name: "Exposition Park Recreation Center", shortName: "Expo Park", address: "3980 Bill Robertson Ln, Los Angeles, CA", city: "Los Angeles", state: "California", stateAbbr: "CA", latitude: 34.0152, longitude: -118.2869, type: "outdoor", surface: "asphalt", hoops: 6, description: "Lively courts near USC. Popular with college students and South LA locals \u2014 expect tough competition on weekends.", basePlayersPlaying: 9, maxPlayers: 10 },
  { id: "griffith-park", name: "Griffith Park Tennis & Courts", shortName: "Griffith Park", address: "4730 Crystal Springs Dr, Los Angeles, CA", city: "Los Angeles", state: "California", stateAbbr: "CA", latitude: 34.1184, longitude: -118.2941, type: "outdoor", surface: "concrete", hoops: 4, description: "Scenic courts inside Griffith Park. Great atmosphere with mountain views. Open runs happen mostly on weekend mornings.", basePlayersPlaying: 4, maxPlayers: 10 },
  { id: "compton-willowbrook", name: "Willowbrook Recreation Center", shortName: "Willowbrook", address: "11837 Wilmington Ave, Los Angeles, CA", city: "Los Angeles", state: "California", stateAbbr: "CA", latitude: 33.9032, longitude: -118.2484, type: "outdoor", surface: "asphalt", hoops: 4, description: "High-energy community courts in Willowbrook. Gritty, competitive runs with real South LA flavor.", basePlayersPlaying: 7, maxPlayers: 10 },
  { id: "beverly-hills-la-cienega", name: "La Cienega Park Basketball Courts", shortName: "La Cienega Park", address: "8400 Gregory Way, Beverly Hills, CA", city: "Beverly Hills", state: "California", stateAbbr: "CA", latitude: 34.0574, longitude: -118.3776, type: "outdoor", surface: "asphalt", hoops: 4, description: "Beverly Hills' premier outdoor courts inside La Cienega Park. Well-maintained and popular with locals and West LA players looking for competitive afternoon runs.", basePlayersPlaying: 6, maxPlayers: 10 },
  { id: "beverly-hills-roxbury", name: "Roxbury Park Recreation Center", shortName: "Roxbury Park", address: "471 S Roxbury Dr, Beverly Hills, CA", city: "Beverly Hills", state: "California", stateAbbr: "CA", latitude: 34.0601, longitude: -118.4008, type: "outdoor", surface: "asphalt", hoops: 2, description: "A Beverly Hills neighborhood favorite. Casual to intermediate runs in a clean, well-kept park setting. Great for evening pickup games.", basePlayersPlaying: 4, maxPlayers: 10 },
  { id: "beverly-hills-crescent", name: "Crescent Drive Park Courts", shortName: "Crescent Drive Park", address: "N Crescent Dr, Beverly Hills, CA", city: "Beverly Hills", state: "California", stateAbbr: "CA", latitude: 34.0776, longitude: -118.4001, type: "outdoor", surface: "concrete", hoops: 2, description: "Laid-back courts tucked into a quiet Beverly Hills neighborhood park. A go-to for halfcourt runs and skill work on weekday mornings.", basePlayersPlaying: 3, maxPlayers: 10 },
  { id: "beverly-hills-equinox", name: "Equinox Beverly Hills", shortName: "Equinox BH", address: "9601 Wilshire Blvd, Beverly Hills, CA", city: "Beverly Hills", state: "California", stateAbbr: "CA", latitude: 34.0664, longitude: -118.3997, type: "indoor", surface: "hardwood", hoops: 2, description: "Premium members-only indoor courts at one of LA's top fitness clubs. High-end facility drawing skilled players for competitive runs in a climate-controlled environment.", basePlayersPlaying: 5, maxPlayers: 10 },
  { id: "long-beach-houghton", name: "Houghton Park Recreation Center", shortName: "Houghton Park", address: "6301 Myrtle Ave, Long Beach, CA", city: "Long Beach", state: "California", stateAbbr: "CA", latitude: 33.8347, longitude: -118.1581, type: "outdoor", surface: "asphalt", hoops: 4, description: "One of Long Beach's most active pickup courts. Fast pace, regular crowd, games running from morning to dusk.", basePlayersPlaying: 8, maxPlayers: 10 },
  { id: "long-beach-ymca", name: "YMCA of Greater Long Beach", shortName: "Long Beach YMCA", address: "3605 Long Beach Blvd, Long Beach, CA", city: "Long Beach", state: "California", stateAbbr: "CA", latitude: 33.8207, longitude: -118.1859, type: "indoor", surface: "hardwood", hoops: 2, description: "Clean indoor hardwood in a full-facility gym. Well-organized open runs and league play for all skill levels.", basePlayersPlaying: 6, maxPlayers: 10 },
  { id: "csulb-pyramid-gym", name: "Cal State Long Beach - The Pyramid Gym", shortName: "CSULB Pyramid", address: "1250 Bellflower Blvd, Long Beach, CA", city: "Long Beach", state: "California", stateAbbr: "CA", latitude: 33.7836, longitude: -118.1141, type: "indoor", surface: "hardwood", hoops: 4, description: "Elite indoor courts inside CSULB's iconic Pyramid arena. College-level competition with Beach students and alumni running full-court games throughout the week.", basePlayersPlaying: 8, maxPlayers: 10 },
  { id: "anaheim-boysen", name: "Boysen Park", shortName: "Boysen Park", address: "951 S Harbor Blvd, Anaheim, CA", city: "Anaheim", state: "California", stateAbbr: "CA", latitude: 33.8265, longitude: -117.9143, type: "outdoor", surface: "asphalt", hoops: 4, description: "Central Anaheim courts with a loyal daily crowd. Runs start early and keep going well into the evening.", basePlayersPlaying: 6, maxPlayers: 10 },
  { id: "irvine-heritage", name: "Heritage Community Park", shortName: "Heritage Park", address: "14301 Yale Ave, Irvine, CA", city: "Irvine", state: "California", stateAbbr: "CA", latitude: 33.6895, longitude: -117.7842, type: "outdoor", surface: "asphalt", hoops: 4, description: "Well-kept courts in one of OC's top parks. Intermediate-to-advanced runs drawing players from across Irvine.", basePlayersPlaying: 5, maxPlayers: 10 },
  { id: "santa-ana-willard", name: "Willard Intermediate Gym", shortName: "Willard Gym", address: "1342 W Willard Ave, Santa Ana, CA", city: "Santa Ana", state: "California", stateAbbr: "CA", latitude: 33.7392, longitude: -117.8872, type: "indoor", surface: "hardwood", hoops: 2, description: "Community indoor gym popular with Santa Ana locals. Intense half-court runs with a strong regular crowd.", basePlayersPlaying: 7, maxPlayers: 10 },
  { id: "sd-balboa", name: "Balboa Park Municipal Gym", shortName: "Balboa Gym", address: "2145 Park Blvd, San Diego, CA", city: "San Diego", state: "California", stateAbbr: "CA", latitude: 32.7272, longitude: -117.1458, type: "indoor", surface: "hardwood", hoops: 4, description: "Premier indoor courts inside historic Balboa Park. Competitive full-court runs daily with a diverse player base.", basePlayersPlaying: 9, maxPlayers: 10 },
  { id: "sd-morley-field", name: "Morley Field Sports Complex", shortName: "Morley Field", address: "2221 Morley Field Dr, San Diego, CA", city: "San Diego", state: "California", stateAbbr: "CA", latitude: 32.737, longitude: -117.1373, type: "outdoor", surface: "asphalt", hoops: 6, description: "Classic outdoor courts in a massive sports complex. One of San Diego's most beloved pickup basketball spots.", basePlayersPlaying: 8, maxPlayers: 10 },
  { id: "sd-chollas", name: "Chollas Lake Recreation Center", shortName: "Chollas Lake", address: "6350 Chollas Pkwy, San Diego, CA", city: "San Diego", state: "California", stateAbbr: "CA", latitude: 32.7168, longitude: -117.0837, type: "outdoor", surface: "asphalt", hoops: 4, description: "Southeast San Diego courts with some of the most competitive runs in the city. Top-level athleticism on display.", basePlayersPlaying: 7, maxPlayers: 10 },
  { id: "sd-ymca-downtown", name: "Downtown San Diego YMCA", shortName: "SD Downtown YMCA", address: "500 W Broadway, San Diego, CA", city: "San Diego", state: "California", stateAbbr: "CA", latitude: 32.7155, longitude: -117.1682, type: "indoor", surface: "hardwood", hoops: 2, description: "Full-service downtown YMCA with clean hardwood courts. Regular open runs attract a solid mix of skill levels.", basePlayersPlaying: 5, maxPlayers: 10 },
  { id: "sf-kezar", name: "Kezar Stadium Courts", shortName: "Kezar Courts", address: "670 Kezar Dr, San Francisco, CA", city: "San Francisco", state: "California", stateAbbr: "CA", latitude: 37.7674, longitude: -122.4555, type: "outdoor", surface: "asphalt", hoops: 4, description: "Iconic courts beside Kezar Stadium in Golden Gate Park. SF's premier outdoor pickup scene with runs going all day.", basePlayersPlaying: 8, maxPlayers: 10 },
  { id: "sf-richmond-rec", name: "Richmond Recreation Center", shortName: "Richmond Rec", address: "251 9th Ave, San Francisco, CA", city: "San Francisco", state: "California", stateAbbr: "CA", latitude: 37.7835, longitude: -122.4685, type: "indoor", surface: "hardwood", hoops: 2, description: "Neighborhood indoor courts on the edge of Golden Gate Park. Friendly atmosphere with all skill levels welcome.", basePlayersPlaying: 4, maxPlayers: 10 },
  { id: "sf-mission-rec", name: "Mission Recreation Center", shortName: "Mission Rec", address: "2450 17th St, San Francisco, CA", city: "San Francisco", state: "California", stateAbbr: "CA", latitude: 37.7638, longitude: -122.4201, type: "outdoor", surface: "asphalt", hoops: 4, description: "Heart-of-the-Mission outdoor courts. Expect Latin flair and nonstop action on evenings and weekends.", basePlayersPlaying: 6, maxPlayers: 10 },
  { id: "oakland-defremery", name: "DeFremery Recreation Center", shortName: "DeFremery Park", address: "1651 Adeline St, Oakland, CA", city: "Oakland", state: "California", stateAbbr: "CA", latitude: 37.8103, longitude: -122.2858, type: "outdoor", surface: "asphalt", hoops: 6, description: "West Oakland's most legendary courts. Deep roots in the community \u2014 a hotbed for serious ballers since the 70s.", basePlayersPlaying: 9, maxPlayers: 10 },
  { id: "oakland-ymca", name: "YMCA Oakland", shortName: "Oakland YMCA", address: "2330 Broadway, Oakland, CA", city: "Oakland", state: "California", stateAbbr: "CA", latitude: 37.8105, longitude: -122.268, type: "indoor", surface: "hardwood", hoops: 2, description: "Solid indoor facility in Uptown Oakland. Open runs happen multiple times a day with a competitive regular crowd.", basePlayersPlaying: 7, maxPlayers: 10 },
  { id: "san-jose-gardner", name: "Gardner Recreation Center", shortName: "Gardner Rec", address: "520 W Virginia St, San Jose, CA", city: "San Jose", state: "California", stateAbbr: "CA", latitude: 37.3326, longitude: -121.8959, type: "indoor", surface: "hardwood", hoops: 2, description: "East San Jose's go-to indoor gym. Strong weekday runs with locals who play hard every session.", basePlayersPlaying: 6, maxPlayers: 10 },
  { id: "san-jose-backesto", name: "Backesto Park Courts", shortName: "Backesto Park", address: "800 N 13th St, San Jose, CA", city: "San Jose", state: "California", stateAbbr: "CA", latitude: 37.3519, longitude: -121.8763, type: "outdoor", surface: "asphalt", hoops: 4, description: "Outdoor courts in the heart of San Jose. Popular afternoon and evening destination for pickup across all skill levels.", basePlayersPlaying: 5, maxPlayers: 10 },
  { id: "berkeley-willard", name: "Willard Park Courts", shortName: "Willard Park", address: "2730 Telegraph Ave, Berkeley, CA", city: "Berkeley", state: "California", stateAbbr: "CA", latitude: 37.8564, longitude: -122.2583, type: "outdoor", surface: "asphalt", hoops: 2, description: "Berkeley's beloved neighborhood courts. Draws UC Berkeley students and locals for casual to mid-level runs.", basePlayersPlaying: 4, maxPlayers: 10 },
  { id: "riverside-fairmount", name: "Fairmount Park Recreation Center", shortName: "Fairmount Park", address: "2601 Fairmount Blvd, Riverside, CA", city: "Riverside", state: "California", stateAbbr: "CA", latitude: 33.9759, longitude: -117.3944, type: "outdoor", surface: "asphalt", hoops: 4, description: "Riverside's most active outdoor courts inside scenic Fairmount Park. All-day runs on weekends.", basePlayersPlaying: 6, maxPlayers: 10 },
  { id: "san-bernardino-nunez", name: "Nunez Park Community Center", shortName: "Nunez Park", address: "1717 W 5th St, San Bernardino, CA", city: "San Bernardino", state: "California", stateAbbr: "CA", latitude: 34.1083, longitude: -117.3108, type: "outdoor", surface: "concrete", hoops: 4, description: "High-energy SB courts drawing tough competition from across the Inland Empire. Not for the faint-hearted.", basePlayersPlaying: 8, maxPlayers: 10 },
  { id: "ontario-recreation", name: "Ontario Community Center Courts", shortName: "Ontario Rec", address: "225 E B St, Ontario, CA", city: "Ontario", state: "California", stateAbbr: "CA", latitude: 34.0633, longitude: -117.6508, type: "indoor", surface: "hardwood", hoops: 2, description: "Well-maintained indoor courts in the IE's hub city. Organized open runs throughout the week.", basePlayersPlaying: 5, maxPlayers: 10 },
  { id: "sacramento-southside", name: "Southside Park Courts", shortName: "Southside Park", address: "2nd Ave & T St, Sacramento, CA", city: "Sacramento", state: "California", stateAbbr: "CA", latitude: 38.5591, longitude: -121.484, type: "outdoor", surface: "asphalt", hoops: 4, description: "Classic Sacramento park with strong community ties. Morning and evening runs draw players from across the city.", basePlayersPlaying: 7, maxPlayers: 10 },
  { id: "sacramento-oak-park", name: "Oak Park Community Center", shortName: "Oak Park", address: "3425 Martin Luther King Jr Blvd, Sacramento, CA", city: "Sacramento", state: "California", stateAbbr: "CA", latitude: 38.5471, longitude: -121.4694, type: "indoor", surface: "hardwood", hoops: 2, description: "Indoor courts with proud Oak Park history. Known for producing serious talent and holding down Sacramento's rep.", basePlayersPlaying: 8, maxPlayers: 10 },
  { id: "sacramento-ymca-midtown", name: "YMCA Midtown Sacramento", shortName: "Midtown YMCA", address: "2021 W St, Sacramento, CA", city: "Sacramento", state: "California", stateAbbr: "CA", latitude: 38.5627, longitude: -121.4917, type: "indoor", surface: "hardwood", hoops: 2, description: "Popular midtown gym with daily open runs. The go-to spot for Sacramento's working crowd to get lunchtime and evening games.", basePlayersPlaying: 6, maxPlayers: 10 },
  { id: "fresno-roeding", name: "Roeding Park Recreation Center", shortName: "Roeding Park", address: "890 W Belmont Ave, Fresno, CA", city: "Fresno", state: "California", stateAbbr: "CA", latitude: 36.7455, longitude: -119.8113, type: "outdoor", surface: "asphalt", hoops: 6, description: "Fresno's biggest outdoor basketball scene. All-day runs attract players of every level from across the Central Valley.", basePlayersPlaying: 8, maxPlayers: 10 },
  { id: "fresno-ymca", name: "YMCA of Fresno", shortName: "Fresno YMCA", address: "1444 N Echo Ave, Fresno, CA", city: "Fresno", state: "California", stateAbbr: "CA", latitude: 36.7868, longitude: -119.7931, type: "indoor", surface: "hardwood", hoops: 2, description: "Well-run indoor facility with dedicated basketball hours. Strong mid-level competition and a welcoming atmosphere.", basePlayersPlaying: 5, maxPlayers: 10 },
  { id: "bakersfield-jastro", name: "Jastro Park Courts", shortName: "Jastro Park", address: "900 Niles St, Bakersfield, CA", city: "Bakersfield", state: "California", stateAbbr: "CA", latitude: 35.3838, longitude: -119.0092, type: "outdoor", surface: "asphalt", hoops: 4, description: "Bakersfield's top pickup destination. Hot days and hotter competition \u2014 players come ready to ball.", basePlayersPlaying: 6, maxPlayers: 10 },
  { id: "bakersfield-ymca", name: "Bakersfield Family YMCA", shortName: "Bakersfield YMCA", address: "600 Oleander Ave, Bakersfield, CA", city: "Bakersfield", state: "California", stateAbbr: "CA", latitude: 35.3625, longitude: -119.0283, type: "indoor", surface: "hardwood", hoops: 2, description: "Full-facility YMCA with regular basketball programming. Competitive open runs every weekday evening.", basePlayersPlaying: 4, maxPlayers: 10 },
  { id: "stockton-oak-park", name: "Oak Park Recreation Center", shortName: "Stockton Oak Park", address: "2301 E Fremont St, Stockton, CA", city: "Stockton", state: "California", stateAbbr: "CA", latitude: 37.9657, longitude: -121.2665, type: "outdoor", surface: "asphalt", hoops: 4, description: "One of Stockton's most active courts. Tough competition and a loyal neighborhood crowd that shows up daily.", basePlayersPlaying: 7, maxPlayers: 10 },
  { id: "modesto-enslen", name: "Enslen Park Courts", shortName: "Enslen Park", address: "701 Enslen Ave, Modesto, CA", city: "Modesto", state: "California", stateAbbr: "CA", latitude: 37.6584, longitude: -121.0023, type: "outdoor", surface: "asphalt", hoops: 4, description: "Modesto's best outdoor pickup spot. Consistent runs on weekends with a mix of locals and Valley transplants.", basePlayersPlaying: 5, maxPlayers: 10 },
  { id: "santa-barbara-chase", name: "Chase Palm Park Courts", shortName: "Chase Palm Park", address: "236 E Cabrillo Blvd, Santa Barbara, CA", city: "Santa Barbara", state: "California", stateAbbr: "CA", latitude: 34.4132, longitude: -119.6858, type: "outdoor", surface: "asphalt", hoops: 2, description: "Beachside courts with ocean views and good competition. UCSB students and local ballers keep the runs lively.", basePlayersPlaying: 4, maxPlayers: 10 },
  { id: "santa-cruz-harvey-west", name: "Harvey West Recreation Center", shortName: "Harvey West", address: "326 Evergreen St, Santa Cruz, CA", city: "Santa Cruz", state: "California", stateAbbr: "CA", latitude: 36.9864, longitude: -122.0449, type: "outdoor", surface: "asphalt", hoops: 4, description: "Santa Cruz's most popular outdoor courts. UC Santa Cruz students and locals run it up year-round in the sunshine.", basePlayersPlaying: 5, maxPlayers: 10 },
  { id: "palm-springs-demuth", name: "DeMuth Park Courts", shortName: "DeMuth Park", address: "4375 Mesquite Ave, Palm Springs, CA", city: "Palm Springs", state: "California", stateAbbr: "CA", latitude: 33.8211, longitude: -116.5261, type: "outdoor", surface: "asphalt", hoops: 4, description: "Desert courts that heat up fast. Early morning runs are the move \u2014 the competition is just as hot as the weather.", basePlayersPlaying: 4, maxPlayers: 10 },
  { id: "oxnard-carmen", name: "Carmen Park Recreation Center", shortName: "Carmen Park", address: "251 N Juanita Ave, Oxnard, CA", city: "Oxnard", state: "California", stateAbbr: "CA", latitude: 34.1988, longitude: -119.185, type: "outdoor", surface: "asphalt", hoops: 4, description: "Ventura County's most active pickup scene. Strong, physical runs with a blue-collar crowd that shows up every day.", basePlayersPlaying: 6, maxPlayers: 10 },
  { id: "cypress-arnold", name: "Arnold Cypress Park", shortName: "Arnold Cypress", address: "8611 Watson St, Cypress, CA", city: "Cypress", state: "California", stateAbbr: "CA", latitude: 33.8111, longitude: -118.0335, type: "outdoor", surface: "asphalt", hoops: 2, description: "Lighted full-court in a well-kept OC park. Softball fields and volleyball nearby \u2014 solid pickup runs evenings and weekends.", basePlayersPlaying: 5, maxPlayers: 10 },
  { id: "cypress-lexington", name: "Lexington Park", shortName: "Lexington Park", address: "8616 W Cerritos Ave, Cypress, CA", city: "Cypress", state: "California", stateAbbr: "CA", latitude: 33.8135, longitude: -118.0483, type: "outdoor", surface: "asphalt", hoops: 2, description: "Multi-use lighted court with a fitness zone. Newer facility attracting a growing pickup crowd from across west Cypress.", basePlayersPlaying: 4, maxPlayers: 10 },
  { id: "cypress-moody", name: "Moody Street Park", shortName: "Moody St Park", address: "10201 Moody St, Cypress, CA", city: "Cypress", state: "California", stateAbbr: "CA", latitude: 33.8185, longitude: -118.0152, type: "outdoor", surface: "asphalt", hoops: 2, description: "Neighborhood full-court in east Cypress. Casual afternoon runs with a loyal local crowd of all skill levels.", basePlayersPlaying: 3, maxPlayers: 10 },
  { id: "24hr-torrance", name: "24 Hour Fitness Torrance", shortName: "24hr Torrance", address: "2555 Skypark Dr, Torrance, CA", city: "Torrance", state: "California", stateAbbr: "CA", latitude: 33.8666, longitude: -118.3478, type: "indoor", surface: "hardwood", hoops: 2, description: "Full-court hardwood inside one of the South Bay's most popular 24 Hour Fitness locations. Active open runs morning through evening.", basePlayersPlaying: 6, maxPlayers: 10 },
  { id: "24hr-hawthorne", name: "24 Hour Fitness Hawthorne", shortName: "24hr Hawthorne", address: "11910 Aviation Blvd, Hawthorne, CA", city: "Hawthorne", state: "California", stateAbbr: "CA", latitude: 33.9147, longitude: -118.3468, type: "indoor", surface: "hardwood", hoops: 2, description: "Sport club near LAX with consistent basketball action. After-work runs are highly competitive with a diverse athletic crowd.", basePlayersPlaying: 7, maxPlayers: 10 },
  { id: "24hr-hollywood", name: "24 Hour Fitness Hollywood", shortName: "24hr Hollywood", address: "1777 Vine St, Los Angeles, CA", city: "Los Angeles", state: "California", stateAbbr: "CA", latitude: 34.098, longitude: -118.3265, type: "indoor", surface: "hardwood", hoops: 2, description: "Hollywood Sport club with hardwood courts. A unique mix of fitness influencers and serious hoopers making for fun runs.", basePlayersPlaying: 5, maxPlayers: 10 },
  { id: "24hr-burbank", name: "24 Hour Fitness Burbank", shortName: "24hr Burbank", address: "150 E Providencia Ave, Burbank, CA", city: "Burbank", state: "California", stateAbbr: "CA", latitude: 34.1756, longitude: -118.309, type: "indoor", surface: "hardwood", hoops: 2, description: "Clean indoor courts in the heart of the media capital. Good runs throughout the week with a competitive regular crowd.", basePlayersPlaying: 6, maxPlayers: 10 },
  { id: "24hr-pasadena", name: "24 Hour Fitness Pasadena", shortName: "24hr Pasadena", address: "3803 E Foothill Blvd, Pasadena, CA", city: "Pasadena", state: "California", stateAbbr: "CA", latitude: 34.1463, longitude: -118.0723, type: "indoor", surface: "hardwood", hoops: 2, description: "East Pasadena Sport club with a loyal basketball community. Caltech and local players fill up the court daily.", basePlayersPlaying: 5, maxPlayers: 10 },
  { id: "24hr-elmonte", name: "24 Hour Fitness El Monte", shortName: "24hr El Monte", address: "1 Peck Rd, El Monte, CA", city: "El Monte", state: "California", stateAbbr: "CA", latitude: 34.0686, longitude: -118.0276, type: "indoor", surface: "hardwood", hoops: 4, description: "One of the largest 24 Hour Fitness clubs in the SGV \u2014 multiple full courts and intense pickup action all day long.", basePlayersPlaying: 8, maxPlayers: 10 },
  { id: "24hr-downey", name: "24 Hour Fitness Downey", shortName: "24hr Downey", address: "12450 Lakewood Blvd, Downey, CA", city: "Downey", state: "California", stateAbbr: "CA", latitude: 33.9401, longitude: -118.1223, type: "indoor", surface: "hardwood", hoops: 2, description: "Southeast LA's 24hr hub. Strong Southeast LA culture in these runs \u2014 show up ready or get schooled.", basePlayersPlaying: 7, maxPlayers: 10 },
  { id: "24hr-westla", name: "24 Hour Fitness West LA", shortName: "24hr West LA", address: "11100 Santa Monica Blvd, Los Angeles, CA", city: "Los Angeles", state: "California", stateAbbr: "CA", latitude: 34.0457, longitude: -118.4437, type: "indoor", surface: "hardwood", hoops: 2, description: "Upscale Westside Sport club attracting a high-skill crowd. Fast-paced runs with above-average athletes.", basePlayersPlaying: 8, maxPlayers: 10 },
  { id: "24hr-fullerton", name: "24 Hour Fitness Fullerton", shortName: "24hr Fullerton", address: "321 N Harbor Blvd, Fullerton, CA", city: "Fullerton", state: "California", stateAbbr: "CA", latitude: 33.8745, longitude: -117.9271, type: "indoor", surface: "hardwood", hoops: 2, description: "North OC staple with reliable pickup runs. CSUF students and local OC players fill up courts every evening.", basePlayersPlaying: 6, maxPlayers: 10 },
  { id: "24hr-costa-mesa", name: "24 Hour Fitness Costa Mesa", shortName: "24hr Costa Mesa", address: "3172 Harbor Blvd, Costa Mesa, CA", city: "Costa Mesa", state: "California", stateAbbr: "CA", latitude: 33.6757, longitude: -117.9322, type: "indoor", surface: "hardwood", hoops: 2, description: "Central OC location drawing players from across the county. Good morning and evening runs with consistent competition.", basePlayersPlaying: 5, maxPlayers: 10 },
  { id: "24hr-huntington-beach", name: "24 Hour Fitness Huntington Beach", shortName: "24hr HB", address: "7777 Edinger Ave, Huntington Beach, CA", city: "Huntington Beach", state: "California", stateAbbr: "CA", latitude: 33.7237, longitude: -118.0009, type: "indoor", surface: "hardwood", hoops: 2, description: "Surf City's premier indoor basketball spot. Lunchtime and after-work runs with competitive OC ballers.", basePlayersPlaying: 6, maxPlayers: 10 },
  { id: "24hr-mission-valley", name: "24 Hour Fitness Mission Valley", shortName: "24hr Mission Valley", address: "8330 Clairemont Mesa Blvd, San Diego, CA", city: "San Diego", state: "California", stateAbbr: "CA", latitude: 32.8129, longitude: -117.1415, type: "indoor", surface: "hardwood", hoops: 2, description: "San Diego's most trafficked 24hr club. Full-court runs happen all day with a diverse and athletic membership base.", basePlayersPlaying: 8, maxPlayers: 10 },
  { id: "24hr-chula-vista", name: "24 Hour Fitness Chula Vista", shortName: "24hr Chula Vista", address: "699 H St, Chula Vista, CA", city: "Chula Vista", state: "California", stateAbbr: "CA", latitude: 32.6354, longitude: -117.0842, type: "indoor", surface: "hardwood", hoops: 2, description: "South Bay SD club drawing players from Chula Vista and Otay Ranch. Bilingual, energetic crowd with serious hoopers.", basePlayersPlaying: 7, maxPlayers: 10 },
  { id: "24hr-escondido", name: "24 Hour Fitness Escondido", shortName: "24hr Escondido", address: "300 E Via Rancho Pkwy, Escondido, CA", city: "Escondido", state: "California", stateAbbr: "CA", latitude: 33.1446, longitude: -117.0564, type: "indoor", surface: "hardwood", hoops: 2, description: "North County SD location with solid pickup activity. Consistent morning and evening runs in a clean modern facility.", basePlayersPlaying: 5, maxPlayers: 10 },
  { id: "24hr-sunnyvale", name: "24 Hour Fitness Sunnyvale", shortName: "24hr Sunnyvale", address: "150 E Fremont Ave, Sunnyvale, CA", city: "Sunnyvale", state: "California", stateAbbr: "CA", latitude: 37.3784, longitude: -122.0289, type: "indoor", surface: "hardwood", hoops: 4, description: "Silicon Valley Super Sport with multiple full courts. Tech workers and serious athletes fill runs from morning to midnight.", basePlayersPlaying: 8, maxPlayers: 10 },
  { id: "24hr-san-jose-almaden", name: "24 Hour Fitness San Jose Almaden", shortName: "24hr SJ Almaden", address: "5050 Almaden Expwy, San Jose, CA", city: "San Jose", state: "California", stateAbbr: "CA", latitude: 37.2677, longitude: -121.8635, type: "indoor", surface: "hardwood", hoops: 2, description: "South San Jose Sport club with a dedicated basketball following. Evening runs are highly competitive with skilled regulars.", basePlayersPlaying: 7, maxPlayers: 10 },
  { id: "24hr-fremont", name: "24 Hour Fitness Fremont", shortName: "24hr Fremont", address: "40580 Albrae St, Fremont, CA", city: "Fremont", state: "California", stateAbbr: "CA", latitude: 37.5512, longitude: -121.9849, type: "indoor", surface: "hardwood", hoops: 2, description: "East Bay Sport club with a strong hoops culture. Diverse crowd of South Bay and East Bay players running full-court daily.", basePlayersPlaying: 6, maxPlayers: 10 },
  { id: "24hr-concord", name: "24 Hour Fitness Concord", shortName: "24hr Concord", address: "1975 Diamond Blvd, Concord, CA", city: "Concord", state: "California", stateAbbr: "CA", latitude: 37.9736, longitude: -122.031, type: "indoor", surface: "hardwood", hoops: 4, description: "Contra Costa Super Sport \u2014 one of the biggest 24hr gyms in the East Bay. Multiple courts running simultaneously during peak hours.", basePlayersPlaying: 7, maxPlayers: 10 },
  { id: "24hr-walnut-creek", name: "24 Hour Fitness Walnut Creek", shortName: "24hr Walnut Creek", address: "2021 N Broadway, Walnut Creek, CA", city: "Walnut Creek", state: "California", stateAbbr: "CA", latitude: 37.9088, longitude: -122.0597, type: "indoor", surface: "hardwood", hoops: 2, description: "Suburban East Bay gym with strong pickup culture. Lunchtime and post-work runs packed with competitive players.", basePlayersPlaying: 5, maxPlayers: 10 },
  { id: "24hr-san-mateo", name: "24 Hour Fitness San Mateo", shortName: "24hr San Mateo", address: "3100 Campus Dr, San Mateo, CA", city: "San Mateo", state: "California", stateAbbr: "CA", latitude: 37.5594, longitude: -122.2811, type: "indoor", surface: "hardwood", hoops: 2, description: "Peninsula Sport club drawing from the SF-to-SJ corridor. Great hardwood courts with a tech-savvy but very athletic crowd.", basePlayersPlaying: 6, maxPlayers: 10 },
  { id: "24hr-rancho-cordova", name: "24 Hour Fitness Rancho Cordova", shortName: "24hr Rancho Cordova", address: "11251 Folsom Blvd, Rancho Cordova, CA", city: "Rancho Cordova", state: "California", stateAbbr: "CA", latitude: 38.5899, longitude: -121.2878, type: "indoor", surface: "hardwood", hoops: 2, description: "East Sacramento suburb gym with dedicated pickup regulars. Evening runs rival any game in the greater Sacramento area.", basePlayersPlaying: 6, maxPlayers: 10 },
  { id: "24hr-elk-grove", name: "24 Hour Fitness Elk Grove", shortName: "24hr Elk Grove", address: "8215 Laguna Blvd, Elk Grove, CA", city: "Elk Grove", state: "California", stateAbbr: "CA", latitude: 38.408, longitude: -121.3975, type: "indoor", surface: "hardwood", hoops: 2, description: "South Sacramento suburb Sport club. Newer facility with pristine hardwood and a growing basketball community.", basePlayersPlaying: 5, maxPlayers: 10 },
  { id: "24hr-roseville", name: "24 Hour Fitness Roseville", shortName: "24hr Roseville", address: "321 N Sunrise Ave, Roseville, CA", city: "Roseville", state: "California", stateAbbr: "CA", latitude: 38.7521, longitude: -121.2758, type: "indoor", surface: "hardwood", hoops: 2, description: "Placer County hub drawing players from Roseville, Rocklin, and Granite Bay. Competitive runs in a top-tier facility.", basePlayersPlaying: 6, maxPlayers: 10 },
  { id: "24hr-rancho-cucamonga", name: "24 Hour Fitness Rancho Cucamonga", shortName: "24hr Rancho Cuca", address: "10850 Base Line Rd, Rancho Cucamonga, CA", city: "Rancho Cucamonga", state: "California", stateAbbr: "CA", latitude: 34.1134, longitude: -117.5717, type: "indoor", surface: "hardwood", hoops: 2, description: "IE's most popular 24hr gym. Foothill-area players bring serious athleticism to daily runs on clean hardwood courts.", basePlayersPlaying: 7, maxPlayers: 10 },
  { id: "24hr-ontario-ie", name: "24 Hour Fitness Ontario", shortName: "24hr Ontario", address: "3920 E Inland Empire Blvd, Ontario, CA", city: "Ontario", state: "California", stateAbbr: "CA", latitude: 34.0543, longitude: -117.5652, type: "indoor", surface: "hardwood", hoops: 2, description: "IE hub gym right off the 10 freeway. Strong all-day pickup with players coming from across San Bernardino and Riverside counties.", basePlayersPlaying: 7, maxPlayers: 10 },
  { id: "orange-grijalva", name: "Grijalva Community Park", shortName: "Grijalva Park", address: "222 N Cannon St, Orange, CA", city: "Orange", state: "California", stateAbbr: "CA", latitude: 33.7879, longitude: -117.8463, type: "outdoor", surface: "asphalt", hoops: 4, description: "One of Orange's most popular outdoor courts. Four full hoops draw a big midday crowd from the surrounding neighborhoods. Lights on until 10 PM.", basePlayersPlaying: 7, maxPlayers: 10 },
  { id: "orange-el-modena", name: "El Modena Park", shortName: "El Modena Park", address: "3883 E Hillsdale Ave, Orange, CA", city: "Orange", state: "California", stateAbbr: "CA", latitude: 33.7897, longitude: -117.82, type: "outdoor", surface: "asphalt", hoops: 2, description: "East Orange neighborhood park with a solid full-court. Quiet during the week, packed evenings and weekends with locals who know how to ball.", basePlayersPlaying: 5, maxPlayers: 10 },
  { id: "orange-yorba", name: "Yorba Regional Park Courts", shortName: "Yorba Regional", address: "7600 E La Palma Ave, Anaheim, CA", city: "Orange", state: "California", stateAbbr: "CA", latitude: 33.853, longitude: -117.788, type: "outdoor", surface: "asphalt", hoops: 2, description: "Riverside park straddling Orange and Anaheim borders. Weekend runs can get competitive fast \u2014 wide open courts with good natural light all day.", basePlayersPlaying: 4, maxPlayers: 10 },
  { id: "orange-handy", name: "Handy Park", shortName: "Handy Park", address: "200 N Poplar St, Orange, CA", city: "Orange", state: "California", stateAbbr: "CA", latitude: 33.7875, longitude: -117.8575, type: "outdoor", surface: "asphalt", hoops: 2, description: "Central Orange park with well-maintained outdoor courts. Close to Old Town Orange \u2014 steady after-school and evening crowd year-round.", basePlayersPlaying: 4, maxPlayers: 10 },
  { id: "orange-portola", name: "Portola Park", shortName: "Portola Park", address: "3100 N Portola Ave, Orange, CA", city: "Orange", state: "California", stateAbbr: "CA", latitude: 33.8005, longitude: -117.8523, type: "outdoor", surface: "asphalt", hoops: 2, description: "North Orange park tucked into a residential area. Consistent pickup games afternoon through dusk with a regular crowd from the adjacent neighborhoods.", basePlayersPlaying: 3, maxPlayers: 10 },
  { id: "orange-fred-kelly", name: "Fred Kelly Stadium Courts", shortName: "Fred Kelly Courts", address: "525 N Shaffer St, Orange, CA", city: "Orange", state: "California", stateAbbr: "CA", latitude: 33.7906, longitude: -117.8483, type: "outdoor", surface: "asphalt", hoops: 4, description: "City of Orange rec complex next to El Camino Real Park. Multiple courts, stadium lighting, and a deep pool of local ballers make this a must-check spot.", basePlayersPlaying: 8, maxPlayers: 10 },
  { id: "orange-canyon-rim", name: "Canyon Rim Park", shortName: "Canyon Rim Park", address: "6301 E Serrano Ave, Orange, CA", city: "Orange", state: "California", stateAbbr: "CA", latitude: 33.8024, longitude: -117.7917, type: "outdoor", surface: "asphalt", hoops: 2, description: "Elevated Orange Hills park with panoramic views and a clean full-court. Weekend runs feature players from across east OC who make the drive for quality games.", basePlayersPlaying: 4, maxPlayers: 10 },
  { id: "orange-vista", name: "Vista del Rio Park", shortName: "Vista del Rio", address: "901 W Struck Ave, Orange, CA", city: "Orange", state: "California", stateAbbr: "CA", latitude: 33.7862, longitude: -117.9033, type: "outdoor", surface: "asphalt", hoops: 2, description: "West Orange park along the Santa Ana riverbed. Easy parking, lighted courts, and an active after-work pickup scene from nearby office parks.", basePlayersPlaying: 4, maxPlayers: 10 },
  { id: "24hr-orange-city-blvd", name: "24 Hour Fitness Orange (City Blvd)", shortName: "24hr Orange City", address: "20 City Blvd W, Orange, CA", city: "Orange", state: "California", stateAbbr: "CA", latitude: 33.7985, longitude: -117.8932, type: "indoor", surface: "hardwood", hoops: 2, description: "Sport club at The Outlets at Orange \u2014 prime location with heavy foot traffic. Courts stay busy all day with players stopping in before or after shopping.", basePlayersPlaying: 7, maxPlayers: 10 },
  { id: "24hr-orange-chapman", name: "24 Hour Fitness Orange (Chapman Ave)", shortName: "24hr Orange Chapman", address: "2930 E Chapman Ave, Orange, CA", city: "Orange", state: "California", stateAbbr: "CA", latitude: 33.7774, longitude: -117.8388, type: "indoor", surface: "hardwood", hoops: 2, description: "East Orange Sport club serving Chapman University and surrounding neighborhoods. Strong evening runs with a mix of college and adult league players.", basePlayersPlaying: 6, maxPlayers: 10 },
  { id: "24hr-orange-katella", name: "24 Hour Fitness Orange (Katella Ave)", shortName: "24hr Orange Katella", address: "1700 W Katella Ave, Orange, CA", city: "Orange", state: "California", stateAbbr: "CA", latitude: 33.7875, longitude: -117.8918, type: "indoor", surface: "hardwood", hoops: 2, description: "West Orange club near the Honda Center corridor. Game-night energy spills over into post-game runs with a fired-up and competitive crowd.", basePlayersPlaying: 7, maxPlayers: 10 },
  { id: "cypress-oak-knoll", name: "Oak Knoll Park", shortName: "Oak Knoll Park", address: "4801 Orange Ave, Cypress, CA", city: "Cypress", state: "California", stateAbbr: "CA", latitude: 33.815, longitude: -118.0048, type: "outdoor", surface: "asphalt", hoops: 2, description: "East Cypress neighborhood park with a lighted full-court. Dependable evening pickup with a mix of ages from the surrounding Oak Knoll area.", basePlayersPlaying: 4, maxPlayers: 10 },
  { id: "cypress-cottonwood", name: "Cottonwood Park", shortName: "Cottonwood Park", address: "4520 Mardina St, Cypress, CA", city: "Cypress", state: "California", stateAbbr: "CA", latitude: 33.824, longitude: -118.0303, type: "outdoor", surface: "asphalt", hoops: 2, description: "Quiet north Cypress park with a clean outdoor court. Gets busy after school hours \u2014 a great spot to find a chill pickup game on weeknights.", basePlayersPlaying: 3, maxPlayers: 10 },
  { id: "cypress-community-park", name: "Cypress Community Park", shortName: "Cypress Community", address: "9281 Moody St, Cypress, CA", city: "Cypress", state: "California", stateAbbr: "CA", latitude: 33.8163, longitude: -118.0152, type: "outdoor", surface: "asphalt", hoops: 4, description: "Central Cypress main park with four hoops and plenty of space. The busiest outdoor spot in the city \u2014 expect full-court runs most afternoons and weekends.", basePlayersPlaying: 8, maxPlayers: 10 },
  { id: "cypress-veterans", name: "Veterans Park Cypress", shortName: "Veterans Park", address: "5700 Myra Ave, Cypress, CA", city: "Cypress", state: "California", stateAbbr: "CA", latitude: 33.8088, longitude: -118.0373, type: "outdoor", surface: "asphalt", hoops: 2, description: "Southwest Cypress park with lighted courts near the 605 freeway. Steady runs with players from Cypress, Los Alamitos, and Seal Beach on weekday evenings.", basePlayersPlaying: 4, maxPlayers: 10 },
  { id: "cypress-pat-Nixon", name: "Pat Nixon Park", shortName: "Pat Nixon Park", address: "9100 Crescent Ave, Cypress, CA", city: "Cypress", state: "California", stateAbbr: "CA", latitude: 33.8198, longitude: -118.0472, type: "outdoor", surface: "asphalt", hoops: 2, description: "West Cypress park with a shaded full-court. Named after the former First Lady, this neighborhood gem hosts relaxed pickup games most mornings and evenings.", basePlayersPlaying: 3, maxPlayers: 10 },
  { id: "cypress-ruth-carver", name: "Ruth Carver Park", shortName: "Ruth Carver Park", address: "5600 Cerritos Ave, Cypress, CA", city: "Cypress", state: "California", stateAbbr: "CA", latitude: 33.8075, longitude: -118.0282, type: "outdoor", surface: "asphalt", hoops: 2, description: "South Cypress park close to the Cerritos border. Lighted courts attract a steady flow of players from both cities \u2014 great spot for late evening games.", basePlayersPlaying: 4, maxPlayers: 10 },
  { id: "24hr-los-alamitos-katella", name: "24 Hour Fitness Los Alamitos (Katella)", shortName: "24hr Katella", address: "3890 Katella Ave, Los Alamitos, CA", city: "Los Alamitos", state: "California", stateAbbr: "CA", latitude: 33.8026, longitude: -118.0571, type: "indoor", surface: "hardwood", hoops: 2, description: "The Katella Ave staple right on the Cypress border. Serious regulars from Cypress, La Palma, Seal Beach, and Long Beach all converge here for competitive daily runs.", basePlayersPlaying: 8, maxPlayers: 10 },
  { id: "los-alamitos-rossmoor", name: "Rossmoor Park", shortName: "Rossmoor Park", address: "12021 Montecito Rd, Los Alamitos, CA", city: "Los Alamitos", state: "California", stateAbbr: "CA", latitude: 33.7906, longitude: -118.0785, type: "outdoor", surface: "asphalt", hoops: 2, description: "Local favorite tucked in the Rossmoor neighborhood. Clean courts, plenty of shade, and a loyal crowd of regulars who run here year-round.", basePlayersPlaying: 5, maxPlayers: 10 },
  { id: "lapalma-central-park", name: "Central Park La Palma", shortName: "Central Park", address: "7821 Walker St, La Palma, CA", city: "La Palma", state: "California", stateAbbr: "CA", latitude: 33.8469, longitude: -118.0472, type: "outdoor", surface: "asphalt", hoops: 4, description: "La Palma's crown jewel \u2014 four lighted courts in a beautifully kept park. Draws ballers from Cypress, Buena Park, and Cerritos nightly. One of the best outdoor runs in northwest OC.", basePlayersPlaying: 8, maxPlayers: 10 },
  { id: "palmdesert-civic", name: "Civic Center Park Palm Desert", shortName: "Civic Center Park", address: "43900 San Pablo Ave, Palm Desert, CA", city: "Palm Desert", state: "California", stateAbbr: "CA", latitude: 33.7219, longitude: -116.3737, type: "outdoor", surface: "asphalt", hoops: 4, description: "Palm Desert's premier public court complex right next to City Hall. Four hoops, excellent lighting, and mountain views \u2014 the undisputed top run spot in the desert.", basePlayersPlaying: 7, maxPlayers: 10 },
  { id: "palmdesert-freedom", name: "Freedom Park Palm Desert", shortName: "Freedom Park", address: "77400 Country Club Dr, Palm Desert, CA", city: "Palm Desert", state: "California", stateAbbr: "CA", latitude: 33.7347, longitude: -116.372, type: "outdoor", surface: "asphalt", hoops: 2, description: "North Palm Desert park with full-court and recreation facilities. Popular with Coachella Valley youth leagues and pickup players from across the desert cities.", basePlayersPlaying: 5, maxPlayers: 10 },
  { id: "palmdesert-hovley", name: "Hovley Soccer Park Courts", shortName: "Hovley Park", address: "74735 Hovley Ln E, Palm Desert, CA", city: "Palm Desert", state: "California", stateAbbr: "CA", latitude: 33.7272, longitude: -116.362, type: "outdoor", surface: "asphalt", hoops: 2, description: "Multi-sport east Palm Desert park with outdoor basketball. Desert heat keeps games intense \u2014 most serious runs happen early morning or after 6 PM when it cools.", basePlayersPlaying: 4, maxPlayers: 10 },
  { id: "24hr-palm-desert", name: "24 Hour Fitness Palm Desert", shortName: "24hr Palm Desert", address: "72840 CA-111, Palm Desert, CA", city: "Palm Desert", state: "California", stateAbbr: "CA", latitude: 33.7154, longitude: -116.3851, type: "indoor", surface: "hardwood", hoops: 2, description: "Air-conditioned desert refuge on Hwy 111. The go-to indoor court for Coachella Valley players escaping summer triple-digit heat \u2014 runs stay competitive year-round.", basePlayersPlaying: 6, maxPlayers: 10 },
  { id: "buenapark-barton", name: "Barton Park", shortName: "Barton Park", address: "8200 Whitaker St, Buena Park, CA", city: "Buena Park", state: "California", stateAbbr: "CA", latitude: 33.8602, longitude: -118.0029, type: "outdoor", surface: "asphalt", hoops: 4, description: "Buena Park's most active outdoor court \u2014 four hoops draw big crowds from across north OC. Runs get highly competitive on weekends; expect to wait for next.", basePlayersPlaying: 8, maxPlayers: 10 },
  { id: "buenapark-bellis", name: "Bellis Park", shortName: "Bellis Park", address: "6400 San Marcos Way, Buena Park, CA", city: "Buena Park", state: "California", stateAbbr: "CA", latitude: 33.8771, longitude: -117.9966, type: "outdoor", surface: "asphalt", hoops: 2, description: "North Buena Park neighborhood park with a solid full-court. Reliable afternoon and evening pickup with a tight-knit local crew.", basePlayersPlaying: 5, maxPlayers: 10 },
  { id: "24hr-buena-park", name: "24 Hour Fitness Buena Park", shortName: "24hr Buena Park", address: "8059 On the Mall, Buena Park, CA", city: "Buena Park", state: "California", stateAbbr: "CA", latitude: 33.8649, longitude: -118.0047, type: "indoor", surface: "hardwood", hoops: 2, description: "Super Sport off the 5 freeway near Knott's Berry Farm. One of the top indoor runs in north OC \u2014 competitive all day with a strong pool of regulars.", basePlayersPlaying: 8, maxPlayers: 10 },
  { id: "gardengove-main-park", name: "Garden Grove Park", shortName: "Garden Grove Park", address: "9301 Westminster Ave, Garden Grove, CA", city: "Garden Grove", state: "California", stateAbbr: "CA", latitude: 33.7737, longitude: -117.9604, type: "outdoor", surface: "asphalt", hoops: 4, description: "Central Garden Grove's go-to outdoor run. Four courts with lights make this a true all-day, all-night spot \u2014 one of the busiest parks in mid-OC.", basePlayersPlaying: 7, maxPlayers: 10 },
  { id: "gardengove-atlantis", name: "Atlantis Play Center Courts", shortName: "Atlantis Center", address: "12218 Atlantis Way, Garden Grove, CA", city: "Garden Grove", state: "California", stateAbbr: "CA", latitude: 33.7769, longitude: -117.9821, type: "outdoor", surface: "asphalt", hoops: 2, description: "Popular rec complex with outdoor courts next to the aquatic center. After-swim-practice runs are a tradition here \u2014 a fun and active crowd any day of the week.", basePlayersPlaying: 5, maxPlayers: 10 },
  { id: "24hr-garden-grove", name: "24 Hour Fitness Garden Grove", shortName: "24hr Garden Grove", address: "13142 Brookhurst St, Garden Grove, CA", city: "Garden Grove", state: "California", stateAbbr: "CA", latitude: 33.7741, longitude: -117.9499, type: "indoor", surface: "hardwood", hoops: 2, description: "Sport club on Brookhurst serving Garden Grove, Fountain Valley, and Santa Ana ballers. Courts stay busy morning to night with a diverse OC crowd.", basePlayersPlaying: 7, maxPlayers: 10 },
  { id: "westminster-sigler", name: "Sigler Park", shortName: "Sigler Park", address: "7200 Plaza St, Westminster, CA", city: "Westminster", state: "California", stateAbbr: "CA", latitude: 33.7578, longitude: -118.0003, type: "outdoor", surface: "asphalt", hoops: 4, description: "Westminster's best outdoor basketball spot. Four hoops, stadium lighting, and a loud competitive atmosphere on weekends \u2014 Little Saigon's premier court.", basePlayersPlaying: 8, maxPlayers: 10 },
  { id: "24hr-westminster", name: "24 Hour Fitness Westminster", shortName: "24hr Westminster", address: "15510 Magnolia St, Westminster, CA", city: "Westminster", state: "California", stateAbbr: "CA", latitude: 33.757, longitude: -117.9935, type: "indoor", surface: "hardwood", hoops: 2, description: "Mid-OC Sport club with a strong hoops community. Draws players from Westminster, Garden Grove, and Fountain Valley for fast-paced indoor runs.", basePlayersPlaying: 7, maxPlayers: 10 },
  { id: "seabeach-eisenhower", name: "Eisenhower Park", shortName: "Eisenhower Park", address: "1600 Seal Beach Blvd, Seal Beach, CA", city: "Seal Beach", state: "California", stateAbbr: "CA", latitude: 33.7965, longitude: -118.0698, type: "outdoor", surface: "asphalt", hoops: 2, description: "Clean lighted courts in a well-kept Seal Beach park. Casual but competitive runs with players from Seal Beach, Los Alamitos, and Long Beach who know the game.", basePlayersPlaying: 5, maxPlayers: 10 },
  { id: "fv-mile-square", name: "Mile Square Regional Park", shortName: "Mile Square Park", address: "16801 Euclid St, Fountain Valley, CA", city: "Fountain Valley", state: "California", stateAbbr: "CA", latitude: 33.7249, longitude: -117.9419, type: "outdoor", surface: "asphalt", hoops: 4, description: "One of OC's largest regional parks \u2014 four full-courts with ample parking and lights. Weekend tournaments and organized runs happen here regularly all year long.", basePlayersPlaying: 8, maxPlayers: 10 },
  { id: "24hr-fountain-valley", name: "24 Hour Fitness Fountain Valley", shortName: "24hr Fountain Valley", address: "18401 Brookhurst St, Fountain Valley, CA", city: "Fountain Valley", state: "California", stateAbbr: "CA", latitude: 33.7117, longitude: -117.9488, type: "indoor", surface: "hardwood", hoops: 2, description: "South OC Sport club right off the 405. Fountain Valley's top indoor run \u2014 consistent competition from morning open to late-night close.", basePlayersPlaying: 7, maxPlayers: 10 },
  { id: "stanton-central", name: "Stanton Central Park", shortName: "Stanton Central", address: "7800 Katella Ave, Stanton, CA", city: "Stanton", state: "California", stateAbbr: "CA", latitude: 33.8013, longitude: -117.9957, type: "outdoor", surface: "asphalt", hoops: 2, description: "Stanton's main outdoor court right on Katella. A modest but active park that draws regulars from Stanton, Anaheim, and Garden Grove for evening runs.", basePlayersPlaying: 5, maxPlayers: 10 },
  { id: "placentia-tri-city", name: "Tri-City Park", shortName: "Tri-City Park", address: "400 N Kraemer Blvd, Placentia, CA", city: "Placentia", state: "California", stateAbbr: "CA", latitude: 33.8735, longitude: -117.8451, type: "outdoor", surface: "asphalt", hoops: 2, description: "Shared park on the Placentia-Anaheim-Brea border. Great location draws players from three cities \u2014 consistent evening pickup in a relaxed, welcoming environment.", basePlayersPlaying: 5, maxPlayers: 10 },
  { id: "brea-city-sports", name: "Brea Sports Park", shortName: "Brea Sports Park", address: "3500 E Imperial Hwy, Brea, CA", city: "Brea", state: "California", stateAbbr: "CA", latitude: 33.9244, longitude: -117.8692, type: "outdoor", surface: "asphalt", hoops: 4, description: "Brea's best outdoor complex with four hoops and lots of space. North OC players come from Placentia, Fullerton, and Yorba Linda for the good competition here.", basePlayersPlaying: 6, maxPlayers: 10 },
  { id: "24hr-brea", name: "24 Hour Fitness Brea", shortName: "24hr Brea", address: "2929 E Imperial Hwy, Brea, CA", city: "Brea", state: "California", stateAbbr: "CA", latitude: 33.9231, longitude: -117.8712, type: "indoor", surface: "hardwood", hoops: 2, description: "North OC Sport club serving Brea, La Habra, and Fullerton. Solid indoor competition with a mix of high school, college, and adult players running daily.", basePlayersPlaying: 6, maxPlayers: 10 },
  { id: "yorbalinda-lakeview", name: "Lakeview Park", shortName: "Lakeview Park", address: "4345 Lakeview Ave, Yorba Linda, CA", city: "Yorba Linda", state: "California", stateAbbr: "CA", latitude: 33.8877, longitude: -117.813, type: "outdoor", surface: "asphalt", hoops: 2, description: "Quiet Yorba Linda park with a clean outdoor full-court. Serves the newer east-side neighborhoods \u2014 pickup runs pick up significantly on weekends.", basePlayersPlaying: 4, maxPlayers: 10 },
  { id: "24hr-yorba-linda", name: "24 Hour Fitness Yorba Linda", shortName: "24hr Yorba Linda", address: "4860 Yorba Linda Blvd, Yorba Linda, CA", city: "Yorba Linda", state: "California", stateAbbr: "CA", latitude: 33.8889, longitude: -117.8062, type: "indoor", surface: "hardwood", hoops: 2, description: "Upscale Sport club in east OC. Yorba Linda's only indoor court option \u2014 players from Placentia and Brea also make the drive for quality hardwood runs.", basePlayersPlaying: 6, maxPlayers: 10 },
  { id: "tustin-sports-park", name: "Tustin Sports Park", shortName: "Tustin Sports Park", address: "12850 Robinson Dr, Tustin, CA", city: "Tustin", state: "California", stateAbbr: "CA", latitude: 33.7457, longitude: -117.8143, type: "outdoor", surface: "asphalt", hoops: 4, description: "Tustin's main sports complex \u2014 four full courts, bleachers, and lights until 10 PM. One of the best-kept outdoor runs in central OC. Always a game going on.", basePlayersPlaying: 7, maxPlayers: 10 },
  { id: "24hr-tustin", name: "24 Hour Fitness Tustin", shortName: "24hr Tustin", address: "2961 El Camino Real, Tustin, CA", city: "Tustin", state: "California", stateAbbr: "CA", latitude: 33.7469, longitude: -117.8105, type: "indoor", surface: "hardwood", hoops: 2, description: "Central OC Sport club between Irvine and Orange. Draws a competitive mix from across the area \u2014 evening runs at Tustin 24hr are some of the best in the county.", basePlayersPlaying: 7, maxPlayers: 10 },
  { id: "missionviejo-olympiad", name: "Olympiad Recreation Center", shortName: "Olympiad Rec", address: "24932 Veterans Way, Mission Viejo, CA", city: "Mission Viejo", state: "California", stateAbbr: "CA", latitude: 33.6127, longitude: -117.6625, type: "indoor", surface: "hardwood", hoops: 2, description: "South OC's top city rec center with a full indoor court. Mission Viejo's organized leagues and open gym sessions attract serious players from across south county.", basePlayersPlaying: 6, maxPlayers: 10 },
  { id: "24hr-mission-viejo", name: "24 Hour Fitness Mission Viejo", shortName: "24hr Mission Viejo", address: "25410 Marguerite Pkwy, Mission Viejo, CA", city: "Mission Viejo", state: "California", stateAbbr: "CA", latitude: 33.6096, longitude: -117.669, type: "indoor", surface: "hardwood", hoops: 2, description: "South county Sport club serving Mission Viejo, Laguna Niguel, and Aliso Viejo. Strong adult league culture \u2014 competitive runs throughout the day.", basePlayersPlaying: 6, maxPlayers: 10 },
  { id: "lakeforest-sports-park", name: "Lake Forest Sports Park", shortName: "LF Sports Park", address: "28000 Rancho Pkwy, Lake Forest, CA", city: "Lake Forest", state: "California", stateAbbr: "CA", latitude: 33.6501, longitude: -117.6879, type: "outdoor", surface: "asphalt", hoops: 4, description: "Premier outdoor complex in south OC \u2014 four hoops plus a skate park make this a true community hub. Pickup runs are active all week with a driven south county crowd.", basePlayersPlaying: 6, maxPlayers: 10 },
  { id: "24hr-lake-forest", name: "24 Hour Fitness Lake Forest", shortName: "24hr Lake Forest", address: "23832 Rockfield Blvd, Lake Forest, CA", city: "Lake Forest", state: "California", stateAbbr: "CA", latitude: 33.6478, longitude: -117.6835, type: "indoor", surface: "hardwood", hoops: 2, description: "South OC's go-to indoor gym. Lake Forest 24hr serves Foothill Ranch, Portola Hills, and Trabuco Canyon \u2014 one of the more competitive Sport clubs in the area.", basePlayersPlaying: 7, maxPlayers: 10 },
  { id: "lagunaniguel-crown-valley", name: "Crown Valley Community Park", shortName: "Crown Valley Park", address: "29751 Crown Valley Pkwy, Laguna Niguel, CA", city: "Laguna Niguel", state: "California", stateAbbr: "CA", latitude: 33.545, longitude: -117.72, type: "outdoor", surface: "asphalt", hoops: 2, description: "South OC outdoor courts at one of the area's premier community parks. Beautiful setting near the hills \u2014 consistent weekend runs with a fit and competitive south county crowd.", basePlayersPlaying: 5, maxPlayers: 10 },
  { id: "24hr-laguna-hills", name: "24 Hour Fitness Laguna Hills", shortName: "24hr Laguna Hills", address: "24041 El Toro Rd, Laguna Hills, CA", city: "Laguna Hills", state: "California", stateAbbr: "CA", latitude: 33.5964, longitude: -117.7147, type: "indoor", surface: "hardwood", hoops: 2, description: "Super Sport at the Laguna Hills Mall area. Serves Laguna Hills, Aliso Viejo, and Laguna Niguel \u2014 big open courts and strong competition in a well-maintained facility.", basePlayersPlaying: 7, maxPlayers: 10 },
  { id: "sanclemente-vista-hermosa", name: "Vista Hermosa Sports Park", shortName: "Vista Hermosa", address: "901 Avenida Vista Hermosa, San Clemente, CA", city: "San Clemente", state: "California", stateAbbr: "CA", latitude: 33.4481, longitude: -117.6258, type: "outdoor", surface: "asphalt", hoops: 2, description: "State-of-the-art south OC sports park near the 5 freeway. Clean courts, ocean breeze, and ballers who take their game seriously even at the southernmost edge of OC.", basePlayersPlaying: 5, maxPlayers: 10 },
  { id: "cerritos-iron-wood", name: "Ironwood Park Cerritos", shortName: "Ironwood Park", address: "13800 Ironwood Ave, Cerritos, CA", city: "Cerritos", state: "California", stateAbbr: "CA", latitude: 33.8683, longitude: -118.0582, type: "outdoor", surface: "asphalt", hoops: 4, description: "Cerritos outdoor courts in a well-maintained park. Draws ballers from Cerritos, Artesia, and Norwalk \u2014 competitive pickup especially on Saturday mornings.", basePlayersPlaying: 6, maxPlayers: 10 },
  { id: "lakewood-del-valle", name: "Del Valle Park Lakewood", shortName: "Del Valle Park", address: "4040 Woodruff Ave, Lakewood, CA", city: "Lakewood", state: "California", stateAbbr: "CA", latitude: 33.8493, longitude: -118.1178, type: "outdoor", surface: "asphalt", hoops: 4, description: "Lakewood's top outdoor run \u2014 four full hoops with lights and ample parking. Popular with Long Beach and Cerritos players who make the short drive for quality games.", basePlayersPlaying: 7, maxPlayers: 10 },
  { id: "carson-victoria-park", name: "Victoria Park Carson", shortName: "Victoria Park", address: "340 E Victoria St, Carson, CA", city: "Carson", state: "California", stateAbbr: "CA", latitude: 33.8336, longitude: -118.2573, type: "outdoor", surface: "asphalt", hoops: 4, description: "Carson's best outdoor basketball spot. Four courts, lights, and a laid-back but competitive atmosphere \u2014 Carson's deep talent pool shows up here daily.", basePlayersPlaying: 7, maxPlayers: 10 },
  { id: "norwalk-central-park", name: "Norwalk Park", shortName: "Norwalk Park", address: "13000 Clarkdale Ave, Norwalk, CA", city: "Norwalk", state: "California", stateAbbr: "CA", latitude: 33.9022, longitude: -118.082, type: "outdoor", surface: "asphalt", hoops: 2, description: "Southeast LA county park with solid outdoor courts. Draws a mix of players from Norwalk, Santa Fe Springs, and Bellflower \u2014 always a game going afternoons and evenings.", basePlayersPlaying: 5, maxPlayers: 10 },
  { id: "24hr-north-hollywood", name: "24 Hour Fitness North Hollywood", shortName: "24hr North Hollywood", address: "12881 Raymer St, North Hollywood, CA", city: "North Hollywood", state: "California", stateAbbr: "CA", latitude: 34.1952, longitude: -118.3897, type: "indoor", surface: "hardwood", hoops: 2, description: "NoHo Sport club drawing Valley ballers from all directions. Competitive runs throughout the day with a diverse mix of hoopers from across the San Fernando Valley.", basePlayersPlaying: 7, maxPlayers: 10 },
  { id: "24hr-sherman-oaks", name: "24 Hour Fitness Sherman Oaks", shortName: "24hr Sherman Oaks", address: "14006 Riverside Dr, Sherman Oaks, CA", city: "Sherman Oaks", state: "California", stateAbbr: "CA", latitude: 34.1568, longitude: -118.4468, type: "indoor", surface: "hardwood", hoops: 2, description: "Valley Super Sport on Riverside Dr. Sherman Oaks 24hr is known for skilled runs \u2014 entertainers, athletes, and serious hoopers all share the same hardwood here.", basePlayersPlaying: 7, maxPlayers: 10 },
  { id: "24hr-woodland-hills", name: "24 Hour Fitness Woodland Hills", shortName: "24hr Woodland Hills", address: "6600 Topanga Canyon Blvd, Woodland Hills, CA", city: "Woodland Hills", state: "California", stateAbbr: "CA", latitude: 34.1688, longitude: -118.6061, type: "indoor", surface: "hardwood", hoops: 2, description: "West Valley Sport club at Westfield Topanga. One of the largest facilities in the Valley \u2014 multiple courts and a fired-up crowd make this a premium hoops destination.", basePlayersPlaying: 8, maxPlayers: 10 },
  { id: "24hr-northridge", name: "24 Hour Fitness Northridge", shortName: "24hr Northridge", address: "8930 Tampa Ave, Northridge, CA", city: "Northridge", state: "California", stateAbbr: "CA", latitude: 34.2303, longitude: -118.5592, type: "indoor", surface: "hardwood", hoops: 2, description: "CSUN-adjacent Sport club fueled by university players and local ballers. Northridge 24hr runs are fast-paced and athletic \u2014 great competition any time of day.", basePlayersPlaying: 7, maxPlayers: 10 },
  { id: "24hr-glendale", name: "24 Hour Fitness Glendale", shortName: "24hr Glendale", address: "105 N Glendale Ave, Glendale, CA", city: "Glendale", state: "California", stateAbbr: "CA", latitude: 34.1503, longitude: -118.2551, type: "indoor", surface: "hardwood", hoops: 2, description: "Central Glendale Sport club near the Galleria. Draws from Glendale, Burbank, and Pasadena \u2014 high-energy runs with a mix of styles reflecting the diverse local community.", basePlayersPlaying: 7, maxPlayers: 10 },
  { id: "24hr-arcadia", name: "24 Hour Fitness Arcadia", shortName: "24hr Arcadia", address: "400 N Santa Anita Ave, Arcadia, CA", city: "Arcadia", state: "California", stateAbbr: "CA", latitude: 34.1397, longitude: -118.0355, type: "indoor", surface: "hardwood", hoops: 2, description: "SGV Sport club near Santa Anita Park. Arcadia's hidden gem \u2014 serious competition from the local community that runs full-court every single day without fail.", basePlayersPlaying: 6, maxPlayers: 10 },
  { id: "24hr-west-covina", name: "24 Hour Fitness West Covina", shortName: "24hr West Covina", address: "1901 Workman Ave, West Covina, CA", city: "West Covina", state: "California", stateAbbr: "CA", latitude: 34.0794, longitude: -117.9218, type: "indoor", surface: "hardwood", hoops: 2, description: "SGV Super Sport serving West Covina, Covina, and Baldwin Park. High-traffic gym with a deep bench of regulars \u2014 full-court runs available from open to close.", basePlayersPlaying: 7, maxPlayers: 10 },
  { id: "24hr-whittier", name: "24 Hour Fitness Whittier", shortName: "24hr Whittier", address: "15600 Whittwood Ln, Whittier, CA", city: "Whittier", state: "California", stateAbbr: "CA", latitude: 33.9719, longitude: -118.0265, type: "indoor", surface: "hardwood", hoops: 2, description: "East LA county Sport club with a loyal hoops crew. Whittier ballers are known for their hustle \u2014 runs here are physical and competitive from the opening tip.", basePlayersPlaying: 7, maxPlayers: 10 },
  { id: "24hr-lakewood", name: "24 Hour Fitness Lakewood", shortName: "24hr Lakewood", address: "4700 Clark Ave, Lakewood, CA", city: "Lakewood", state: "California", stateAbbr: "CA", latitude: 33.853, longitude: -118.1173, type: "indoor", surface: "hardwood", hoops: 2, description: "South LA Sport club between Long Beach and Cerritos. Lakewood 24hr sees action from across the south bay \u2014 steady runs with skilled players throughout the day.", basePlayersPlaying: 7, maxPlayers: 10 },
  { id: "24hr-cerritos", name: "24 Hour Fitness Cerritos", shortName: "24hr Cerritos", address: "18100 Studebaker Rd, Cerritos, CA", city: "Cerritos", state: "California", stateAbbr: "CA", latitude: 33.8617, longitude: -118.0641, type: "indoor", surface: "hardwood", hoops: 2, description: "Sport club in the Cerritos Auto Square area. Known for high skill level \u2014 Cerritos has a tradition of producing top talent and this gym reflects that culture every day.", basePlayersPlaying: 8, maxPlayers: 10 },
  { id: "24hr-carson", name: "24 Hour Fitness Carson", shortName: "24hr Carson", address: "20700 Avalon Blvd, Carson, CA", city: "Carson", state: "California", stateAbbr: "CA", latitude: 33.8355, longitude: -118.2621, type: "indoor", surface: "hardwood", hoops: 2, description: "South Bay Super Sport near Cal State Dominguez Hills. Athletes from CSUDH and the surrounding community make this one of the most athletic gyms in south LA county.", basePlayersPlaying: 8, maxPlayers: 10 },
  { id: "24hr-santa-monica", name: "24 Hour Fitness Santa Monica", shortName: "24hr Santa Monica", address: "1527 4th St, Santa Monica, CA", city: "Santa Monica", state: "California", stateAbbr: "CA", latitude: 34.0187, longitude: -118.4945, type: "indoor", surface: "hardwood", hoops: 2, description: "Premier Westside Sport club steps from the beach. Celebrity sightings are common but the hoops stay serious \u2014 one of the most competitive 24hr gyms in all of LA.", basePlayersPlaying: 8, maxPlayers: 10 },
  { id: "24hr-san-ramon", name: "24 Hour Fitness San Ramon", shortName: "24hr San Ramon", address: "3000 Crow Canyon Pl, San Ramon, CA", city: "San Ramon", state: "California", stateAbbr: "CA", latitude: 37.7527, longitude: -121.9794, type: "indoor", surface: "hardwood", hoops: 2, description: "Tri-Valley Super Sport serving San Ramon and Danville. Corporate community brings serious competition \u2014 lunch-hour and evening runs are reliably high-level here.", basePlayersPlaying: 7, maxPlayers: 10 },
  { id: "24hr-pleasanton", name: "24 Hour Fitness Pleasanton", shortName: "24hr Pleasanton", address: "4555 Rosewood Dr, Pleasanton, CA", city: "Pleasanton", state: "California", stateAbbr: "CA", latitude: 37.6953, longitude: -121.9017, type: "indoor", surface: "hardwood", hoops: 2, description: "East Bay Sport club serving Pleasanton, Dublin, and Livermore. Tech and business community fuels competitive midday runs \u2014 highly skilled afternoon crowd.", basePlayersPlaying: 7, maxPlayers: 10 },
  { id: "24hr-hayward", name: "24 Hour Fitness Hayward", shortName: "24hr Hayward", address: "24301 Southland Dr, Hayward, CA", city: "Hayward", state: "California", stateAbbr: "CA", latitude: 37.5894, longitude: -122.0558, type: "indoor", surface: "hardwood", hoops: 2, description: "East Bay Sport club with deep hoops roots. Hayward produces serious talent \u2014 this gym reflects the city's basketball culture with high-energy runs every single day.", basePlayersPlaying: 8, maxPlayers: 10 },
  { id: "24hr-santa-clara", name: "24 Hour Fitness Santa Clara", shortName: "24hr Santa Clara", address: "3055 El Camino Real, Santa Clara, CA", city: "Santa Clara", state: "California", stateAbbr: "CA", latitude: 37.3542, longitude: -121.9692, type: "indoor", surface: "hardwood", hoops: 2, description: "Silicon Valley Sport club near Levi's Stadium. Tech workers and serious athletes share the court \u2014 some of the most well-rounded competition in the South Bay.", basePlayersPlaying: 7, maxPlayers: 10 },
  { id: "24hr-corona", name: "24 Hour Fitness Corona", shortName: "24hr Corona", address: "2520 Tuscany St, Corona, CA", city: "Corona", state: "California", stateAbbr: "CA", latitude: 33.885, longitude: -117.5653, type: "indoor", surface: "hardwood", hoops: 2, description: "IE Sport club right off the 91. Corona's hoops scene is underrated \u2014 this gym draws from a deep talent pool across western Riverside County every day.", basePlayersPlaying: 7, maxPlayers: 10 },
  { id: "24hr-moreno-valley", name: "24 Hour Fitness Moreno Valley", shortName: "24hr Moreno Valley", address: "22625 Alessandro Blvd, Moreno Valley, CA", city: "Moreno Valley", state: "California", stateAbbr: "CA", latitude: 33.9239, longitude: -117.2233, type: "indoor", surface: "hardwood", hoops: 2, description: "East IE Sport club in one of the fastest-growing cities in California. Athletic and hungry \u2014 Mo Val players play with serious chip-on-the-shoulder energy.", basePlayersPlaying: 7, maxPlayers: 10 },
  { id: "24hr-fontana", name: "24 Hour Fitness Fontana", shortName: "24hr Fontana", address: "17201 Foothill Blvd, Fontana, CA", city: "Fontana", state: "California", stateAbbr: "CA", latitude: 34.092, longitude: -117.4399, type: "indoor", surface: "hardwood", hoops: 2, description: "West IE Sport club on Foothill Blvd. Fontana's gym culture is strong \u2014 competitive full-court runs from early morning to late night with serious local ballers.", basePlayersPlaying: 7, maxPlayers: 10 },
  { id: "riverside-bordwell", name: "Bordwell Park", shortName: "Bordwell Park", address: "1420 Columbia Ave, Riverside, CA", city: "Riverside", state: "California", stateAbbr: "CA", latitude: 33.9786, longitude: -117.3735, type: "outdoor", surface: "asphalt", hoops: 4, description: "One of Riverside's top outdoor courts \u2014 four hoops with lights in a large city park. Heavy pickup traffic from the surrounding neighborhood; always a run going weekdays and weekends.", basePlayersPlaying: 7, maxPlayers: 10 },
  { id: "riverside-white-park", name: "White Park", shortName: "White Park", address: "3936 Chestnut St, Riverside, CA", city: "Riverside", state: "California", stateAbbr: "CA", latitude: 33.9614, longitude: -117.3791, type: "outdoor", surface: "asphalt", hoops: 2, description: "Central Riverside neighborhood park with lighted full-court. Steady evening pickup drawing from UCR students and local ballers \u2014 solid competition any night of the week.", basePlayersPlaying: 5, maxPlayers: 10 },
  { id: "riverside-hunt-park", name: "Hunt Park", shortName: "Hunt Park", address: "4015 Jackson St, Riverside, CA", city: "Riverside", state: "California", stateAbbr: "CA", latitude: 33.9759, longitude: -117.3532, type: "outdoor", surface: "asphalt", hoops: 4, description: "East Riverside multi-sport park with four outdoor courts. Known for its competitive runs \u2014 this is where serious Riverside ballers come to test themselves on weekends.", basePlayersPlaying: 8, maxPlayers: 10 },
  { id: "riverside-la-sierra", name: "La Sierra Community Center Courts", shortName: "La Sierra Center", address: "4000 La Sierra Ave, Riverside, CA", city: "Riverside", state: "California", stateAbbr: "CA", latitude: 33.9901, longitude: -117.4618, type: "indoor", surface: "hardwood", hoops: 2, description: "West Riverside city recreation center with an indoor gym. Organized leagues, open gym hours, and a passionate west-side crowd that plays hard every session.", basePlayersPlaying: 6, maxPlayers: 10 },
  { id: "riverside-valley-view", name: "Valley View Park", shortName: "Valley View Park", address: "9580 Krameria Ave, Riverside, CA", city: "Riverside", state: "California", stateAbbr: "CA", latitude: 33.9247, longitude: -117.4089, type: "outdoor", surface: "asphalt", hoops: 2, description: "South Riverside park with clean outdoor courts and mountain views. Growing pickup scene as the surrounding community expands \u2014 good evening runs year-round.", basePlayersPlaying: 5, maxPlayers: 10 },
  { id: "24hr-riverside-tyler", name: "24 Hour Fitness Riverside (Tyler)", shortName: "24hr Riverside Tyler", address: "3520 Riverside Plaza Dr, Riverside, CA", city: "Riverside", state: "California", stateAbbr: "CA", latitude: 33.9912, longitude: -117.4051, type: "indoor", surface: "hardwood", hoops: 2, description: "Super Sport at the Galleria at Tyler \u2014 Riverside's flagship 24hr location. Big facility, multiple courts, and one of the deepest talent pools in the entire IE.", basePlayersPlaying: 9, maxPlayers: 10 },
  { id: "24hr-riverside-canyon-springs", name: "24 Hour Fitness Riverside (Canyon Springs)", shortName: "24hr Canyon Springs", address: "8201 Indiana Ave, Riverside, CA", city: "Riverside", state: "California", stateAbbr: "CA", latitude: 33.9451, longitude: -117.3604, type: "indoor", surface: "hardwood", hoops: 2, description: "East Riverside Sport club serving the Canyon Springs and Orangecrest communities. Strong competition with a loyal group of regulars who run here daily.", basePlayersPlaying: 7, maxPlayers: 10 },
  { id: "sb-perris-hill", name: "Perris Hill Park", shortName: "Perris Hill Park", address: "780 E 40th St, San Bernardino, CA", city: "San Bernardino", state: "California", stateAbbr: "CA", latitude: 34.1202, longitude: -117.2807, type: "outdoor", surface: "asphalt", hoops: 4, description: "SB's most storied outdoor court \u2014 four hoops at the base of the hills. A historic pickup spot where generations of Inland Empire ballers have come to prove themselves.", basePlayersPlaying: 8, maxPlayers: 10 },
  { id: "sb-blair-park", name: "Blair Park", shortName: "Blair Park", address: "2737 W Baseline Rd, San Bernardino, CA", city: "San Bernardino", state: "California", stateAbbr: "CA", latitude: 34.1059, longitude: -117.3282, type: "outdoor", surface: "asphalt", hoops: 2, description: "West San Bernardino neighborhood park with a lighted full-court. Consistent evening pickup with players from across the west side who show up ready to compete.", basePlayersPlaying: 6, maxPlayers: 10 },
  { id: "sb-wildwood-park", name: "Wildwood Park", shortName: "Wildwood Park", address: "1718 W 2nd St, San Bernardino, CA", city: "San Bernardino", state: "California", stateAbbr: "CA", latitude: 34.1063, longitude: -117.3051, type: "outdoor", surface: "asphalt", hoops: 2, description: "Central SB park with well-maintained courts. A busy after-school and evening scene \u2014 this court sees action from CSUSB students and long-time SB locals alike.", basePlayersPlaying: 6, maxPlayers: 10 },
  { id: "sb-delmann-heights", name: "Delmann Heights Community Center", shortName: "Delmann Heights", address: "2969 N Flores St, San Bernardino, CA", city: "San Bernardino", state: "California", stateAbbr: "CA", latitude: 34.1491, longitude: -117.2987, type: "indoor", surface: "hardwood", hoops: 2, description: "North SB community center with a full indoor gym. Organized leagues, open gym sessions, and a community-first atmosphere \u2014 one of SB's most consistent indoor runs.", basePlayersPlaying: 6, maxPlayers: 10 },
  { id: "sb-al-guhin", name: "Al Guhin Memorial Park", shortName: "Al Guhin Park", address: "4096 N Sierra Way, San Bernardino, CA", city: "San Bernardino", state: "California", stateAbbr: "CA", latitude: 34.1383, longitude: -117.2944, type: "outdoor", surface: "asphalt", hoops: 2, description: "North-central SB park with a clean outdoor court. Steady pickup runs with a mix of CSUSB students and neighborhood regulars \u2014 active all week long.", basePlayersPlaying: 5, maxPlayers: 10 },
  { id: "24hr-san-bernardino-hospitality", name: "24 Hour Fitness San Bernardino", shortName: "24hr San Bernardino", address: "285 E Hospitality Ln, San Bernardino, CA", city: "San Bernardino", state: "California", stateAbbr: "CA", latitude: 34.0713, longitude: -117.2826, type: "indoor", surface: "hardwood", hoops: 2, description: "IE Sport club on Hospitality Lane \u2014 SB's main 24hr location. Draws from across the city and neighboring Loma Linda, Colton, and Highland with competitive daily runs.", basePlayersPlaying: 7, maxPlayers: 10 },
  { id: "redlands-sylvan-park", name: "Sylvan Park Redlands", shortName: "Sylvan Park", address: "601 N University St, Redlands, CA", city: "Redlands", state: "California", stateAbbr: "CA", latitude: 34.0575, longitude: -117.1832, type: "outdoor", surface: "asphalt", hoops: 4, description: "Redlands' top outdoor spot \u2014 four hoops near the University of Redlands campus. College players and community ballers mix it up here daily; strong skill level all around.", basePlayersPlaying: 7, maxPlayers: 10 },
  { id: "24hr-redlands", name: "24 Hour Fitness Redlands", shortName: "24hr Redlands", address: "1255 W Lugonia Ave, Redlands, CA", city: "Redlands", state: "California", stateAbbr: "CA", latitude: 34.0631, longitude: -117.2012, type: "indoor", surface: "hardwood", hoops: 2, description: "East IE Sport club serving Redlands, Loma Linda, and Yucaipa. Consistent indoor competition with a mix of healthcare workers and university students keeping runs active.", basePlayersPlaying: 6, maxPlayers: 10 },
  { id: "rialto-frisbie-park", name: "Frisbie Park Rialto", shortName: "Frisbie Park", address: "355 N Willow Ave, Rialto, CA", city: "Rialto", state: "California", stateAbbr: "CA", latitude: 34.1067, longitude: -117.3802, type: "outdoor", surface: "asphalt", hoops: 4, description: "Rialto's biggest outdoor complex \u2014 four courts with lighting. Situated between SB and Fontana, this park draws from both cities. Runs go hard from after school until lights out.", basePlayersPlaying: 7, maxPlayers: 10 },
  { id: "24hr-rialto", name: "24 Hour Fitness Rialto", shortName: "24hr Rialto", address: "261 W Foothill Blvd, Rialto, CA", city: "Rialto", state: "California", stateAbbr: "CA", latitude: 34.1059, longitude: -117.3906, type: "indoor", surface: "hardwood", hoops: 2, description: "West IE Sport club on Foothill between Fontana and SB. Athletic and hungry crowd \u2014 Rialto players run with the kind of intensity that makes every session worth showing up for.", basePlayersPlaying: 7, maxPlayers: 10 },
  { id: "colton-cotton-wood", name: "Cottonwood Park Colton", shortName: "Cottonwood Colton", address: "750 E J St, Colton, CA", city: "Colton", state: "California", stateAbbr: "CA", latitude: 34.0734, longitude: -117.3034, type: "outdoor", surface: "asphalt", hoops: 2, description: "Central Colton neighborhood park with a solid outdoor court. Well-used daily with a tight community of regulars \u2014 good place to find a run any afternoon.", basePlayersPlaying: 5, maxPlayers: 10 },
  { id: "upland-sycamore-park", name: "Sycamore Park Upland", shortName: "Sycamore Park", address: "1295 N Sycamore Ave, Upland, CA", city: "Upland", state: "California", stateAbbr: "CA", latitude: 34.1176, longitude: -117.6583, type: "outdoor", surface: "asphalt", hoops: 2, description: "North Upland park with well-kept outdoor courts backed by mountain views. Upland-Rancho Cucamonga border area draws players from both cities for quality evening runs.", basePlayersPlaying: 5, maxPlayers: 10 },
  { id: "24hr-upland", name: "24 Hour Fitness Upland", shortName: "24hr Upland", address: "665 N Mountain Ave, Upland, CA", city: "Upland", state: "California", stateAbbr: "CA", latitude: 34.0981, longitude: -117.6481, type: "indoor", surface: "hardwood", hoops: 2, description: "West IE Sport club at the base of the foothills. Upland's premier indoor run \u2014 skilled players from Upland, Rancho Cucamonga, and Claremont share a competitive hardwood.", basePlayersPlaying: 7, maxPlayers: 10 }
];

// server/routes.ts
var pool = new Pool({ connectionString: process.env.DATABASE_URL });
var PROFANITY_LIST = [
  "fuck",
  "shit",
  "bitch",
  "ass",
  "asshole",
  "bastard",
  "damn",
  "crap",
  "dick",
  "cock",
  "pussy",
  "nigger",
  "nigga",
  "faggot",
  "fag",
  "slut",
  "whore",
  "cunt",
  "motherfucker",
  "motherfucking",
  "fucker",
  "fucking",
  "bullshit",
  "dumbass",
  "jackass",
  "dipshit",
  "shithead",
  "prick",
  "retard",
  "retarded",
  "nazi",
  "kike",
  "spic",
  "wetback",
  "chink",
  "cracker",
  "twat",
  "wanker",
  "bollocks",
  "arse",
  "shite",
  "feck"
];
function containsProfanity(text) {
  const lower = text.toLowerCase().replace(/[^a-z\s]/g, "");
  const words = lower.split(/\s+/);
  return words.some((w) => PROFANITY_LIST.includes(w));
}
var MAX_MESSAGES_PER_COURT = 100;
var courtMessages = /* @__PURE__ */ new Map();
function getMessages(courtId) {
  return courtMessages.get(courtId) ?? [];
}
function addMessage(msg) {
  const existing = courtMessages.get(msg.courtId) ?? [];
  const updated = [...existing, msg];
  if (updated.length > MAX_MESSAGES_PER_COURT) {
    updated.splice(0, updated.length - MAX_MESSAGES_PER_COURT);
  }
  courtMessages.set(msg.courtId, updated);
}
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 8);
}
async function sendPushNotifications(tokens, title, body, data = {}) {
  const valid = tokens.filter((t) => t && t.startsWith("ExponentPushToken["));
  if (valid.length === 0) return;
  try {
    await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(
        valid.map((to) => ({ to, title, body, data, sound: "default" }))
      )
    });
  } catch (err) {
    console.warn("Push notification send failed:", err);
  }
}
async function registerRoutes(app2) {
  await (async () => {
    try {
      let offset2 = function(seed, range) {
        const s = Math.sin(seed * 127.1 + 311.7) * 43758.5453123;
        return (s - Math.floor(s) - 0.5) * range * 2;
      }, makeCourts2 = function(stateName, stateAbbr, cityName, lat, lon, si, ci) {
        const slug = cityName.toLowerCase().replace(/[^a-z0-9]+/g, "-");
        const saSlug = stateAbbr.toLowerCase();
        const seed = si * 1e3 + ci * 100;
        const jlat = (i) => parseFloat((lat + offset2(seed + i * 3.7, 0.025)).toFixed(4));
        const jlon = (i) => parseFloat((lon + offset2(seed + i * 7.3, 0.025)).toFixed(4));
        const pick = (arr, i) => arr[Math.abs(Math.floor(offset2(seed + i * 5.1, arr.length / 2) + arr.length / 2)) % arr.length];
        const pname = pick(PARK_NAMES, 0), pname2 = pick(PARK_NAMES, 1), pname3 = pick(PARK_NAMES, 2);
        const dir = pick(DIRECTIONS, 3), ymcaArea = pick(YMCA_AREAS, 4);
        const bp1 = Math.abs(Math.floor(offset2(seed + 50, 4))) % 9;
        const bp2 = Math.abs(Math.floor(offset2(seed + 51, 4))) % 7;
        const bp3 = Math.abs(Math.floor(offset2(seed + 52, 3))) % 5;
        const hoops1 = 4 + Math.abs(Math.floor(offset2(seed + 60, 2))) % 3 * 2;
        const hoops2 = 2 + Math.abs(Math.floor(offset2(seed + 61, 1.5))) % 3 * 2;
        return [
          { id: `${saSlug}-${slug}-1`, name: `${cityName} ${pname} Park Courts`, shortName: `${pname} Park`, address: `${Math.floor(100 + Math.abs(offset2(seed + 1, 400)))} ${pname} Dr, ${cityName}, ${stateAbbr}`, city: cityName, state: stateName, stateAbbr, latitude: jlat(1), longitude: jlon(1), type: "outdoor", surface: "asphalt", hoops: hoops1, description: `Popular outdoor courts at ${pname} Park in ${cityName}.`, basePlayersPlaying: bp1, maxPlayers: 10 },
          { id: `${saSlug}-${slug}-2`, name: `${dir} ${cityName} Recreation Center`, shortName: `${dir} Rec Center`, address: `${Math.floor(200 + Math.abs(offset2(seed + 2, 600)))} ${dir} Blvd, ${cityName}, ${stateAbbr}`, city: cityName, state: stateName, stateAbbr, latitude: jlat(2), longitude: jlon(2), type: "indoor", surface: "hardwood", hoops: hoops2, description: `Indoor hardwood courts at the ${dir} ${cityName} Recreation Center.`, basePlayersPlaying: bp2, maxPlayers: 10 },
          { id: `${saSlug}-${slug}-3`, name: `YMCA ${ymcaArea} ${cityName}`, shortName: `YMCA ${ymcaArea}`, address: `${Math.floor(300 + Math.abs(offset2(seed + 3, 500)))} Main St, ${cityName}, ${stateAbbr}`, city: cityName, state: stateName, stateAbbr, latitude: jlat(3), longitude: jlon(3), type: "indoor", surface: "hardwood", hoops: 2 + Math.abs(Math.floor(offset2(seed + 63, 1))) % 2 * 2, description: `Premium YMCA facility in ${cityName}.`, basePlayersPlaying: bp3, maxPlayers: 10 },
          { id: `${saSlug}-${slug}-4`, name: `${pname2} Community Park`, shortName: `${pname2} Community`, address: `${Math.floor(100 + Math.abs(offset2(seed + 4, 700)))} ${pname2} Rd, ${cityName}, ${stateAbbr}`, city: cityName, state: stateName, stateAbbr, latitude: jlat(4), longitude: jlon(4), type: "outdoor", surface: "concrete", hoops: 2 + Math.abs(Math.floor(offset2(seed + 64, 2))) % 3 * 2, description: `Neighborhood outdoor courts at ${pname2} Community Park in ${cityName}.`, basePlayersPlaying: Math.abs(Math.floor(offset2(seed + 53, 4))) % 8, maxPlayers: 10 },
          { id: `${saSlug}-${slug}-5`, name: `${cityName} Athletic Complex`, shortName: `${cityName} Athletic`, address: `${Math.floor(500 + Math.abs(offset2(seed + 5, 800)))} Sports Way, ${cityName}, ${stateAbbr}`, city: cityName, state: stateName, stateAbbr, latitude: jlat(5), longitude: jlon(5), type: "indoor", surface: "hardwood", hoops: hoops2, description: `Modern athletic complex in ${cityName} with professional-grade hardwood courts.`, basePlayersPlaying: Math.abs(Math.floor(offset2(seed + 54, 3))) % 6, maxPlayers: 10 },
          { id: `${saSlug}-${slug}-6`, name: `${pname3} Neighborhood Courts`, shortName: `${pname3} Courts`, address: `${Math.floor(400 + Math.abs(offset2(seed + 6, 600)))} ${pname3} Ave, ${cityName}, ${stateAbbr}`, city: cityName, state: stateName, stateAbbr, latitude: jlat(6), longitude: jlon(6), type: "outdoor", surface: "asphalt", hoops: 2 + Math.abs(Math.floor(offset2(seed + 65, 1.5))) % 2 * 2, description: `Street-level outdoor courts in ${cityName}.`, basePlayersPlaying: Math.abs(Math.floor(offset2(seed + 55, 4))) % 7, maxPlayers: 10 }
        ];
      };
      var offset = offset2, makeCourts = makeCourts2;
      await pool.query(`
        CREATE TABLE IF NOT EXISTS courts (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          short_name TEXT,
          address TEXT,
          city TEXT,
          state TEXT,
          state_abbr VARCHAR(10) DEFAULT '',
          country TEXT DEFAULT 'US',
          latitude DOUBLE PRECISION,
          longitude DOUBLE PRECISION,
          type TEXT DEFAULT 'outdoor',
          surface TEXT DEFAULT 'asphalt',
          hoops INTEGER DEFAULT 4,
          description TEXT,
          base_players_playing INTEGER DEFAULT 0,
          max_players INTEGER DEFAULT 10
        )
      `);
      await pool.query(`ALTER TABLE courts ADD COLUMN IF NOT EXISTS state_abbr VARCHAR(10) DEFAULT ''`);
      const countResult = await pool.query("SELECT COUNT(*) AS n FROM courts");
      if (parseInt(countResult.rows[0].n) > 0) return;
      console.log("Courts table is empty \u2014 auto-seeding...");
      const PARK_NAMES = ["Riverside", "Highland", "Lakeside", "Eastside", "Westside", "Northside", "Southside", "Central", "Memorial", "Veterans", "Freedom", "Liberty", "Heritage", "Sunset", "Sunrise", "Greenfield", "Fairview", "Oakdale", "Maplewood", "Elmwood", "Cedar Ridge", "Pinewood", "Rolling Hills", "Meadowbrook", "Brookside", "Springdale", "Hillcrest", "Clearview", "Briarwood", "Creekside", "Timberline", "Stonegate", "Willowbrook", "Foxwood", "Valleyview"];
      const YMCA_AREAS = ["Downtown", "Northside", "Eastside", "West Branch", "South", "Central", "Metro", "Midtown", "Uptown", "Lakeside", "Community", "Family", "Athletic", "Sports", "Fitness"];
      const DIRECTIONS = ["North", "South", "East", "West"];
      const STATE_DATA = [
        ["Alabama", "AL", [["Birmingham", 33.5186, -86.8104], ["Montgomery", 32.3668, -86.2999], ["Huntsville", 34.7304, -86.5861], ["Mobile", 30.6954, -88.0399], ["Tuscaloosa", 33.2098, -87.5692]]],
        ["Alaska", "AK", [["Anchorage", 61.2181, -149.9003], ["Fairbanks", 64.8378, -147.7164], ["Juneau", 58.3005, -134.4197], ["Wasilla", 61.5814, -149.4394], ["Sitka", 57.0531, -135.33]]],
        ["Arizona", "AZ", [["Phoenix", 33.4484, -112.074], ["Tucson", 32.2226, -110.9747], ["Mesa", 33.4152, -111.8315], ["Chandler", 33.3062, -111.8413], ["Scottsdale", 33.4942, -111.9261]]],
        ["Arkansas", "AR", [["Little Rock", 34.7465, -92.2896], ["Fort Smith", 35.3859, -94.3985], ["Fayetteville", 36.0822, -94.1719], ["Springdale", 36.1867, -94.1288], ["Jonesboro", 35.8423, -90.7043]]],
        // California handled separately via CA_COURTS (169 real courts)
        ["Colorado", "CO", [["Denver", 39.7392, -104.9903], ["Colorado Springs", 38.8339, -104.8214], ["Aurora", 39.7294, -104.8319], ["Fort Collins", 40.5853, -105.0844], ["Boulder", 40.015, -105.2705]]],
        ["Connecticut", "CT", [["Hartford", 41.7637, -72.6851], ["New Haven", 41.3082, -72.9279], ["Bridgeport", 41.1865, -73.1952], ["Stamford", 41.0534, -73.5387], ["Waterbury", 41.5582, -73.0515]]],
        ["Delaware", "DE", [["Wilmington", 39.7447, -75.5484], ["Dover", 39.1582, -75.5244], ["Newark", 39.6837, -75.7497], ["Middletown", 39.4493, -75.7163], ["Smyrna", 39.2993, -75.6035]]],
        ["Florida", "FL", [["Miami", 25.7617, -80.1918], ["Orlando", 28.5383, -81.3792], ["Tampa", 27.9506, -82.4572], ["Jacksonville", 30.3322, -81.6557], ["Fort Lauderdale", 26.1224, -80.1373]]],
        ["Georgia", "GA", [["Atlanta", 33.749, -84.388], ["Augusta", 33.4735, -81.9748], ["Columbus", 32.461, -84.9877], ["Savannah", 32.0809, -81.0912], ["Athens", 33.9519, -83.3576]]],
        ["Hawaii", "HI", [["Honolulu", 21.3069, -157.8583], ["Hilo", 19.7074, -155.0885], ["Kailua", 21.4022, -157.7394], ["Pearl City", 21.3972, -157.9751], ["Waipahu", 21.3866, -158.0097]]],
        ["Idaho", "ID", [["Boise", 43.615, -116.2023], ["Meridian", 43.6121, -116.3915], ["Nampa", 43.5407, -116.5635], ["Idaho Falls", 43.4917, -112.0339], ["Pocatello", 42.8713, -112.4455]]],
        ["Illinois", "IL", [["Chicago", 41.8781, -87.6298], ["Aurora", 41.7606, -88.3201], ["Rockford", 42.2711, -89.094], ["Joliet", 41.525, -88.0817], ["Naperville", 41.7508, -88.1535]]],
        ["Indiana", "IN", [["Indianapolis", 39.7684, -86.1581], ["Fort Wayne", 41.0793, -85.1394], ["Evansville", 37.9716, -87.5711], ["South Bend", 41.6764, -86.252], ["Carmel", 39.9784, -86.118]]],
        ["Iowa", "IA", [["Des Moines", 41.5868, -93.625], ["Cedar Rapids", 41.9779, -91.6656], ["Davenport", 41.5236, -90.5776], ["Sioux City", 42.4999, -96.4003], ["Iowa City", 41.6611, -91.5302]]],
        ["Kansas", "KS", [["Wichita", 37.6872, -97.3301], ["Overland Park", 38.9822, -94.6708], ["Kansas City", 39.1142, -94.6275], ["Topeka", 39.0473, -95.689], ["Olathe", 38.8814, -94.8191]]],
        ["Kentucky", "KY", [["Louisville", 38.2527, -85.7585], ["Lexington", 38.0406, -84.5037], ["Bowling Green", 36.9903, -86.4436], ["Owensboro", 37.7719, -87.1111], ["Covington", 39.0837, -84.5085]]],
        ["Louisiana", "LA", [["New Orleans", 29.9511, -90.0715], ["Baton Rouge", 30.4515, -91.1871], ["Shreveport", 32.5252, -93.7502], ["Lafayette", 30.2241, -92.0198], ["Lake Charles", 30.2266, -93.2174]]],
        ["Maine", "ME", [["Portland", 43.6591, -70.2568], ["Lewiston", 44.1004, -70.2148], ["Bangor", 44.8012, -68.7778], ["South Portland", 43.6415, -70.3097], ["Auburn", 44.0979, -70.2312]]],
        ["Maryland", "MD", [["Baltimore", 39.2904, -76.6122], ["Frederick", 39.4143, -77.4105], ["Rockville", 39.084, -77.1528], ["Gaithersburg", 39.1434, -77.2014], ["Bowie", 38.942, -76.7791]]],
        ["Massachusetts", "MA", [["Boston", 42.3601, -71.0589], ["Worcester", 42.2626, -71.8023], ["Springfield", 42.1015, -72.5898], ["Cambridge", 42.3736, -71.1097], ["Lowell", 42.6334, -71.3162]]],
        ["Michigan", "MI", [["Detroit", 42.3314, -83.0458], ["Grand Rapids", 42.9634, -85.6681], ["Warren", 42.4775, -83.0277], ["Sterling Heights", 42.5803, -83.0302], ["Lansing", 42.7325, -84.5555]]],
        ["Minnesota", "MN", [["Minneapolis", 44.9778, -93.265], ["Saint Paul", 44.9537, -93.09], ["Rochester", 44.0121, -92.4802], ["Duluth", 46.7867, -92.1005], ["Bloomington", 44.8408, -93.3477]]],
        ["Mississippi", "MS", [["Jackson", 32.2988, -90.1848], ["Gulfport", 30.3674, -89.0928], ["Southaven", 34.9893, -89.9984], ["Hattiesburg", 31.3271, -89.2903], ["Biloxi", 30.396, -88.8853]]],
        ["Missouri", "MO", [["Kansas City", 39.0997, -94.5786], ["Saint Louis", 38.627, -90.1994], ["Springfield", 37.2153, -93.2982], ["Columbia", 38.9517, -92.3341], ["Independence", 39.0911, -94.4155]]],
        ["Montana", "MT", [["Billings", 45.7833, -108.5007], ["Missoula", 46.8721, -113.994], ["Great Falls", 47.5002, -111.3008], ["Bozeman", 45.677, -111.0429], ["Helena", 46.5958, -112.027]]],
        ["Nebraska", "NE", [["Omaha", 41.2565, -95.9345], ["Lincoln", 40.8136, -96.7026], ["Bellevue", 41.1544, -95.9146], ["Grand Island", 40.9264, -98.342], ["Kearney", 40.6993, -99.0817]]],
        ["Nevada", "NV", [["Las Vegas", 36.1699, -115.1398], ["Henderson", 36.0395, -114.9817], ["Reno", 39.5296, -119.8138], ["North Las Vegas", 36.1989, -115.1175], ["Sparks", 39.5349, -119.7527]]],
        ["New Hampshire", "NH", [["Manchester", 42.9956, -71.4548], ["Nashua", 42.7654, -71.4676], ["Concord", 43.2081, -71.5376], ["Derry", 42.8809, -71.3273], ["Rochester", 43.3042, -70.9748]]],
        ["New Jersey", "NJ", [["Newark", 40.7357, -74.1724], ["Jersey City", 40.7178, -74.0431], ["Paterson", 40.9168, -74.1718], ["Elizabeth", 40.664, -74.2107], ["Edison", 40.5188, -74.4121]]],
        ["New Mexico", "NM", [["Albuquerque", 35.0844, -106.6504], ["Las Cruces", 32.3199, -106.7637], ["Rio Rancho", 35.2328, -106.663], ["Santa Fe", 35.687, -105.9378], ["Roswell", 33.3943, -104.523]]],
        ["New York", "NY", [["New York City", 40.7128, -74.006], ["Buffalo", 42.8864, -78.8784], ["Rochester", 43.1566, -77.6088], ["Yonkers", 40.9312, -73.8988], ["Syracuse", 43.0481, -76.1474]]],
        ["North Carolina", "NC", [["Charlotte", 35.2271, -80.8431], ["Raleigh", 35.7796, -78.6382], ["Greensboro", 36.0726, -79.792], ["Durham", 35.994, -78.8986], ["Winston-Salem", 36.0999, -80.2442]]],
        ["North Dakota", "ND", [["Fargo", 46.8772, -96.7898], ["Bismarck", 46.8083, -100.7837], ["Grand Forks", 47.9253, -97.0329], ["Minot", 48.2325, -101.2963], ["West Fargo", 46.8749, -96.9003]]],
        ["Ohio", "OH", [["Columbus", 39.9612, -82.9988], ["Cleveland", 41.4993, -81.6944], ["Cincinnati", 39.1031, -84.512], ["Toledo", 41.6639, -83.5552], ["Akron", 41.0814, -81.519]]],
        ["Oklahoma", "OK", [["Oklahoma City", 35.4676, -97.5164], ["Tulsa", 36.154, -95.9928], ["Norman", 35.2226, -97.4395], ["Broken Arrow", 36.0609, -95.7975], ["Edmond", 35.6528, -97.4781]]],
        ["Oregon", "OR", [["Portland", 45.5051, -122.675], ["Salem", 44.9429, -123.0351], ["Eugene", 44.0521, -123.0868], ["Gresham", 45.4984, -122.428], ["Hillsboro", 45.5229, -122.9898]]],
        ["Pennsylvania", "PA", [["Philadelphia", 39.9526, -75.1652], ["Pittsburgh", 40.4406, -79.9959], ["Allentown", 40.6023, -75.4714], ["Erie", 42.1292, -80.0851], ["Reading", 40.3356, -75.9269]]],
        ["Rhode Island", "RI", [["Providence", 41.824, -71.4128], ["Warwick", 41.7001, -71.4162], ["Cranston", 41.7798, -71.4373], ["Pawtucket", 41.8787, -71.3826], ["East Providence", 41.8137, -71.37]]],
        ["South Carolina", "SC", [["Columbia", 34.0007, -81.0348], ["Charleston", 32.7765, -79.9311], ["North Charleston", 32.8546, -79.9748], ["Mount Pleasant", 32.8323, -79.8284], ["Rock Hill", 34.9249, -81.0251]]],
        ["South Dakota", "SD", [["Sioux Falls", 43.5473, -96.7283], ["Rapid City", 44.0805, -103.231], ["Aberdeen", 45.4647, -98.4865], ["Brookings", 44.3114, -96.7984], ["Watertown", 44.8994, -97.115]]],
        ["Tennessee", "TN", [["Nashville", 36.1627, -86.7816], ["Memphis", 35.1495, -90.049], ["Knoxville", 35.9606, -83.9207], ["Chattanooga", 35.0456, -85.3097], ["Clarksville", 36.5298, -87.3595]]],
        ["Texas", "TX", [["Houston", 29.7604, -95.3698], ["San Antonio", 29.4241, -98.4936], ["Dallas", 32.7767, -96.797], ["Austin", 30.2672, -97.7431], ["Fort Worth", 32.7555, -97.3308]]],
        ["Utah", "UT", [["Salt Lake City", 40.7608, -111.891], ["West Valley City", 40.6916, -112.001], ["Provo", 40.2338, -111.6585], ["West Jordan", 40.6097, -111.9391], ["Orem", 40.2969, -111.6946]]],
        ["Vermont", "VT", [["Burlington", 44.4759, -73.2121], ["South Burlington", 44.4669, -73.171], ["Rutland", 43.6106, -72.9726], ["Barre", 44.1973, -72.5023], ["Montpelier", 44.2601, -72.5754]]],
        ["Virginia", "VA", [["Virginia Beach", 36.8529, -75.978], ["Norfolk", 36.8968, -76.2591], ["Chesapeake", 36.7682, -76.2875], ["Richmond", 37.5407, -77.436], ["Newport News", 37.0871, -76.473]]],
        ["Washington", "WA", [["Seattle", 47.6062, -122.3321], ["Spokane", 47.6588, -117.426], ["Tacoma", 47.2529, -122.4443], ["Vancouver", 45.6387, -122.6615], ["Bellevue", 47.6101, -122.2015]]],
        ["West Virginia", "WV", [["Charleston", 38.3498, -81.6326], ["Huntington", 38.4193, -82.4452], ["Morgantown", 39.6295, -79.9559], ["Parkersburg", 39.2667, -81.5615], ["Wheeling", 40.064, -80.7209]]],
        ["Wisconsin", "WI", [["Milwaukee", 43.0389, -87.9065], ["Madison", 43.0731, -89.4012], ["Green Bay", 44.5133, -88.0133], ["Kenosha", 42.5847, -87.8212], ["Racine", 42.7261, -87.7829]]],
        ["Wyoming", "WY", [["Cheyenne", 41.14, -104.8202], ["Casper", 42.8666, -106.3131], ["Laramie", 41.3114, -105.5911], ["Gillette", 44.2911, -105.5022], ["Rock Springs", 41.5875, -109.2029]]]
      ];
      let courts = [];
      for (let si = 0; si < STATE_DATA.length; si++) {
        const [stateName, stateAbbr, cities] = STATE_DATA[si];
        for (let ci = 0; ci < cities.length; ci++) {
          const [cityName, lat, lon] = cities[ci];
          courts = courts.concat(makeCourts2(stateName, stateAbbr, cityName, lat, lon, si, ci));
        }
      }
      courts = courts.concat(CA_COURTS.map((c) => ({ ...c, type: c.type, surface: c.surface })));
      const chunkSize = 50;
      for (let i = 0; i < courts.length; i += chunkSize) {
        const chunk = courts.slice(i, i + chunkSize);
        const placeholders = chunk.map((_, j) => {
          const b = j * 16;
          return `($${b + 1},$${b + 2},$${b + 3},$${b + 4},$${b + 5},$${b + 6},$${b + 7},$${b + 8},$${b + 9},$${b + 10},$${b + 11},$${b + 12},$${b + 13},$${b + 14},$${b + 15},$${b + 16})`;
        }).join(",");
        const values = chunk.flatMap((c) => [c.id, c.name, c.shortName, c.address, c.city, c.state, c.stateAbbr, "US", c.latitude, c.longitude, c.type, c.surface, c.hoops, c.description, c.basePlayersPlaying, c.maxPlayers]);
        await pool.query(
          `INSERT INTO courts (id,name,short_name,address,city,state,state_abbr,country,latitude,longitude,type,surface,hoops,description,base_players_playing,max_players)
           VALUES ${placeholders} ON CONFLICT (id) DO NOTHING`,
          values
        );
      }
      console.log(`\u2713 Auto-seeded ${courts.length} courts into production database`);
    } catch (err) {
      console.error("Auto-seed error:", err);
    }
  })();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS posts (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      username TEXT NOT NULL,
      avatar_base64 TEXT,
      image_base64 TEXT NOT NULL,
      caption TEXT,
      court_id TEXT,
      court_name TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS post_likes (
      post_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      PRIMARY KEY (post_id, user_id)
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS post_comments (
      id TEXT PRIMARY KEY,
      post_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      username TEXT NOT NULL,
      avatar_base64 TEXT,
      text TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);
  const ADMIN_USER_ID = "17731833451956z1lxkg";
  app2.get("/api/admin/stats", async (req, res) => {
    const { userId } = req.query;
    if (userId !== ADMIN_USER_ID) {
      return res.status(403).json({ message: "Forbidden" });
    }
    try {
      const [
        totalUsers,
        skillBreakdown,
        newToday,
        newThisWeek,
        totalFriendships,
        pendingRequests,
        totalDMs,
        recentUsers
      ] = await Promise.all([
        pool.query("SELECT COUNT(*) AS count FROM users"),
        pool.query("SELECT skill_level, COUNT(*) AS count FROM users GROUP BY skill_level ORDER BY count DESC"),
        pool.query("SELECT COUNT(*) AS count FROM users WHERE created_at >= NOW() - INTERVAL '1 day'"),
        pool.query("SELECT COUNT(*) AS count FROM users WHERE created_at >= NOW() - INTERVAL '7 days'"),
        pool.query("SELECT COUNT(*) AS count FROM friendships WHERE status = 'accepted'"),
        pool.query("SELECT COUNT(*) AS count FROM friendships WHERE status = 'pending'"),
        pool.query("SELECT COUNT(*) AS count FROM direct_messages"),
        pool.query("SELECT username, skill_level, email, created_at FROM users ORDER BY created_at DESC LIMIT 10")
      ]);
      res.json({
        totalUsers: parseInt(totalUsers.rows[0].count),
        skillBreakdown: skillBreakdown.rows,
        newToday: parseInt(newToday.rows[0].count),
        newThisWeek: parseInt(newThisWeek.rows[0].count),
        totalFriendships: parseInt(totalFriendships.rows[0].count),
        pendingRequests: parseInt(pendingRequests.rows[0].count),
        totalDMs: parseInt(totalDMs.rows[0].count),
        totalCourts: 164,
        recentUsers: recentUsers.rows
      });
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch stats" });
    }
  });
  app2.post("/api/users", async (req, res) => {
    const { userId, username, handle, email, phone, skillLevel } = req.body;
    if (!userId || !username || !email) {
      return res.status(400).json({ message: "userId, username, and email are required" });
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ message: "Invalid email address" });
    }
    if (handle) {
      if (!/^[a-zA-Z0-9_]{3,30}$/.test(handle.trim())) {
        return res.status(400).json({ message: "Username can only contain letters, numbers, and underscores (3\u201330 chars)." });
      }
    }
    if (phone) {
      const digits = phone.replace(/\D/g, "");
      if (digits.length < 10 || digits.length > 15) {
        return res.status(400).json({ message: "Please enter a valid phone number." });
      }
    }
    try {
      const result = await pool.query(
        `INSERT INTO users (user_id, username, handle, email, phone, skill_level, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW())
         ON CONFLICT (user_id)
         DO UPDATE SET username = EXCLUDED.username, handle = EXCLUDED.handle, email = EXCLUDED.email,
           phone = EXCLUDED.phone, skill_level = EXCLUDED.skill_level, updated_at = NOW()
         RETURNING user_id, username, handle, skill_level`,
        [userId, username.trim(), handle?.trim().toLowerCase() || null, email.trim().toLowerCase(), phone?.trim() || null, skillLevel ?? "Intermediate"]
      );
      res.status(200).json(result.rows[0]);
    } catch (err) {
      if (err.code === "23505" && err.constraint === "users_email_key") {
        return res.status(409).json({ message: "That email is already registered to another account." });
      }
      console.error("User upsert error:", err);
      res.status(500).json({ message: "Server error" });
    }
  });
  app2.get("/api/users/search", async (req, res) => {
    const q = (req.query.q ?? "").trim();
    const myId = (req.query.myId ?? "").trim();
    if (!q || q.length < 2) return res.json([]);
    try {
      const result = await pool.query(
        `SELECT u.user_id, u.username, u.handle, u.skill_level,
           f.status AS friendship_status,
           f.requester_id AS friendship_requester
         FROM users u
         LEFT JOIN friendships f
           ON (f.requester_id = u.user_id AND f.addressee_id = $2)
           OR (f.addressee_id = u.user_id AND f.requester_id = $2)
         WHERE (u.username ILIKE $1 OR u.handle ILIKE $1) AND u.user_id != $2
         ORDER BY u.username ASC LIMIT 20`,
        [`%${q}%`, myId || "___none___"]
      );
      res.json(result.rows);
    } catch (err) {
      console.error("User search error:", err);
      res.status(500).json({ message: "Server error" });
    }
  });
  app2.get("/api/users/:userId", async (req, res) => {
    const { userId } = req.params;
    try {
      const result = await pool.query(
        "SELECT user_id, username, skill_level, created_at FROM users WHERE user_id = $1",
        [userId]
      );
      if (result.rows.length === 0) return res.status(404).json({ message: "User not found" });
      res.json(result.rows[0]);
    } catch (err) {
      console.error("User fetch error:", err);
      res.status(500).json({ message: "Server error" });
    }
  });
  app2.get("/api/users/:userId/private", async (req, res) => {
    const { userId } = req.params;
    const { requesterId } = req.query;
    if (!requesterId || requesterId !== userId) {
      return res.status(403).json({ message: "Forbidden" });
    }
    try {
      const result = await pool.query(
        "SELECT user_id, username, email, phone, skill_level, created_at FROM users WHERE user_id = $1",
        [userId]
      );
      if (result.rows.length === 0) return res.status(404).json({ message: "User not found" });
      res.json(result.rows[0]);
    } catch (err) {
      console.error("User fetch error:", err);
      res.status(500).json({ message: "Server error" });
    }
  });
  app2.post("/api/users/:userId/avatar", async (req, res) => {
    const { userId } = req.params;
    const { base64, requesterId } = req.body;
    if (!requesterId || requesterId !== userId) {
      return res.status(403).json({ message: "Forbidden" });
    }
    if (!base64 || typeof base64 !== "string") {
      return res.status(400).json({ message: "base64 image required" });
    }
    if (base64.length > 5e5) {
      return res.status(413).json({ message: "Image too large. Please choose a smaller photo." });
    }
    try {
      await pool.query(
        "UPDATE users SET avatar_base64 = $1, updated_at = NOW() WHERE user_id = $2",
        [base64, userId]
      );
      res.json({ success: true });
    } catch (err) {
      console.error("Avatar update error:", err);
      res.status(500).json({ message: "Server error" });
    }
  });
  app2.get("/api/users/:userId/avatar", async (req, res) => {
    const { userId } = req.params;
    try {
      const result = await pool.query(
        "SELECT avatar_base64 FROM users WHERE user_id = $1",
        [userId]
      );
      if (result.rows.length === 0) return res.status(404).json({ message: "User not found" });
      res.json({ avatar_base64: result.rows[0].avatar_base64 ?? null });
    } catch (err) {
      console.error("Avatar fetch error:", err);
      res.status(500).json({ message: "Server error" });
    }
  });
  app2.post("/api/friends/request", async (req, res) => {
    const { requesterId, addresseeId } = req.body;
    if (!requesterId || !addresseeId || requesterId === addresseeId) {
      return res.status(400).json({ message: "Invalid request" });
    }
    try {
      const existing = await pool.query(
        `SELECT id, status FROM friendships
         WHERE (requester_id = $1 AND addressee_id = $2)
            OR (requester_id = $2 AND addressee_id = $1)`,
        [requesterId, addresseeId]
      );
      if (existing.rows.length > 0) {
        const s = existing.rows[0].status;
        if (s === "accepted") return res.status(409).json({ message: "Already friends" });
        if (s === "pending") return res.status(409).json({ message: "Friend request already sent" });
      }
      await pool.query(
        `INSERT INTO friendships (requester_id, addressee_id, status) VALUES ($1, $2, 'pending')`,
        [requesterId, addresseeId]
      );
      const [requesterRes, addresseeRes] = await Promise.all([
        pool.query(`SELECT username FROM users WHERE user_id = $1`, [requesterId]),
        pool.query(`SELECT push_token FROM users WHERE user_id = $1`, [addresseeId])
      ]);
      const requesterName = requesterRes.rows[0]?.username ?? "Someone";
      const addresseeToken = addresseeRes.rows[0]?.push_token;
      if (addresseeToken) {
        sendPushNotifications([addresseeToken], "New friend request \u{1F3C0}", `${requesterName} wants to hoop with you!`, { screen: "messages" });
      }
      res.status(201).json({ message: "Friend request sent" });
    } catch (err) {
      if (err.code === "23505") return res.status(409).json({ message: "Friend request already sent" });
      console.error("Friend request error:", err);
      res.status(500).json({ message: "Server error" });
    }
  });
  app2.post("/api/friends/respond", async (req, res) => {
    const { requesterId, addresseeId, action } = req.body;
    if (!requesterId || !addresseeId || !["accept", "decline"].includes(action)) {
      return res.status(400).json({ message: "requesterId, addresseeId, and action (accept|decline) required" });
    }
    try {
      if (action === "accept") {
        await pool.query(
          `UPDATE friendships SET status = 'accepted', updated_at = NOW()
           WHERE requester_id = $1 AND addressee_id = $2 AND status = 'pending'`,
          [requesterId, addresseeId]
        );
      } else {
        await pool.query(
          `DELETE FROM friendships WHERE requester_id = $1 AND addressee_id = $2`,
          [requesterId, addresseeId]
        );
      }
      res.json({ success: true });
    } catch (err) {
      console.error("Friend respond error:", err);
      res.status(500).json({ message: "Server error" });
    }
  });
  app2.get("/api/friends/requests/:userId", async (req, res) => {
    const { userId } = req.params;
    try {
      const result = await pool.query(
        `SELECT f.id, f.requester_id, u.username AS requester_username, u.skill_level, f.created_at
         FROM friendships f
         JOIN users u ON u.user_id = f.requester_id
         WHERE f.addressee_id = $1 AND f.status = 'pending'
         ORDER BY f.created_at DESC`,
        [userId]
      );
      res.json(result.rows);
    } catch (err) {
      console.error("Friend requests error:", err);
      res.status(500).json({ message: "Server error" });
    }
  });
  app2.get("/api/friends/:userId", async (req, res) => {
    const { userId } = req.params;
    try {
      const result = await pool.query(
        `SELECT
           CASE WHEN f.requester_id = $1 THEN f.addressee_id ELSE f.requester_id END AS friend_id,
           CASE WHEN f.requester_id = $1 THEN a.username ELSE r.username END AS username,
           CASE WHEN f.requester_id = $1 THEN a.skill_level ELSE r.skill_level END AS skill_level,
           f.created_at
         FROM friendships f
         LEFT JOIN users r ON r.user_id = f.requester_id
         LEFT JOIN users a ON a.user_id = f.addressee_id
         WHERE (f.requester_id = $1 OR f.addressee_id = $1) AND f.status = 'accepted'
         ORDER BY username ASC`,
        [userId]
      );
      res.json(result.rows);
    } catch (err) {
      console.error("Friends list error:", err);
      res.status(500).json({ message: "Server error" });
    }
  });
  app2.delete("/api/friends/:userId/:friendId", async (req, res) => {
    const { userId, friendId } = req.params;
    try {
      await pool.query(
        `DELETE FROM friendships
         WHERE (requester_id = $1 AND addressee_id = $2)
            OR (requester_id = $2 AND addressee_id = $1)`,
        [userId, friendId]
      );
      res.json({ success: true });
    } catch (err) {
      console.error("Unfriend error:", err);
      res.status(500).json({ message: "Server error" });
    }
  });
  async function areFriends(userA, userB) {
    const result = await pool.query(
      `SELECT 1 FROM friendships
       WHERE ((requester_id = $1 AND addressee_id = $2) OR (requester_id = $2 AND addressee_id = $1))
         AND status = 'accepted' LIMIT 1`,
      [userA, userB]
    );
    return result.rows.length > 0;
  }
  app2.get("/api/dms/conversations/:userId", async (req, res) => {
    const { userId } = req.params;
    try {
      const result = await pool.query(
        `SELECT DISTINCT ON (partner_id)
           partner_id, partner_username, partner_skill, text, sender_id, created_at
         FROM (
           SELECT
             CASE WHEN dm.sender_id = $1 THEN dm.receiver_id ELSE dm.sender_id END AS partner_id,
             CASE WHEN dm.sender_id = $1 THEN rv.username   ELSE su.username   END AS partner_username,
             CASE WHEN dm.sender_id = $1 THEN rv.skill_level ELSE su.skill_level END AS partner_skill,
             dm.text, dm.sender_id, dm.created_at
           FROM direct_messages dm
           LEFT JOIN users su ON su.user_id = dm.sender_id
           LEFT JOIN users rv ON rv.user_id = dm.receiver_id
           WHERE dm.sender_id = $1 OR dm.receiver_id = $1
           ORDER BY dm.created_at DESC
         ) sub
         ORDER BY partner_id, created_at DESC`,
        [userId]
      );
      res.json(result.rows);
    } catch (err) {
      console.error("Conversations error:", err);
      res.status(500).json({ message: "Server error" });
    }
  });
  app2.get("/api/dms/:userA/:userB", async (req, res) => {
    const { userA, userB } = req.params;
    try {
      if (!await areFriends(userA, userB)) {
        return res.status(403).json({ message: "You must be friends to view messages" });
      }
      const result = await pool.query(
        `SELECT dm.*, u.username AS sender_username, u.skill_level AS sender_skill
         FROM direct_messages dm
         JOIN users u ON u.user_id = dm.sender_id
         WHERE (dm.sender_id = $1 AND dm.receiver_id = $2)
            OR (dm.sender_id = $2 AND dm.receiver_id = $1)
         ORDER BY dm.created_at ASC
         LIMIT 200`,
        [userA, userB]
      );
      res.json(result.rows);
    } catch (err) {
      console.error("DM fetch error:", err);
      res.status(500).json({ message: "Server error" });
    }
  });
  app2.post("/api/dms", async (req, res) => {
    const { senderId, receiverId, text } = req.body;
    if (!senderId || !receiverId || !text) {
      return res.status(400).json({ message: "senderId, receiverId, and text are required" });
    }
    const trimmed = text.trim();
    if (!trimmed || trimmed.length > 500) {
      return res.status(400).json({ message: "Message must be 1\u2013500 characters" });
    }
    if (containsProfanity(trimmed)) {
      return res.status(422).json({ message: "Your message contains language that isn't allowed." });
    }
    try {
      if (!await areFriends(senderId, receiverId)) {
        return res.status(403).json({ message: "You must be friends to send a message" });
      }
      const result = await pool.query(
        `INSERT INTO direct_messages (sender_id, receiver_id, text) VALUES ($1, $2, $3) RETURNING *`,
        [senderId, receiverId, trimmed]
      );
      const senderRes = await pool.query(`SELECT username FROM users WHERE user_id = $1`, [senderId]);
      const receiverRes = await pool.query(`SELECT push_token FROM users WHERE user_id = $1`, [receiverId]);
      const senderName = senderRes.rows[0]?.username ?? "Someone";
      const receiverToken = receiverRes.rows[0]?.push_token;
      if (receiverToken) {
        sendPushNotifications([receiverToken], `${senderName} \u{1F4AC}`, trimmed.length > 60 ? trimmed.slice(0, 60) + "\u2026" : trimmed, { screen: "messages" });
      }
      res.status(201).json(result.rows[0]);
    } catch (err) {
      console.error("DM send error:", err);
      res.status(500).json({ message: "Server error" });
    }
  });
  app2.post("/api/users/:userId/push-token", async (req, res) => {
    const { userId } = req.params;
    const { token } = req.body;
    if (!token) return res.status(400).json({ message: "token required" });
    try {
      await pool.query(
        `UPDATE users SET push_token = $1 WHERE user_id = $2`,
        [token, userId]
      );
      res.json({ ok: true });
    } catch (err) {
      console.error("Push token save error:", err);
      res.status(500).json({ message: "Server error" });
    }
  });
  app2.get("/api/waitlists/:courtId", async (req, res) => {
    const { courtId } = req.params;
    try {
      const result = await pool.query(
        `SELECT user_id AS "userId", username, skill_level AS "skillLevel", joined_at AS "timestamp", position
         FROM waitlists WHERE court_id = $1 ORDER BY position ASC`,
        [courtId]
      );
      res.json(result.rows);
    } catch (err) {
      console.error("Waitlist fetch error:", err);
      res.status(500).json({ message: "Server error" });
    }
  });
  app2.post("/api/waitlists/:courtId/join", async (req, res) => {
    const { courtId } = req.params;
    const { userId, username, skillLevel } = req.body;
    if (!userId || !username) return res.status(400).json({ message: "userId and username required" });
    try {
      const countRes = await pool.query(
        `SELECT COUNT(*) AS count FROM waitlists WHERE court_id = $1`,
        [courtId]
      );
      const position = parseInt(countRes.rows[0].count) + 1;
      await pool.query(
        `INSERT INTO waitlists (court_id, user_id, username, skill_level, position)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (court_id, user_id) DO NOTHING`,
        [courtId, userId, username, skillLevel ?? "Intermediate", position]
      );
      const list = await pool.query(
        `SELECT user_id AS "userId", username, skill_level AS "skillLevel", joined_at AS "timestamp", position
         FROM waitlists WHERE court_id = $1 ORDER BY position ASC`,
        [courtId]
      );
      res.status(201).json(list.rows);
    } catch (err) {
      console.error("Waitlist join error:", err);
      res.status(500).json({ message: "Server error" });
    }
  });
  app2.delete("/api/waitlists/:courtId/leave", async (req, res) => {
    const { courtId } = req.params;
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ message: "userId required" });
    try {
      const leavingRow = await pool.query(
        `SELECT position FROM waitlists WHERE court_id = $1 AND user_id = $2`,
        [courtId, userId]
      );
      if (leavingRow.rows.length === 0) return res.json({ ok: true });
      const leavingPosition = leavingRow.rows[0].position;
      await pool.query(
        `DELETE FROM waitlists WHERE court_id = $1 AND user_id = $2`,
        [courtId, userId]
      );
      await pool.query(
        `UPDATE waitlists SET position = position - 1
         WHERE court_id = $1 AND position > $2`,
        [courtId, leavingPosition]
      );
      const courtRes = await pool.query(`SELECT name FROM courts WHERE id = $1`, [courtId]);
      const courtName = courtRes.rows[0]?.name ?? "the court";
      const promoted = await pool.query(
        `SELECT w.user_id, u.push_token, w.position
         FROM waitlists w
         JOIN users u ON u.user_id = w.user_id
         WHERE w.court_id = $1 AND w.position <= $2 AND u.push_token IS NOT NULL`,
        [courtId, leavingPosition]
      );
      for (const row of promoted.rows) {
        const pos = row.position;
        const title = pos === 1 ? "You're next! \u{1F3C0}" : `Waitlist update`;
        const body = pos === 1 ? `You're first in line at ${courtName}!` : `You moved up to #${pos} at ${courtName}`;
        sendPushNotifications([row.push_token], title, body, { courtId });
      }
      res.json({ ok: true });
    } catch (err) {
      console.error("Waitlist leave error:", err);
      res.status(500).json({ message: "Server error" });
    }
  });
  const failedAttempts = /* @__PURE__ */ new Map();
  app2.get("/admin", (_req, res) => {
    const adminPath = path.resolve(process.cwd(), "server", "templates", "admin.html");
    res.status(200).send(fs.readFileSync(adminPath, "utf-8"));
  });
  app2.post("/api/admin/verify", (req, res) => {
    const ip = req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.socket.remoteAddress || "unknown";
    const now = Date.now();
    const record = failedAttempts.get(ip);
    if (record && record.lockedUntil > now) {
      const secs = Math.ceil((record.lockedUntil - now) / 1e3);
      return res.status(429).json({ message: `Too many failed attempts. Try again in ${secs}s.` });
    }
    const adminPassword = process.env.ADMIN_PASSWORD;
    const provided = req.body?.adminPassword;
    if (!adminPassword || provided !== adminPassword) {
      const prev = failedAttempts.get(ip) ?? { count: 0, lockedUntil: 0 };
      const count = prev.count + 1;
      const lockedUntil = count >= 5 ? now + 15 * 60 * 1e3 : 0;
      failedAttempts.set(ip, { count, lockedUntil });
      return res.status(403).json({ message: "Incorrect password." });
    }
    failedAttempts.delete(ip);
    res.json({ ok: true });
  });
  app2.get("/api/courts", async (_req, res) => {
    try {
      const result = await pool.query(
        `SELECT id, name, short_name AS "shortName", address, city, state,
                COALESCE(state_abbr, '') AS "stateAbbr", country,
                latitude, longitude, type, surface, hoops, description,
                base_players_playing AS "basePlayersPlaying", max_players AS "maxPlayers"
         FROM courts ORDER BY state, city, name`
      );
      res.set("Cache-Control", "no-store");
      res.json(result.rows);
    } catch (err) {
      console.error("Fetch courts error:", err);
      res.status(500).json({ message: "Failed to fetch courts" });
    }
  });
  function checkAdminPassword(req, res) {
    const adminPassword = process.env.ADMIN_PASSWORD;
    const provided = req.headers["x-admin-password"] || req.body?.adminPassword;
    if (!adminPassword || provided !== adminPassword) {
      res.status(403).json({ message: "Forbidden" });
      return false;
    }
    return true;
  }
  function slugify(name) {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  }
  app2.post("/api/admin/courts", async (req, res) => {
    if (!checkAdminPassword(req, res)) return;
    const { name, shortName, address, city, state, country, latitude, longitude, type, surface, hoops, description, basePlayersPlaying, maxPlayers } = req.body;
    if (!name || !shortName || !address || !city || !latitude || !longitude || !type || !surface || !description) {
      return res.status(400).json({ message: "Missing required fields" });
    }
    const id = slugify(name) + "-" + Date.now().toString(36);
    try {
      const result = await pool.query(
        `INSERT INTO courts (id, name, short_name, address, city, state, country, latitude, longitude, type, surface, hoops, description, base_players_playing, max_players)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING *`,
        [id, name, shortName, address, city, state ?? "CA", country ?? "US", latitude, longitude, type, surface, hoops ?? 2, description, basePlayersPlaying ?? 5, maxPlayers ?? 10]
      );
      res.status(201).json(result.rows[0]);
    } catch (err) {
      console.error("Create court error:", err);
      res.status(500).json({ message: "Failed to create court" });
    }
  });
  app2.put("/api/admin/courts/:id", async (req, res) => {
    if (!checkAdminPassword(req, res)) return;
    const { name, shortName, address, city, state, country, latitude, longitude, type, surface, hoops, description, basePlayersPlaying, maxPlayers } = req.body;
    try {
      const result = await pool.query(
        `UPDATE courts SET name=$1, short_name=$2, address=$3, city=$4, state=$5, country=$6,
         latitude=$7, longitude=$8, type=$9, surface=$10, hoops=$11, description=$12,
         base_players_playing=$13, max_players=$14
         WHERE id=$15 RETURNING *`,
        [name, shortName, address, city, state ?? "CA", country ?? "US", latitude, longitude, type, surface, hoops ?? 2, description, basePlayersPlaying ?? 5, maxPlayers ?? 10, req.params.id]
      );
      if (result.rowCount === 0) return res.status(404).json({ message: "Court not found" });
      res.json(result.rows[0]);
    } catch (err) {
      console.error("Update court error:", err);
      res.status(500).json({ message: "Failed to update court" });
    }
  });
  app2.delete("/api/admin/courts/:id", async (req, res) => {
    if (!checkAdminPassword(req, res)) return;
    try {
      const result = await pool.query("DELETE FROM courts WHERE id=$1", [req.params.id]);
      if (result.rowCount === 0) return res.status(404).json({ message: "Court not found" });
      res.json({ success: true });
    } catch (err) {
      console.error("Delete court error:", err);
      res.status(500).json({ message: "Failed to delete court" });
    }
  });
  app2.get("/api/courts/:id/messages", (req, res) => {
    res.json(getMessages(req.params.id));
  });
  app2.post("/api/courts/:id/messages", (req, res) => {
    const { id } = req.params;
    const { userId, username, skillLevel, text } = req.body;
    if (!userId || !username || !text || typeof text !== "string") {
      return res.status(400).json({ message: "userId, username, and text are required" });
    }
    const trimmed = text.trim();
    if (!trimmed || trimmed.length > 200) {
      return res.status(400).json({ message: "Message must be 1\u2013200 characters" });
    }
    if (containsProfanity(trimmed)) {
      return res.status(422).json({ message: "Your message contains language that isn't allowed. Keep it clean." });
    }
    const msg = {
      id: generateId(),
      courtId: id,
      userId,
      username,
      skillLevel: skillLevel ?? "Intermediate",
      text: trimmed,
      timestamp: Date.now()
    };
    addMessage(msg);
    res.status(201).json(msg);
  });
  app2.delete("/api/courts/:courtId/messages/:msgId", (req, res) => {
    const { courtId, msgId } = req.params;
    const { userId } = req.body;
    const messages = getMessages(courtId);
    const msg = messages.find((m) => m.id === msgId);
    if (!msg) return res.status(404).json({ message: "Message not found" });
    if (msg.userId !== userId) return res.status(403).json({ message: "Not your message" });
    courtMessages.set(courtId, messages.filter((m) => m.id !== msgId));
    res.json({ success: true });
  });
  app2.get("/api/feed/:userId", async (req, res) => {
    const { userId } = req.params;
    try {
      const result = await pool.query(
        `SELECT p.*,
          COUNT(DISTINCT pl.user_id)::int AS like_count,
          COUNT(DISTINCT pc.id)::int AS comment_count,
          BOOL_OR(pl.user_id = $1) AS user_liked
         FROM posts p
         LEFT JOIN post_likes pl ON pl.post_id = p.id
         LEFT JOIN post_comments pc ON pc.post_id = p.id
         WHERE p.user_id = $1
           OR p.user_id IN (
             SELECT CASE WHEN requester_id = $1 THEN addressee_id ELSE requester_id END
             FROM friendships
             WHERE (requester_id = $1 OR addressee_id = $1) AND status = 'accepted'
           )
         GROUP BY p.id
         ORDER BY p.created_at DESC
         LIMIT 50`,
        [userId]
      );
      res.json(
        result.rows.map((r) => ({
          id: r.id,
          userId: r.user_id,
          username: r.username,
          avatarBase64: r.avatar_base64,
          imageBase64: r.image_base64,
          caption: r.caption,
          courtId: r.court_id,
          courtName: r.court_name,
          createdAt: r.created_at,
          likeCount: r.like_count,
          commentCount: r.comment_count,
          userLiked: r.user_liked ?? false
        }))
      );
    } catch (err) {
      console.error("Feed fetch error:", err);
      res.status(500).json({ message: "Failed to fetch feed" });
    }
  });
  app2.post("/api/posts", async (req, res) => {
    const { userId, username, avatarBase64, imageBase64, caption, courtId, courtName } = req.body;
    if (!userId || !username || !imageBase64) {
      return res.status(400).json({ message: "userId, username, and imageBase64 are required" });
    }
    if (caption && containsProfanity(caption)) {
      return res.status(422).json({ message: "Your caption contains language that isn't allowed. Keep it clean." });
    }
    const id = generateId();
    try {
      await pool.query(
        `INSERT INTO posts (id, user_id, username, avatar_base64, image_base64, caption, court_id, court_name)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [id, userId, username, avatarBase64 ?? null, imageBase64, caption ?? null, courtId ?? null, courtName ?? null]
      );
      res.status(201).json({ id, userId, username, avatarBase64, imageBase64, caption, courtId, courtName, likeCount: 0, commentCount: 0, userLiked: false, createdAt: /* @__PURE__ */ new Date() });
    } catch (err) {
      console.error("Create post error:", err);
      res.status(500).json({ message: "Failed to create post" });
    }
  });
  app2.delete("/api/posts/:postId", async (req, res) => {
    const { postId } = req.params;
    const { userId } = req.body;
    try {
      const check = await pool.query("SELECT user_id FROM posts WHERE id = $1", [postId]);
      if (check.rows.length === 0) return res.status(404).json({ message: "Post not found" });
      if (check.rows[0].user_id !== userId) return res.status(403).json({ message: "Not your post" });
      await pool.query("DELETE FROM post_likes WHERE post_id = $1", [postId]);
      await pool.query("DELETE FROM post_comments WHERE post_id = $1", [postId]);
      await pool.query("DELETE FROM posts WHERE id = $1", [postId]);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ message: "Failed to delete post" });
    }
  });
  app2.post("/api/posts/:postId/like", async (req, res) => {
    const { postId } = req.params;
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ message: "userId required" });
    try {
      const existing = await pool.query(
        "SELECT 1 FROM post_likes WHERE post_id = $1 AND user_id = $2",
        [postId, userId]
      );
      if (existing.rows.length > 0) {
        await pool.query("DELETE FROM post_likes WHERE post_id = $1 AND user_id = $2", [postId, userId]);
        res.json({ liked: false });
      } else {
        await pool.query("INSERT INTO post_likes (post_id, user_id) VALUES ($1, $2)", [postId, userId]);
        res.json({ liked: true });
      }
    } catch (err) {
      res.status(500).json({ message: "Failed to toggle like" });
    }
  });
  app2.get("/api/posts/:postId/comments", async (req, res) => {
    const { postId } = req.params;
    try {
      const result = await pool.query(
        "SELECT * FROM post_comments WHERE post_id = $1 ORDER BY created_at ASC",
        [postId]
      );
      res.json(
        result.rows.map((r) => ({
          id: r.id,
          postId: r.post_id,
          userId: r.user_id,
          username: r.username,
          avatarBase64: r.avatar_base64,
          text: r.text,
          createdAt: r.created_at
        }))
      );
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch comments" });
    }
  });
  app2.post("/api/posts/:postId/comments", async (req, res) => {
    const { postId } = req.params;
    const { userId, username, avatarBase64, text } = req.body;
    if (!userId || !username || !text) {
      return res.status(400).json({ message: "userId, username, and text are required" });
    }
    const trimmed = text.trim();
    if (!trimmed || trimmed.length > 300) return res.status(400).json({ message: "Comment must be 1\u2013300 characters" });
    if (containsProfanity(trimmed)) {
      return res.status(422).json({ message: "Your comment contains language that isn't allowed. Keep it clean." });
    }
    const id = generateId();
    try {
      await pool.query(
        "INSERT INTO post_comments (id, post_id, user_id, username, avatar_base64, text) VALUES ($1, $2, $3, $4, $5, $6)",
        [id, postId, userId, username, avatarBase64 ?? null, trimmed]
      );
      res.status(201).json({ id, postId, userId, username, avatarBase64, text: trimmed, createdAt: /* @__PURE__ */ new Date() });
    } catch (err) {
      res.status(500).json({ message: "Failed to add comment" });
    }
  });
  app2.delete("/api/posts/:postId/comments/:commentId", async (req, res) => {
    const { commentId } = req.params;
    const { userId } = req.body;
    try {
      const check = await pool.query("SELECT user_id FROM post_comments WHERE id = $1", [commentId]);
      if (check.rows.length === 0) return res.status(404).json({ message: "Comment not found" });
      if (check.rows[0].user_id !== userId) return res.status(403).json({ message: "Not your comment" });
      await pool.query("DELETE FROM post_comments WHERE id = $1", [commentId]);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ message: "Failed to delete comment" });
    }
  });
  const httpServer = createServer(app2);
  return httpServer;
}

// server/index.ts
import * as fs2 from "fs";
import * as path2 from "path";
var app = express();
var log = console.log;
function setupCors(app2) {
  app2.use((req, res, next) => {
    const origins = /* @__PURE__ */ new Set();
    if (process.env.REPLIT_DEV_DOMAIN) {
      origins.add(`https://${process.env.REPLIT_DEV_DOMAIN}`);
    }
    if (process.env.REPLIT_DOMAINS) {
      process.env.REPLIT_DOMAINS.split(",").forEach((d) => {
        origins.add(`https://${d.trim()}`);
      });
    }
    const origin = req.header("origin");
    const isLocalhost = origin?.startsWith("http://localhost:") || origin?.startsWith("http://127.0.0.1:");
    if (origin && (origins.has(origin) || isLocalhost)) {
      res.header("Access-Control-Allow-Origin", origin);
      res.header(
        "Access-Control-Allow-Methods",
        "GET, POST, PUT, DELETE, OPTIONS"
      );
      res.header("Access-Control-Allow-Headers", "Content-Type");
      res.header("Access-Control-Allow-Credentials", "true");
    }
    if (req.method === "OPTIONS") {
      return res.sendStatus(200);
    }
    next();
  });
}
function setupBodyParsing(app2) {
  app2.use(
    express.json({
      limit: "15mb",
      verify: (req, _res, buf) => {
        req.rawBody = buf;
      }
    })
  );
  app2.use(express.urlencoded({ extended: false, limit: "15mb" }));
}
function setupRequestLogging(app2) {
  app2.use((req, res, next) => {
    const start = Date.now();
    const path3 = req.path;
    let capturedJsonResponse = void 0;
    const originalResJson = res.json;
    res.json = function(bodyJson, ...args) {
      capturedJsonResponse = bodyJson;
      return originalResJson.apply(res, [bodyJson, ...args]);
    };
    res.on("finish", () => {
      if (!path3.startsWith("/api")) return;
      const duration = Date.now() - start;
      let logLine = `${req.method} ${path3} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }
      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "\u2026";
      }
      log(logLine);
    });
    next();
  });
}
function getAppName() {
  try {
    const appJsonPath = path2.resolve(process.cwd(), "app.json");
    const appJsonContent = fs2.readFileSync(appJsonPath, "utf-8");
    const appJson = JSON.parse(appJsonContent);
    return appJson.expo?.name || "App Landing Page";
  } catch {
    return "App Landing Page";
  }
}
function serveExpoManifest(platform, res) {
  const manifestPath = path2.resolve(
    process.cwd(),
    "static-build",
    platform,
    "manifest.json"
  );
  if (!fs2.existsSync(manifestPath)) {
    return res.status(404).json({ error: `Manifest not found for platform: ${platform}` });
  }
  res.setHeader("expo-protocol-version", "1");
  res.setHeader("expo-sfv-version", "0");
  res.setHeader("content-type", "application/json");
  const manifest = fs2.readFileSync(manifestPath, "utf-8");
  res.send(manifest);
}
function serveLandingPage({
  req,
  res,
  landingPageTemplate,
  appName
}) {
  const forwardedProto = req.header("x-forwarded-proto");
  const protocol = forwardedProto || req.protocol || "https";
  const forwardedHost = req.header("x-forwarded-host");
  const host = forwardedHost || req.get("host");
  const baseUrl = `${protocol}://${host}`;
  const expsUrl = `${host}`;
  log(`baseUrl`, baseUrl);
  log(`expsUrl`, expsUrl);
  const html = landingPageTemplate.replace(/BASE_URL_PLACEHOLDER/g, baseUrl).replace(/EXPS_URL_PLACEHOLDER/g, expsUrl).replace(/APP_NAME_PLACEHOLDER/g, appName);
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.status(200).send(html);
}
function configureExpoAndLanding(app2) {
  const templatePath = path2.resolve(
    process.cwd(),
    "server",
    "templates",
    "landing-page.html"
  );
  const landingPageTemplate = fs2.readFileSync(templatePath, "utf-8");
  const appName = getAppName();
  log("Serving static Expo files with dynamic manifest routing");
  app2.use((req, res, next) => {
    if (req.path.startsWith("/api")) {
      return next();
    }
    if (req.path !== "/" && req.path !== "/manifest") {
      return next();
    }
    const platform = req.header("expo-platform");
    if (platform && (platform === "ios" || platform === "android")) {
      return serveExpoManifest(platform, res);
    }
    if (req.path === "/") {
      return serveLandingPage({
        req,
        res,
        landingPageTemplate,
        appName
      });
    }
    next();
  });
  app2.get("/privacy", (_req, res) => {
    const privacyPath = path2.resolve(process.cwd(), "server", "templates", "privacy.html");
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.status(200).send(fs2.readFileSync(privacyPath, "utf-8"));
  });
  app2.get("/terms", (_req, res) => {
    const termsPath = path2.resolve(process.cwd(), "server", "templates", "terms.html");
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.status(200).send(fs2.readFileSync(termsPath, "utf-8"));
  });
  app2.use("/assets", express.static(path2.resolve(process.cwd(), "assets")));
  app2.use(express.static(path2.resolve(process.cwd(), "static-build")));
  log("Expo routing: Checking expo-platform header on / and /manifest");
}
function setupErrorHandler(app2) {
  app2.use((err, _req, res, next) => {
    const error = err;
    const status = error.status || error.statusCode || 500;
    const message = error.message || "Internal Server Error";
    console.error("Internal Server Error:", err);
    if (res.headersSent) {
      return next(err);
    }
    return res.status(status).json({ message });
  });
}
(async () => {
  setupCors(app);
  setupBodyParsing(app);
  setupRequestLogging(app);
  configureExpoAndLanding(app);
  const server = await registerRoutes(app);
  setupErrorHandler(app);
  const port = parseInt(process.env.PORT || "5000", 10);
  server.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true
    },
    () => {
      log(`express server serving on port ${port}`);
    }
  );
})();
