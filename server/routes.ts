import type { Express, Request, Response } from "express";
import { createServer, type Server } from "node:http";
import { Pool } from "pg";
import * as fs from "fs";
import * as path from "path";
import { CA_COURTS } from "./ca-courts";

// ─── Database ─────────────────────────────────────────────────────────────────

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// ─── Profanity filter ─────────────────────────────────────────────────────────

const PROFANITY_LIST = [
  "fuck", "shit", "bitch", "ass", "asshole", "bastard", "damn", "crap",
  "dick", "cock", "pussy", "nigger", "nigga", "faggot", "fag", "slut",
  "whore", "cunt", "motherfucker", "motherfucking", "fucker", "fucking",
  "bullshit", "dumbass", "jackass", "dipshit", "shithead", "prick",
  "retard", "retarded", "nazi", "kike", "spic", "wetback", "chink",
  "cracker", "twat", "wanker", "bollocks", "arse", "shite", "feck",
];

function containsProfanity(text: string): boolean {
  const lower = text.toLowerCase().replace(/[^a-z\s]/g, "");
  const words = lower.split(/\s+/);
  return words.some((w) => PROFANITY_LIST.includes(w));
}

// ─── In-memory court messages ─────────────────────────────────────────────────

export interface CourtMessage {
  id: string;
  courtId: string;
  userId: string;
  username: string;
  skillLevel: string;
  text: string;
  timestamp: number;
}

const MAX_MESSAGES_PER_COURT = 100;
const courtMessages = new Map<string, CourtMessage[]>();

function getMessages(courtId: string): CourtMessage[] {
  return courtMessages.get(courtId) ?? [];
}

function addMessage(msg: CourtMessage): void {
  const existing = courtMessages.get(msg.courtId) ?? [];
  const updated = [...existing, msg];
  if (updated.length > MAX_MESSAGES_PER_COURT) {
    updated.splice(0, updated.length - MAX_MESSAGES_PER_COURT);
  }
  courtMessages.set(msg.courtId, updated);
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 8);
}

// ─── Push Notifications ───────────────────────────────────────────────────────

async function sendPushNotifications(
  tokens: string[],
  title: string,
  body: string,
  data: Record<string, string> = {}
): Promise<void> {
  const valid = tokens.filter((t) => t && t.startsWith("ExponentPushToken["));
  if (valid.length === 0) return;
  try {
    await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(
        valid.map((to) => ({ to, title, body, data, sound: "default" }))
      ),
    });
  } catch (err) {
    console.warn("Push notification send failed:", err);
  }
}

// ─── Routes ───────────────────────────────────────────────────────────────────

export async function registerRoutes(app: Express): Promise<Server> {

  // ── Auto-seed courts if table is empty ────────────────────────────────────
  await (async () => {
    try {
      // Ensure courts table exists with state_abbr column
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

      // Always ensure California courts are present (inserted separately in case the table
      // was seeded before CA courts were added to the codebase)
      const caCountResult = await pool.query("SELECT COUNT(*) AS n FROM courts WHERE state_abbr = 'CA'");
      if (parseInt(caCountResult.rows[0].n) === 0) {
        console.log("No California courts found — inserting CA courts...");
        const caChunkSize = 50;
        const caCourts = CA_COURTS.map(c => ({ ...c, type: c.type as string, surface: c.surface as string }));
        for (let i = 0; i < caCourts.length; i += caChunkSize) {
          const chunk = caCourts.slice(i, i + caChunkSize);
          const placeholders = chunk.map((_, j) => {
            const b = j * 16;
            return `($${b+1},$${b+2},$${b+3},$${b+4},$${b+5},$${b+6},$${b+7},$${b+8},$${b+9},$${b+10},$${b+11},$${b+12},$${b+13},$${b+14},$${b+15},$${b+16})`;
          }).join(",");
          const values = chunk.flatMap(c => [c.id,c.name,c.shortName,c.address,c.city,c.state,c.stateAbbr,"US",c.latitude,c.longitude,c.type,c.surface,c.hoops,c.description,c.basePlayersPlaying,c.maxPlayers]);
          await pool.query(
            `INSERT INTO courts (id,name,short_name,address,city,state,state_abbr,country,latitude,longitude,type,surface,hoops,description,base_players_playing,max_players)
             VALUES ${placeholders} ON CONFLICT (id) DO NOTHING`,
            values
          );
        }
        console.log(`✓ Inserted ${caCourts.length} California courts`);
      }

      const countResult = await pool.query("SELECT COUNT(*) AS n FROM courts");
      if (parseInt(countResult.rows[0].n) > 0) return;

      console.log("Courts table is empty — auto-seeding...");

      function offset(seed: number, range: number): number {
        const s = Math.sin(seed * 127.1 + 311.7) * 43758.5453123;
        return ((s - Math.floor(s)) - 0.5) * range * 2;
      }
      const PARK_NAMES = ["Riverside","Highland","Lakeside","Eastside","Westside","Northside","Southside","Central","Memorial","Veterans","Freedom","Liberty","Heritage","Sunset","Sunrise","Greenfield","Fairview","Oakdale","Maplewood","Elmwood","Cedar Ridge","Pinewood","Rolling Hills","Meadowbrook","Brookside","Springdale","Hillcrest","Clearview","Briarwood","Creekside","Timberline","Stonegate","Willowbrook","Foxwood","Valleyview"];
      const YMCA_AREAS = ["Downtown","Northside","Eastside","West Branch","South","Central","Metro","Midtown","Uptown","Lakeside","Community","Family","Athletic","Sports","Fitness"];
      const DIRECTIONS = ["North","South","East","West"];
      const STATE_DATA: [string, string, [string, number, number][]][] = [
        ["Alabama","AL",[["Birmingham",33.5186,-86.8104],["Montgomery",32.3668,-86.2999],["Huntsville",34.7304,-86.5861],["Mobile",30.6954,-88.0399],["Tuscaloosa",33.2098,-87.5692]]],
        ["Alaska","AK",[["Anchorage",61.2181,-149.9003],["Fairbanks",64.8378,-147.7164],["Juneau",58.3005,-134.4197],["Wasilla",61.5814,-149.4394],["Sitka",57.0531,-135.3300]]],
        ["Arizona","AZ",[["Phoenix",33.4484,-112.0740],["Tucson",32.2226,-110.9747],["Mesa",33.4152,-111.8315],["Chandler",33.3062,-111.8413],["Scottsdale",33.4942,-111.9261]]],
        ["Arkansas","AR",[["Little Rock",34.7465,-92.2896],["Fort Smith",35.3859,-94.3985],["Fayetteville",36.0822,-94.1719],["Springdale",36.1867,-94.1288],["Jonesboro",35.8423,-90.7043]]],
        // California handled separately via CA_COURTS (169 real courts)
        ["Colorado","CO",[["Denver",39.7392,-104.9903],["Colorado Springs",38.8339,-104.8214],["Aurora",39.7294,-104.8319],["Fort Collins",40.5853,-105.0844],["Boulder",40.0150,-105.2705]]],
        ["Connecticut","CT",[["Hartford",41.7637,-72.6851],["New Haven",41.3082,-72.9279],["Bridgeport",41.1865,-73.1952],["Stamford",41.0534,-73.5387],["Waterbury",41.5582,-73.0515]]],
        ["Delaware","DE",[["Wilmington",39.7447,-75.5484],["Dover",39.1582,-75.5244],["Newark",39.6837,-75.7497],["Middletown",39.4493,-75.7163],["Smyrna",39.2993,-75.6035]]],
        ["Florida","FL",[["Miami",25.7617,-80.1918],["Orlando",28.5383,-81.3792],["Tampa",27.9506,-82.4572],["Jacksonville",30.3322,-81.6557],["Fort Lauderdale",26.1224,-80.1373]]],
        ["Georgia","GA",[["Atlanta",33.7490,-84.3880],["Augusta",33.4735,-81.9748],["Columbus",32.4610,-84.9877],["Savannah",32.0809,-81.0912],["Athens",33.9519,-83.3576]]],
        ["Hawaii","HI",[["Honolulu",21.3069,-157.8583],["Hilo",19.7074,-155.0885],["Kailua",21.4022,-157.7394],["Pearl City",21.3972,-157.9751],["Waipahu",21.3866,-158.0097]]],
        ["Idaho","ID",[["Boise",43.6150,-116.2023],["Meridian",43.6121,-116.3915],["Nampa",43.5407,-116.5635],["Idaho Falls",43.4917,-112.0339],["Pocatello",42.8713,-112.4455]]],
        ["Illinois","IL",[["Chicago",41.8781,-87.6298],["Aurora",41.7606,-88.3201],["Rockford",42.2711,-89.0940],["Joliet",41.5250,-88.0817],["Naperville",41.7508,-88.1535]]],
        ["Indiana","IN",[["Indianapolis",39.7684,-86.1581],["Fort Wayne",41.0793,-85.1394],["Evansville",37.9716,-87.5711],["South Bend",41.6764,-86.2520],["Carmel",39.9784,-86.1180]]],
        ["Iowa","IA",[["Des Moines",41.5868,-93.6250],["Cedar Rapids",41.9779,-91.6656],["Davenport",41.5236,-90.5776],["Sioux City",42.4999,-96.4003],["Iowa City",41.6611,-91.5302]]],
        ["Kansas","KS",[["Wichita",37.6872,-97.3301],["Overland Park",38.9822,-94.6708],["Kansas City",39.1142,-94.6275],["Topeka",39.0473,-95.6890],["Olathe",38.8814,-94.8191]]],
        ["Kentucky","KY",[["Louisville",38.2527,-85.7585],["Lexington",38.0406,-84.5037],["Bowling Green",36.9903,-86.4436],["Owensboro",37.7719,-87.1111],["Covington",39.0837,-84.5085]]],
        ["Louisiana","LA",[["New Orleans",29.9511,-90.0715],["Baton Rouge",30.4515,-91.1871],["Shreveport",32.5252,-93.7502],["Lafayette",30.2241,-92.0198],["Lake Charles",30.2266,-93.2174]]],
        ["Maine","ME",[["Portland",43.6591,-70.2568],["Lewiston",44.1004,-70.2148],["Bangor",44.8012,-68.7778],["South Portland",43.6415,-70.3097],["Auburn",44.0979,-70.2312]]],
        ["Maryland","MD",[["Baltimore",39.2904,-76.6122],["Frederick",39.4143,-77.4105],["Rockville",39.0840,-77.1528],["Gaithersburg",39.1434,-77.2014],["Bowie",38.9420,-76.7791]]],
        ["Massachusetts","MA",[["Boston",42.3601,-71.0589],["Worcester",42.2626,-71.8023],["Springfield",42.1015,-72.5898],["Cambridge",42.3736,-71.1097],["Lowell",42.6334,-71.3162]]],
        ["Michigan","MI",[["Detroit",42.3314,-83.0458],["Grand Rapids",42.9634,-85.6681],["Warren",42.4775,-83.0277],["Sterling Heights",42.5803,-83.0302],["Lansing",42.7325,-84.5555]]],
        ["Minnesota","MN",[["Minneapolis",44.9778,-93.2650],["Saint Paul",44.9537,-93.0900],["Rochester",44.0121,-92.4802],["Duluth",46.7867,-92.1005],["Bloomington",44.8408,-93.3477]]],
        ["Mississippi","MS",[["Jackson",32.2988,-90.1848],["Gulfport",30.3674,-89.0928],["Southaven",34.9893,-89.9984],["Hattiesburg",31.3271,-89.2903],["Biloxi",30.3960,-88.8853]]],
        ["Missouri","MO",[["Kansas City",39.0997,-94.5786],["Saint Louis",38.6270,-90.1994],["Springfield",37.2153,-93.2982],["Columbia",38.9517,-92.3341],["Independence",39.0911,-94.4155]]],
        ["Montana","MT",[["Billings",45.7833,-108.5007],["Missoula",46.8721,-113.9940],["Great Falls",47.5002,-111.3008],["Bozeman",45.6770,-111.0429],["Helena",46.5958,-112.0270]]],
        ["Nebraska","NE",[["Omaha",41.2565,-95.9345],["Lincoln",40.8136,-96.7026],["Bellevue",41.1544,-95.9146],["Grand Island",40.9264,-98.3420],["Kearney",40.6993,-99.0817]]],
        ["Nevada","NV",[["Las Vegas",36.1699,-115.1398],["Henderson",36.0395,-114.9817],["Reno",39.5296,-119.8138],["North Las Vegas",36.1989,-115.1175],["Sparks",39.5349,-119.7527]]],
        ["New Hampshire","NH",[["Manchester",42.9956,-71.4548],["Nashua",42.7654,-71.4676],["Concord",43.2081,-71.5376],["Derry",42.8809,-71.3273],["Rochester",43.3042,-70.9748]]],
        ["New Jersey","NJ",[["Newark",40.7357,-74.1724],["Jersey City",40.7178,-74.0431],["Paterson",40.9168,-74.1718],["Elizabeth",40.6640,-74.2107],["Edison",40.5188,-74.4121]]],
        ["New Mexico","NM",[["Albuquerque",35.0844,-106.6504],["Las Cruces",32.3199,-106.7637],["Rio Rancho",35.2328,-106.6630],["Santa Fe",35.6870,-105.9378],["Roswell",33.3943,-104.5230]]],
        ["New York","NY",[["New York City",40.7128,-74.0060],["Buffalo",42.8864,-78.8784],["Rochester",43.1566,-77.6088],["Yonkers",40.9312,-73.8988],["Syracuse",43.0481,-76.1474]]],
        ["North Carolina","NC",[["Charlotte",35.2271,-80.8431],["Raleigh",35.7796,-78.6382],["Greensboro",36.0726,-79.7920],["Durham",35.9940,-78.8986],["Winston-Salem",36.0999,-80.2442]]],
        ["North Dakota","ND",[["Fargo",46.8772,-96.7898],["Bismarck",46.8083,-100.7837],["Grand Forks",47.9253,-97.0329],["Minot",48.2325,-101.2963],["West Fargo",46.8749,-96.9003]]],
        ["Ohio","OH",[["Columbus",39.9612,-82.9988],["Cleveland",41.4993,-81.6944],["Cincinnati",39.1031,-84.5120],["Toledo",41.6639,-83.5552],["Akron",41.0814,-81.5190]]],
        ["Oklahoma","OK",[["Oklahoma City",35.4676,-97.5164],["Tulsa",36.1540,-95.9928],["Norman",35.2226,-97.4395],["Broken Arrow",36.0609,-95.7975],["Edmond",35.6528,-97.4781]]],
        ["Oregon","OR",[["Portland",45.5051,-122.6750],["Salem",44.9429,-123.0351],["Eugene",44.0521,-123.0868],["Gresham",45.4984,-122.4280],["Hillsboro",45.5229,-122.9898]]],
        ["Pennsylvania","PA",[["Philadelphia",39.9526,-75.1652],["Pittsburgh",40.4406,-79.9959],["Allentown",40.6023,-75.4714],["Erie",42.1292,-80.0851],["Reading",40.3356,-75.9269]]],
        ["Rhode Island","RI",[["Providence",41.8240,-71.4128],["Warwick",41.7001,-71.4162],["Cranston",41.7798,-71.4373],["Pawtucket",41.8787,-71.3826],["East Providence",41.8137,-71.3700]]],
        ["South Carolina","SC",[["Columbia",34.0007,-81.0348],["Charleston",32.7765,-79.9311],["North Charleston",32.8546,-79.9748],["Mount Pleasant",32.8323,-79.8284],["Rock Hill",34.9249,-81.0251]]],
        ["South Dakota","SD",[["Sioux Falls",43.5473,-96.7283],["Rapid City",44.0805,-103.2310],["Aberdeen",45.4647,-98.4865],["Brookings",44.3114,-96.7984],["Watertown",44.8994,-97.1150]]],
        ["Tennessee","TN",[["Nashville",36.1627,-86.7816],["Memphis",35.1495,-90.0490],["Knoxville",35.9606,-83.9207],["Chattanooga",35.0456,-85.3097],["Clarksville",36.5298,-87.3595]]],
        ["Texas","TX",[["Houston",29.7604,-95.3698],["San Antonio",29.4241,-98.4936],["Dallas",32.7767,-96.7970],["Austin",30.2672,-97.7431],["Fort Worth",32.7555,-97.3308]]],
        ["Utah","UT",[["Salt Lake City",40.7608,-111.8910],["West Valley City",40.6916,-112.0010],["Provo",40.2338,-111.6585],["West Jordan",40.6097,-111.9391],["Orem",40.2969,-111.6946]]],
        ["Vermont","VT",[["Burlington",44.4759,-73.2121],["South Burlington",44.4669,-73.1710],["Rutland",43.6106,-72.9726],["Barre",44.1973,-72.5023],["Montpelier",44.2601,-72.5754]]],
        ["Virginia","VA",[["Virginia Beach",36.8529,-75.9780],["Norfolk",36.8968,-76.2591],["Chesapeake",36.7682,-76.2875],["Richmond",37.5407,-77.4360],["Newport News",37.0871,-76.4730]]],
        ["Washington","WA",[["Seattle",47.6062,-122.3321],["Spokane",47.6588,-117.4260],["Tacoma",47.2529,-122.4443],["Vancouver",45.6387,-122.6615],["Bellevue",47.6101,-122.2015]]],
        ["West Virginia","WV",[["Charleston",38.3498,-81.6326],["Huntington",38.4193,-82.4452],["Morgantown",39.6295,-79.9559],["Parkersburg",39.2667,-81.5615],["Wheeling",40.0640,-80.7209]]],
        ["Wisconsin","WI",[["Milwaukee",43.0389,-87.9065],["Madison",43.0731,-89.4012],["Green Bay",44.5133,-88.0133],["Kenosha",42.5847,-87.8212],["Racine",42.7261,-87.7829]]],
        ["Wyoming","WY",[["Cheyenne",41.1400,-104.8202],["Casper",42.8666,-106.3131],["Laramie",41.3114,-105.5911],["Gillette",44.2911,-105.5022],["Rock Springs",41.5875,-109.2029]]],
      ];

      function makeCourts(stateName: string, stateAbbr: string, cityName: string, lat: number, lon: number, si: number, ci: number) {
        const slug = cityName.toLowerCase().replace(/[^a-z0-9]+/g, "-");
        const saSlug = stateAbbr.toLowerCase();
        const seed = si * 1000 + ci * 100;
        const jlat = (i: number) => parseFloat((lat + offset(seed + i * 3.7, 0.025)).toFixed(4));
        const jlon = (i: number) => parseFloat((lon + offset(seed + i * 7.3, 0.025)).toFixed(4));
        const pick = (arr: string[], i: number) => arr[Math.abs(Math.floor(offset(seed + i * 5.1, arr.length / 2) + arr.length / 2)) % arr.length];
        const pname = pick(PARK_NAMES, 0), pname2 = pick(PARK_NAMES, 1), pname3 = pick(PARK_NAMES, 2);
        const dir = pick(DIRECTIONS, 3), ymcaArea = pick(YMCA_AREAS, 4);
        const bp1 = Math.abs(Math.floor(offset(seed + 50, 4))) % 9;
        const bp2 = Math.abs(Math.floor(offset(seed + 51, 4))) % 7;
        const bp3 = Math.abs(Math.floor(offset(seed + 52, 3))) % 5;
        const hoops1 = 4 + (Math.abs(Math.floor(offset(seed + 60, 2))) % 3) * 2;
        const hoops2 = 2 + (Math.abs(Math.floor(offset(seed + 61, 1.5))) % 3) * 2;
        return [
          { id:`${saSlug}-${slug}-1`, name:`${cityName} ${pname} Park Courts`, shortName:`${pname} Park`, address:`${Math.floor(100+Math.abs(offset(seed+1,400)))} ${pname} Dr, ${cityName}, ${stateAbbr}`, city:cityName, state:stateName, stateAbbr, latitude:jlat(1), longitude:jlon(1), type:"outdoor", surface:"asphalt", hoops:hoops1, description:`Popular outdoor courts at ${pname} Park in ${cityName}.`, basePlayersPlaying:bp1, maxPlayers:10 },
          { id:`${saSlug}-${slug}-2`, name:`${dir} ${cityName} Recreation Center`, shortName:`${dir} Rec Center`, address:`${Math.floor(200+Math.abs(offset(seed+2,600)))} ${dir} Blvd, ${cityName}, ${stateAbbr}`, city:cityName, state:stateName, stateAbbr, latitude:jlat(2), longitude:jlon(2), type:"indoor", surface:"hardwood", hoops:hoops2, description:`Indoor hardwood courts at the ${dir} ${cityName} Recreation Center.`, basePlayersPlaying:bp2, maxPlayers:10 },
          { id:`${saSlug}-${slug}-3`, name:`YMCA ${ymcaArea} ${cityName}`, shortName:`YMCA ${ymcaArea}`, address:`${Math.floor(300+Math.abs(offset(seed+3,500)))} Main St, ${cityName}, ${stateAbbr}`, city:cityName, state:stateName, stateAbbr, latitude:jlat(3), longitude:jlon(3), type:"indoor", surface:"hardwood", hoops:2+(Math.abs(Math.floor(offset(seed+63,1)))%2)*2, description:`Premium YMCA facility in ${cityName}.`, basePlayersPlaying:bp3, maxPlayers:10 },
          { id:`${saSlug}-${slug}-4`, name:`${pname2} Community Park`, shortName:`${pname2} Community`, address:`${Math.floor(100+Math.abs(offset(seed+4,700)))} ${pname2} Rd, ${cityName}, ${stateAbbr}`, city:cityName, state:stateName, stateAbbr, latitude:jlat(4), longitude:jlon(4), type:"outdoor", surface:"concrete", hoops:2+(Math.abs(Math.floor(offset(seed+64,2)))%3)*2, description:`Neighborhood outdoor courts at ${pname2} Community Park in ${cityName}.`, basePlayersPlaying:Math.abs(Math.floor(offset(seed+53,4)))%8, maxPlayers:10 },
          { id:`${saSlug}-${slug}-5`, name:`${cityName} Athletic Complex`, shortName:`${cityName} Athletic`, address:`${Math.floor(500+Math.abs(offset(seed+5,800)))} Sports Way, ${cityName}, ${stateAbbr}`, city:cityName, state:stateName, stateAbbr, latitude:jlat(5), longitude:jlon(5), type:"indoor", surface:"hardwood", hoops:hoops2, description:`Modern athletic complex in ${cityName} with professional-grade hardwood courts.`, basePlayersPlaying:Math.abs(Math.floor(offset(seed+54,3)))%6, maxPlayers:10 },
          { id:`${saSlug}-${slug}-6`, name:`${pname3} Neighborhood Courts`, shortName:`${pname3} Courts`, address:`${Math.floor(400+Math.abs(offset(seed+6,600)))} ${pname3} Ave, ${cityName}, ${stateAbbr}`, city:cityName, state:stateName, stateAbbr, latitude:jlat(6), longitude:jlon(6), type:"outdoor", surface:"asphalt", hoops:2+(Math.abs(Math.floor(offset(seed+65,1.5)))%2)*2, description:`Street-level outdoor courts in ${cityName}.`, basePlayersPlaying:Math.abs(Math.floor(offset(seed+55,4)))%7, maxPlayers:10 },
        ];
      }

      let courts: ReturnType<typeof makeCourts> = [];
      for (let si = 0; si < STATE_DATA.length; si++) {
        const [stateName, stateAbbr, cities] = STATE_DATA[si];
        for (let ci = 0; ci < cities.length; ci++) {
          const [cityName, lat, lon] = cities[ci];
          courts = courts.concat(makeCourts(stateName, stateAbbr, cityName, lat, lon, si, ci));
        }
      }

      // Append the 169 original California courts
      courts = courts.concat(CA_COURTS.map(c => ({ ...c, type: c.type as string, surface: c.surface as string })));

      const chunkSize = 50;
      for (let i = 0; i < courts.length; i += chunkSize) {
        const chunk = courts.slice(i, i + chunkSize);
        const placeholders = chunk.map((_, j) => {
          const b = j * 16;
          return `($${b+1},$${b+2},$${b+3},$${b+4},$${b+5},$${b+6},$${b+7},$${b+8},$${b+9},$${b+10},$${b+11},$${b+12},$${b+13},$${b+14},$${b+15},$${b+16})`;
        }).join(",");
        const values = chunk.flatMap(c => [c.id,c.name,c.shortName,c.address,c.city,c.state,c.stateAbbr,"US",c.latitude,c.longitude,c.type,c.surface,c.hoops,c.description,c.basePlayersPlaying,c.maxPlayers]);
        await pool.query(
          `INSERT INTO courts (id,name,short_name,address,city,state,state_abbr,country,latitude,longitude,type,surface,hoops,description,base_players_playing,max_players)
           VALUES ${placeholders} ON CONFLICT (id) DO NOTHING`,
          values
        );
      }
      console.log(`✓ Auto-seeded ${courts.length} courts into production database`);
    } catch (err) {
      console.error("Auto-seed error:", err);
    }
  })();

  // ── Social feed tables ─────────────────────────────────────────────────────
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

  // ── Admin ─────────────────────────────────────────────────────────────────

  const ADMIN_USER_ID = "17731833451956z1lxkg";

  app.get("/api/admin/stats", async (req: Request, res: Response) => {
    const { userId } = req.query as { userId: string };
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
        recentUsers,
      ] = await Promise.all([
        pool.query("SELECT COUNT(*) AS count FROM users"),
        pool.query("SELECT skill_level, COUNT(*) AS count FROM users GROUP BY skill_level ORDER BY count DESC"),
        pool.query("SELECT COUNT(*) AS count FROM users WHERE created_at >= NOW() - INTERVAL '1 day'"),
        pool.query("SELECT COUNT(*) AS count FROM users WHERE created_at >= NOW() - INTERVAL '7 days'"),
        pool.query("SELECT COUNT(*) AS count FROM friendships WHERE status = 'accepted'"),
        pool.query("SELECT COUNT(*) AS count FROM friendships WHERE status = 'pending'"),
        pool.query("SELECT COUNT(*) AS count FROM direct_messages"),
        pool.query("SELECT username, skill_level, email, created_at FROM users ORDER BY created_at DESC LIMIT 10"),
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
        recentUsers: recentUsers.rows,
      });
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch stats" });
    }
  });

  // ── Users ──────────────────────────────────────────────────────────────────

  app.post("/api/users", async (req: Request, res: Response) => {
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
        return res.status(400).json({ message: "Username can only contain letters, numbers, and underscores (3–30 chars)." });
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
    } catch (err: any) {
      if (err.code === "23505" && err.constraint === "users_email_key") {
        return res.status(409).json({ message: "That email is already registered to another account." });
      }
      console.error("User upsert error:", err);
      res.status(500).json({ message: "Server error" });
    }
  });

  // IMPORTANT: /api/users/search must be defined BEFORE /api/users/:userId
  app.get("/api/users/search", async (req: Request, res: Response) => {
    const q = (req.query.q as string ?? "").trim();
    const myId = (req.query.myId as string ?? "").trim();
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

  app.get("/api/users/:userId", async (req: Request, res: Response) => {
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

  app.get("/api/users/:userId/private", async (req: Request, res: Response) => {
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

  // ── Avatar ─────────────────────────────────────────────────────────────────

  app.post("/api/users/:userId/avatar", async (req: Request, res: Response) => {
    const { userId } = req.params;
    const { base64, requesterId } = req.body;
    if (!requesterId || requesterId !== userId) {
      return res.status(403).json({ message: "Forbidden" });
    }
    if (!base64 || typeof base64 !== "string") {
      return res.status(400).json({ message: "base64 image required" });
    }
    if (base64.length > 500000) {
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

  app.get("/api/users/:userId/avatar", async (req: Request, res: Response) => {
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

  // ── Friendships ────────────────────────────────────────────────────────────

  // IMPORTANT: specific routes before wildcard ─ /api/friends/requests/:id before /api/friends/:id

  // Send a friend request
  app.post("/api/friends/request", async (req: Request, res: Response) => {
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
        pool.query(`SELECT push_token FROM users WHERE user_id = $1`, [addresseeId]),
      ]);
      const requesterName = requesterRes.rows[0]?.username ?? "Someone";
      const addresseeToken = addresseeRes.rows[0]?.push_token;
      if (addresseeToken) {
        sendPushNotifications([addresseeToken], "New friend request 🏀", `${requesterName} wants to hoop with you!`, { screen: "messages" });
      }
      res.status(201).json({ message: "Friend request sent" });
    } catch (err: any) {
      if (err.code === "23505") return res.status(409).json({ message: "Friend request already sent" });
      console.error("Friend request error:", err);
      res.status(500).json({ message: "Server error" });
    }
  });

  // Accept or decline
  app.post("/api/friends/respond", async (req: Request, res: Response) => {
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

  // Get pending incoming requests — BEFORE /api/friends/:userId
  app.get("/api/friends/requests/:userId", async (req: Request, res: Response) => {
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

  // Get accepted friends list
  app.get("/api/friends/:userId", async (req: Request, res: Response) => {
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

  // Remove a friend
  app.delete("/api/friends/:userId/:friendId", async (req: Request, res: Response) => {
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

  // ── Direct Messages (friends only) ─────────────────────────────────────────

  async function areFriends(userA: string, userB: string): Promise<boolean> {
    const result = await pool.query(
      `SELECT 1 FROM friendships
       WHERE ((requester_id = $1 AND addressee_id = $2) OR (requester_id = $2 AND addressee_id = $1))
         AND status = 'accepted' LIMIT 1`,
      [userA, userB]
    );
    return result.rows.length > 0;
  }

  // IMPORTANT: /api/dms/conversations/:userId must come BEFORE /api/dms/:userA/:userB
  app.get("/api/dms/conversations/:userId", async (req: Request, res: Response) => {
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

  // Get messages between two friends
  app.get("/api/dms/:userA/:userB", async (req: Request, res: Response) => {
    const { userA, userB } = req.params;
    try {
      if (!(await areFriends(userA, userB))) {
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

  // Send a DM (friends only)
  app.post("/api/dms", async (req: Request, res: Response) => {
    const { senderId, receiverId, text } = req.body;
    if (!senderId || !receiverId || !text) {
      return res.status(400).json({ message: "senderId, receiverId, and text are required" });
    }
    const trimmed = text.trim();
    if (!trimmed || trimmed.length > 500) {
      return res.status(400).json({ message: "Message must be 1–500 characters" });
    }
    if (containsProfanity(trimmed)) {
      return res.status(422).json({ message: "Your message contains language that isn't allowed." });
    }
    try {
      if (!(await areFriends(senderId, receiverId))) {
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
        sendPushNotifications([receiverToken], `${senderName} 💬`, trimmed.length > 60 ? trimmed.slice(0, 60) + "…" : trimmed, { screen: "messages" });
      }
      res.status(201).json(result.rows[0]);
    } catch (err) {
      console.error("DM send error:", err);
      res.status(500).json({ message: "Server error" });
    }
  });

  // ── Push token registration ────────────────────────────────────────────────

  app.post("/api/users/:userId/push-token", async (req: Request, res: Response) => {
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

  // ── Server-side Waitlists ──────────────────────────────────────────────────

  app.get("/api/waitlists/:courtId", async (req: Request, res: Response) => {
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

  app.post("/api/waitlists/:courtId/join", async (req: Request, res: Response) => {
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

  app.delete("/api/waitlists/:courtId/leave", async (req: Request, res: Response) => {
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
        const title = pos === 1 ? "You're next! 🏀" : `Waitlist update`;
        const body = pos === 1
          ? `You're first in line at ${courtName}!`
          : `You moved up to #${pos} at ${courtName}`;
        sendPushNotifications([row.push_token], title, body, { courtId });
      }

      res.json({ ok: true });
    } catch (err) {
      console.error("Waitlist leave error:", err);
      res.status(500).json({ message: "Server error" });
    }
  });

  // ── Admin page & auth ──────────────────────────────────────────────────────

  const failedAttempts = new Map<string, { count: number; lockedUntil: number }>();

  app.get("/admin", (_req: Request, res: Response) => {
    const adminPath = path.resolve(process.cwd(), "server", "templates", "admin.html");
    res.status(200).send(fs.readFileSync(adminPath, "utf-8"));
  });

  app.post("/api/admin/verify", (req: Request, res: Response) => {
    const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.socket.remoteAddress || "unknown";
    const now = Date.now();
    const record = failedAttempts.get(ip);

    if (record && record.lockedUntil > now) {
      const secs = Math.ceil((record.lockedUntil - now) / 1000);
      return res.status(429).json({ message: `Too many failed attempts. Try again in ${secs}s.` });
    }

    const adminPassword = process.env.ADMIN_PASSWORD;
    const provided = req.body?.adminPassword;

    if (!adminPassword || provided !== adminPassword) {
      const prev = failedAttempts.get(ip) ?? { count: 0, lockedUntil: 0 };
      const count = prev.count + 1;
      const lockedUntil = count >= 5 ? now + 15 * 60 * 1000 : 0;
      failedAttempts.set(ip, { count, lockedUntil });
      return res.status(403).json({ message: "Incorrect password." });
    }

    failedAttempts.delete(ip);
    res.json({ ok: true });
  });

  // ── Courts (public) ────────────────────────────────────────────────────────

  app.get("/api/courts", async (_req: Request, res: Response) => {
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

  // ── Courts admin (password protected) ──────────────────────────────────────

  function checkAdminPassword(req: Request, res: Response): boolean {
    const adminPassword = process.env.ADMIN_PASSWORD;
    const provided = req.headers["x-admin-password"] || req.body?.adminPassword;
    if (!adminPassword || provided !== adminPassword) {
      res.status(403).json({ message: "Forbidden" });
      return false;
    }
    return true;
  }

  function slugify(name: string): string {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  }

  app.post("/api/admin/courts", async (req: Request, res: Response) => {
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

  app.put("/api/admin/courts/:id", async (req: Request, res: Response) => {
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

  app.delete("/api/admin/courts/:id", async (req: Request, res: Response) => {
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

  // ── Court messages ─────────────────────────────────────────────────────────

  app.get("/api/courts/:id/messages", (req: Request, res: Response) => {
    res.json(getMessages(req.params.id));
  });

  app.post("/api/courts/:id/messages", (req: Request, res: Response) => {
    const { id } = req.params;
    const { userId, username, skillLevel, text } = req.body;
    if (!userId || !username || !text || typeof text !== "string") {
      return res.status(400).json({ message: "userId, username, and text are required" });
    }
    const trimmed = text.trim();
    if (!trimmed || trimmed.length > 200) {
      return res.status(400).json({ message: "Message must be 1–200 characters" });
    }
    if (containsProfanity(trimmed)) {
      return res.status(422).json({ message: "Your message contains language that isn't allowed. Keep it clean." });
    }
    const msg: CourtMessage = {
      id: generateId(),
      courtId: id,
      userId,
      username,
      skillLevel: skillLevel ?? "Intermediate",
      text: trimmed,
      timestamp: Date.now(),
    };
    addMessage(msg);
    res.status(201).json(msg);
  });

  app.delete("/api/courts/:courtId/messages/:msgId", (req: Request, res: Response) => {
    const { courtId, msgId } = req.params;
    const { userId } = req.body;
    const messages = getMessages(courtId);
    const msg = messages.find((m) => m.id === msgId);
    if (!msg) return res.status(404).json({ message: "Message not found" });
    if (msg.userId !== userId) return res.status(403).json({ message: "Not your message" });
    courtMessages.set(courtId, messages.filter((m) => m.id !== msgId));
    res.json({ success: true });
  });

  // ── Social Feed ──────────────────────────────────────────────────────────────

  app.get("/api/feed/:userId", async (req: Request, res: Response) => {
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
          userLiked: r.user_liked ?? false,
        }))
      );
    } catch (err) {
      console.error("Feed fetch error:", err);
      res.status(500).json({ message: "Failed to fetch feed" });
    }
  });

  app.post("/api/posts", async (req: Request, res: Response) => {
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
      res.status(201).json({ id, userId, username, avatarBase64, imageBase64, caption, courtId, courtName, likeCount: 0, commentCount: 0, userLiked: false, createdAt: new Date() });
    } catch (err) {
      console.error("Create post error:", err);
      res.status(500).json({ message: "Failed to create post" });
    }
  });

  app.delete("/api/posts/:postId", async (req: Request, res: Response) => {
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

  app.post("/api/posts/:postId/like", async (req: Request, res: Response) => {
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

  app.get("/api/posts/:postId/comments", async (req: Request, res: Response) => {
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
          createdAt: r.created_at,
        }))
      );
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch comments" });
    }
  });

  app.post("/api/posts/:postId/comments", async (req: Request, res: Response) => {
    const { postId } = req.params;
    const { userId, username, avatarBase64, text } = req.body;
    if (!userId || !username || !text) {
      return res.status(400).json({ message: "userId, username, and text are required" });
    }
    const trimmed = text.trim();
    if (!trimmed || trimmed.length > 300) return res.status(400).json({ message: "Comment must be 1–300 characters" });
    if (containsProfanity(trimmed)) {
      return res.status(422).json({ message: "Your comment contains language that isn't allowed. Keep it clean." });
    }
    const id = generateId();
    try {
      await pool.query(
        "INSERT INTO post_comments (id, post_id, user_id, username, avatar_base64, text) VALUES ($1, $2, $3, $4, $5, $6)",
        [id, postId, userId, username, avatarBase64 ?? null, trimmed]
      );
      res.status(201).json({ id, postId, userId, username, avatarBase64, text: trimmed, createdAt: new Date() });
    } catch (err) {
      res.status(500).json({ message: "Failed to add comment" });
    }
  });

  app.delete("/api/posts/:postId/comments/:commentId", async (req: Request, res: Response) => {
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

  const httpServer = createServer(app);
  return httpServer;
}
