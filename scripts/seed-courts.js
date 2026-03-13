
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// ── Same data as generate-courts.js ───────────────────────────────────────────
function offset(seed, range) {
  const s = Math.sin(seed * 127.1 + 311.7) * 43758.5453123;
  return ((s - Math.floor(s)) - 0.5) * range * 2;
}
const PARK_NAMES = [
  'Riverside','Highland','Lakeside','Eastside','Westside','Northside','Southside',
  'Central','Memorial','Veterans','Freedom','Liberty','Heritage','Sunset','Sunrise',
  'Greenfield','Fairview','Oakdale','Maplewood','Elmwood','Cedar Ridge','Pinewood',
  'Rolling Hills','Meadowbrook','Brookside','Springdale','Hillcrest','Clearview',
  'Briarwood','Creekside','Timberline','Stonegate','Willowbrook','Foxwood','Valleyview',
];
const YMCA_AREAS = [
  'Downtown','Northside','Eastside','West Branch','South','Central','Metro','Midtown',
  'Uptown','Lakeside','Community','Family','Athletic','Sports','Fitness',
];
const DIRECTIONS = ['North','South','East','West'];

const STATE_DATA = [
  ['Alabama','AL',[['Birmingham',33.5186,-86.8104],['Montgomery',32.3668,-86.2999],['Huntsville',34.7304,-86.5861],['Mobile',30.6954,-88.0399],['Tuscaloosa',33.2098,-87.5692]]],
  ['Alaska','AK',[['Anchorage',61.2181,-149.9003],['Fairbanks',64.8378,-147.7164],['Juneau',58.3005,-134.4197],['Wasilla',61.5814,-149.4394],['Sitka',57.0531,-135.3300]]],
  ['Arizona','AZ',[['Phoenix',33.4484,-112.0740],['Tucson',32.2226,-110.9747],['Mesa',33.4152,-111.8315],['Chandler',33.3062,-111.8413],['Scottsdale',33.4942,-111.9261]]],
  ['Arkansas','AR',[['Little Rock',34.7465,-92.2896],['Fort Smith',35.3859,-94.3985],['Fayetteville',36.0822,-94.1719],['Springdale',36.1867,-94.1288],['Jonesboro',35.8423,-90.7043]]],
  ['California','CA',[['Los Angeles',34.0522,-118.2437],['San Francisco',37.7749,-122.4194],['San Diego',32.7157,-117.1611],['Sacramento',38.5816,-121.4944],['Fresno',36.7378,-119.7871]]],
  ['Colorado','CO',[['Denver',39.7392,-104.9903],['Colorado Springs',38.8339,-104.8214],['Aurora',39.7294,-104.8319],['Fort Collins',40.5853,-105.0844],['Boulder',40.0150,-105.2705]]],
  ['Connecticut','CT',[['Hartford',41.7637,-72.6851],['New Haven',41.3082,-72.9279],['Bridgeport',41.1865,-73.1952],['Stamford',41.0534,-73.5387],['Waterbury',41.5582,-73.0515]]],
  ['Delaware','DE',[['Wilmington',39.7447,-75.5484],['Dover',39.1582,-75.5244],['Newark',39.6837,-75.7497],['Middletown',39.4493,-75.7163],['Smyrna',39.2993,-75.6035]]],
  ['Florida','FL',[['Miami',25.7617,-80.1918],['Orlando',28.5383,-81.3792],['Tampa',27.9506,-82.4572],['Jacksonville',30.3322,-81.6557],['Fort Lauderdale',26.1224,-80.1373]]],
  ['Georgia','GA',[['Atlanta',33.7490,-84.3880],['Augusta',33.4735,-81.9748],['Columbus',32.4610,-84.9877],['Savannah',32.0809,-81.0912],['Athens',33.9519,-83.3576]]],
  ['Hawaii','HI',[['Honolulu',21.3069,-157.8583],['Hilo',19.7074,-155.0885],['Kailua',21.4022,-157.7394],['Pearl City',21.3972,-157.9751],['Waipahu',21.3866,-158.0097]]],
  ['Idaho','ID',[['Boise',43.6150,-116.2023],['Meridian',43.6121,-116.3915],['Nampa',43.5407,-116.5635],['Idaho Falls',43.4917,-112.0339],['Pocatello',42.8713,-112.4455]]],
  ['Illinois','IL',[['Chicago',41.8781,-87.6298],['Aurora',41.7606,-88.3201],['Rockford',42.2711,-89.0940],['Joliet',41.5250,-88.0817],['Naperville',41.7508,-88.1535]]],
  ['Indiana','IN',[['Indianapolis',39.7684,-86.1581],['Fort Wayne',41.0793,-85.1394],['Evansville',37.9716,-87.5711],['South Bend',41.6764,-86.2520],['Carmel',39.9784,-86.1180]]],
  ['Iowa','IA',[['Des Moines',41.5868,-93.6250],['Cedar Rapids',41.9779,-91.6656],['Davenport',41.5236,-90.5776],['Sioux City',42.4999,-96.4003],['Iowa City',41.6611,-91.5302]]],
  ['Kansas','KS',[['Wichita',37.6872,-97.3301],['Overland Park',38.9822,-94.6708],['Kansas City',39.1142,-94.6275],['Topeka',39.0473,-95.6890],['Olathe',38.8814,-94.8191]]],
  ['Kentucky','KY',[['Louisville',38.2527,-85.7585],['Lexington',38.0406,-84.5037],['Bowling Green',36.9903,-86.4436],['Owensboro',37.7719,-87.1111],['Covington',39.0837,-84.5085]]],
  ['Louisiana','LA',[['New Orleans',29.9511,-90.0715],['Baton Rouge',30.4515,-91.1871],['Shreveport',32.5252,-93.7502],['Lafayette',30.2241,-92.0198],['Lake Charles',30.2266,-93.2174]]],
  ['Maine','ME',[['Portland',43.6591,-70.2568],['Lewiston',44.1004,-70.2148],['Bangor',44.8012,-68.7778],['South Portland',43.6415,-70.3097],['Auburn',44.0979,-70.2312]]],
  ['Maryland','MD',[['Baltimore',39.2904,-76.6122],['Frederick',39.4143,-77.4105],['Rockville',39.0840,-77.1528],['Gaithersburg',39.1434,-77.2014],['Bowie',38.9420,-76.7791]]],
  ['Massachusetts','MA',[['Boston',42.3601,-71.0589],['Worcester',42.2626,-71.8023],['Springfield',42.1015,-72.5898],['Cambridge',42.3736,-71.1097],['Lowell',42.6334,-71.3162]]],
  ['Michigan','MI',[['Detroit',42.3314,-83.0458],['Grand Rapids',42.9634,-85.6681],['Warren',42.4775,-83.0277],['Sterling Heights',42.5803,-83.0302],['Lansing',42.7325,-84.5555]]],
  ['Minnesota','MN',[['Minneapolis',44.9778,-93.2650],['Saint Paul',44.9537,-93.0900],['Rochester',44.0121,-92.4802],['Duluth',46.7867,-92.1005],['Bloomington',44.8408,-93.3477]]],
  ['Mississippi','MS',[['Jackson',32.2988,-90.1848],['Gulfport',30.3674,-89.0928],['Southaven',34.9893,-89.9984],['Hattiesburg',31.3271,-89.2903],['Biloxi',30.3960,-88.8853]]],
  ['Missouri','MO',[['Kansas City',39.0997,-94.5786],['Saint Louis',38.6270,-90.1994],['Springfield',37.2153,-93.2982],['Columbia',38.9517,-92.3341],['Independence',39.0911,-94.4155]]],
  ['Montana','MT',[['Billings',45.7833,-108.5007],['Missoula',46.8721,-113.9940],['Great Falls',47.5002,-111.3008],['Bozeman',45.6770,-111.0429],['Helena',46.5958,-112.0270]]],
  ['Nebraska','NE',[['Omaha',41.2565,-95.9345],['Lincoln',40.8136,-96.7026],['Bellevue',41.1544,-95.9146],['Grand Island',40.9264,-98.3420],['Kearney',40.6993,-99.0817]]],
  ['Nevada','NV',[['Las Vegas',36.1699,-115.1398],['Henderson',36.0395,-114.9817],['Reno',39.5296,-119.8138],['North Las Vegas',36.1989,-115.1175],['Sparks',39.5349,-119.7527]]],
  ['New Hampshire','NH',[['Manchester',42.9956,-71.4548],['Nashua',42.7654,-71.4676],['Concord',43.2081,-71.5376],['Derry',42.8809,-71.3273],['Rochester',43.3042,-70.9748]]],
  ['New Jersey','NJ',[['Newark',40.7357,-74.1724],['Jersey City',40.7178,-74.0431],['Paterson',40.9168,-74.1718],['Elizabeth',40.6640,-74.2107],['Edison',40.5188,-74.4121]]],
  ['New Mexico','NM',[['Albuquerque',35.0844,-106.6504],['Las Cruces',32.3199,-106.7637],['Rio Rancho',35.2328,-106.6630],['Santa Fe',35.6870,-105.9378],['Roswell',33.3943,-104.5230]]],
  ['New York','NY',[['New York City',40.7128,-74.0060],['Buffalo',42.8864,-78.8784],['Rochester',43.1566,-77.6088],['Yonkers',40.9312,-73.8988],['Syracuse',43.0481,-76.1474]]],
  ['North Carolina','NC',[['Charlotte',35.2271,-80.8431],['Raleigh',35.7796,-78.6382],['Greensboro',36.0726,-79.7920],['Durham',35.9940,-78.8986],['Winston-Salem',36.0999,-80.2442]]],
  ['North Dakota','ND',[['Fargo',46.8772,-96.7898],['Bismarck',46.8083,-100.7837],['Grand Forks',47.9253,-97.0329],['Minot',48.2325,-101.2963],['West Fargo',46.8749,-96.9003]]],
  ['Ohio','OH',[['Columbus',39.9612,-82.9988],['Cleveland',41.4993,-81.6944],['Cincinnati',39.1031,-84.5120],['Toledo',41.6639,-83.5552],['Akron',41.0814,-81.5190]]],
  ['Oklahoma','OK',[['Oklahoma City',35.4676,-97.5164],['Tulsa',36.1540,-95.9928],['Norman',35.2226,-97.4395],['Broken Arrow',36.0609,-95.7975],['Edmond',35.6528,-97.4781]]],
  ['Oregon','OR',[['Portland',45.5051,-122.6750],['Salem',44.9429,-123.0351],['Eugene',44.0521,-123.0868],['Gresham',45.4984,-122.4280],['Hillsboro',45.5229,-122.9898]]],
  ['Pennsylvania','PA',[['Philadelphia',39.9526,-75.1652],['Pittsburgh',40.4406,-79.9959],['Allentown',40.6023,-75.4714],['Erie',42.1292,-80.0851],['Reading',40.3356,-75.9269]]],
  ['Rhode Island','RI',[['Providence',41.8240,-71.4128],['Warwick',41.7001,-71.4162],['Cranston',41.7798,-71.4373],['Pawtucket',41.8787,-71.3826],['East Providence',41.8137,-71.3700]]],
  ['South Carolina','SC',[['Columbia',34.0007,-81.0348],['Charleston',32.7765,-79.9311],['North Charleston',32.8546,-79.9748],['Mount Pleasant',32.8323,-79.8284],['Rock Hill',34.9249,-81.0251]]],
  ['South Dakota','SD',[['Sioux Falls',43.5473,-96.7283],['Rapid City',44.0805,-103.2310],['Aberdeen',45.4647,-98.4865],['Brookings',44.3114,-96.7984],['Watertown',44.8994,-97.1150]]],
  ['Tennessee','TN',[['Nashville',36.1627,-86.7816],['Memphis',35.1495,-90.0490],['Knoxville',35.9606,-83.9207],['Chattanooga',35.0456,-85.3097],['Clarksville',36.5298,-87.3595]]],
  ['Texas','TX',[['Houston',29.7604,-95.3698],['San Antonio',29.4241,-98.4936],['Dallas',32.7767,-96.7970],['Austin',30.2672,-97.7431],['Fort Worth',32.7555,-97.3308]]],
  ['Utah','UT',[['Salt Lake City',40.7608,-111.8910],['West Valley City',40.6916,-112.0010],['Provo',40.2338,-111.6585],['West Jordan',40.6097,-111.9391],['Orem',40.2969,-111.6946]]],
  ['Vermont','VT',[['Burlington',44.4759,-73.2121],['South Burlington',44.4669,-73.1710],['Rutland',43.6106,-72.9726],['Barre',44.1973,-72.5023],['Montpelier',44.2601,-72.5754]]],
  ['Virginia','VA',[['Virginia Beach',36.8529,-75.9780],['Norfolk',36.8968,-76.2591],['Chesapeake',36.7682,-76.2875],['Richmond',37.5407,-77.4360],['Newport News',37.0871,-76.4730]]],
  ['Washington','WA',[['Seattle',47.6062,-122.3321],['Spokane',47.6588,-117.4260],['Tacoma',47.2529,-122.4443],['Vancouver',45.6387,-122.6615],['Bellevue',47.6101,-122.2015]]],
  ['West Virginia','WV',[['Charleston',38.3498,-81.6326],['Huntington',38.4193,-82.4452],['Morgantown',39.6295,-79.9559],['Parkersburg',39.2667,-81.5615],['Wheeling',40.0640,-80.7209]]],
  ['Wisconsin','WI',[['Milwaukee',43.0389,-87.9065],['Madison',43.0731,-89.4012],['Green Bay',44.5133,-88.0133],['Kenosha',42.5847,-87.8212],['Racine',42.7261,-87.7829]]],
  ['Wyoming','WY',[['Cheyenne',41.1400,-104.8202],['Casper',42.8666,-106.3131],['Laramie',41.3114,-105.5911],['Gillette',44.2911,-105.5022],['Rock Springs',41.5875,-109.2029]]],
];

function makeCourts(stateName, stateAbbr, cityName, lat, lon, si, ci) {
  const slug = cityName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const saSlug = stateAbbr.toLowerCase();
  const seed = si * 1000 + ci * 100;
  function jlat(i) { return parseFloat((lat + offset(seed + i * 3.7, 0.025)).toFixed(4)); }
  function jlon(i) { return parseFloat((lon + offset(seed + i * 7.3, 0.025)).toFixed(4)); }
  function pick(arr, i) { return arr[Math.abs(Math.floor(offset(seed + i * 5.1, arr.length / 2) + arr.length / 2)) % arr.length]; }
  const pname = pick(PARK_NAMES, 0); const pname2 = pick(PARK_NAMES, 1); const pname3 = pick(PARK_NAMES, 2);
  const dir = pick(DIRECTIONS, 3); const ymcaArea = pick(YMCA_AREAS, 4);
  const bp1 = Math.abs(Math.floor(offset(seed + 50, 4))) % 9;
  const bp2 = Math.abs(Math.floor(offset(seed + 51, 4))) % 7;
  const bp3 = Math.abs(Math.floor(offset(seed + 52, 3))) % 5;
  const hoops1 = 4 + (Math.abs(Math.floor(offset(seed + 60, 2))) % 3) * 2;
  const hoops2 = 2 + (Math.abs(Math.floor(offset(seed + 61, 1.5))) % 3) * 2;
  return [
    { id:`${saSlug}-${slug}-1`, name:`${cityName} ${pname} Park Courts`, shortName:`${pname} Park`, address:`${Math.floor(100+Math.abs(offset(seed+1,400)))} ${pname} Dr, ${cityName}, ${stateAbbr}`, city:cityName, state:stateName, stateAbbr, latitude:jlat(1), longitude:jlon(1), type:'outdoor', surface:'asphalt', hoops:hoops1, description:`Popular outdoor courts at ${pname} Park in ${cityName}. A local hotspot for pickup runs.`, basePlayersPlaying:bp1, maxPlayers:10 },
    { id:`${saSlug}-${slug}-2`, name:`${dir} ${cityName} Recreation Center`, shortName:`${dir} Rec Center`, address:`${Math.floor(200+Math.abs(offset(seed+2,600)))} ${dir} Blvd, ${cityName}, ${stateAbbr}`, city:cityName, state:stateName, stateAbbr, latitude:jlat(2), longitude:jlon(2), type:'indoor', surface:'hardwood', hoops:hoops2, description:`Indoor hardwood courts at the ${dir} ${cityName} Recreation Center. Open runs daily.`, basePlayersPlaying:bp2, maxPlayers:10 },
    { id:`${saSlug}-${slug}-3`, name:`YMCA ${ymcaArea} ${cityName}`, shortName:`YMCA ${ymcaArea}`, address:`${Math.floor(300+Math.abs(offset(seed+3,500)))} Main St, ${cityName}, ${stateAbbr}`, city:cityName, state:stateName, stateAbbr, latitude:jlat(3), longitude:jlon(3), type:'indoor', surface:'hardwood', hoops:2+(Math.abs(Math.floor(offset(seed+63,1)))%2)*2, description:`Premium YMCA facility in ${cityName}. Climate-controlled courts with organized leagues and open gym.`, basePlayersPlaying:bp3, maxPlayers:10 },
    { id:`${saSlug}-${slug}-4`, name:`${pname2} Community Park`, shortName:`${pname2} Community`, address:`${Math.floor(100+Math.abs(offset(seed+4,700)))} ${pname2} Rd, ${cityName}, ${stateAbbr}`, city:cityName, state:stateName, stateAbbr, latitude:jlat(4), longitude:jlon(4), type:'outdoor', surface:'concrete', hoops:2+(Math.abs(Math.floor(offset(seed+64,2)))%3)*2, description:`Neighborhood outdoor courts at ${pname2} Community Park in ${cityName}. All skill levels welcome.`, basePlayersPlaying:Math.abs(Math.floor(offset(seed+53,4)))%8, maxPlayers:10 },
    { id:`${saSlug}-${slug}-5`, name:`${cityName} Athletic Complex`, shortName:`${cityName} Athletic`, address:`${Math.floor(500+Math.abs(offset(seed+5,800)))} Sports Way, ${cityName}, ${stateAbbr}`, city:cityName, state:stateName, stateAbbr, latitude:jlat(5), longitude:jlon(5), type:'indoor', surface:'hardwood', hoops:hoops2, description:`Modern athletic complex in ${cityName} with professional-grade hardwood courts.`, basePlayersPlaying:Math.abs(Math.floor(offset(seed+54,3)))%6, maxPlayers:10 },
    { id:`${saSlug}-${slug}-6`, name:`${pname3} Neighborhood Courts`, shortName:`${pname3} Courts`, address:`${Math.floor(400+Math.abs(offset(seed+6,600)))} ${pname3} Ave, ${cityName}, ${stateAbbr}`, city:cityName, state:stateName, stateAbbr, latitude:jlat(6), longitude:jlon(6), type:'outdoor', surface:Math.abs(offset(seed+70,1))>0?'asphalt':'concrete', hoops:2+(Math.abs(Math.floor(offset(seed+65,1.5)))%2)*2, description:`Street-level outdoor courts in a ${cityName} neighborhood. Competitive pickup games all day.`, basePlayersPlaying:Math.abs(Math.floor(offset(seed+55,4)))%7, maxPlayers:10 },
  ];
}

let allCourts = [];
for (let si = 0; si < STATE_DATA.length; si++) {
  const [stateName, stateAbbr, cities] = STATE_DATA[si];
  for (let ci = 0; ci < cities.length; ci++) {
    const [cityName, lat, lon] = cities[ci];
    allCourts = allCourts.concat(makeCourts(stateName, stateAbbr, cityName, lat, lon, si, ci));
  }
}

async function seed() {
  const client = await pool.connect();
  try {
    console.log(`Seeding ${allCourts.length} courts...`);

    // Add state_abbr column if it doesn't exist
    await client.query(`
      ALTER TABLE courts ADD COLUMN IF NOT EXISTS state_abbr VARCHAR(10) DEFAULT '';
    `);

    // Clear existing courts
    await client.query('TRUNCATE TABLE courts CASCADE');
    console.log('Cleared existing courts');

    // Batch insert in chunks of 50
    const chunkSize = 50;
    let inserted = 0;
    for (let i = 0; i < allCourts.length; i += chunkSize) {
      const chunk = allCourts.slice(i, i + chunkSize);
      const placeholders = chunk.map((_, j) => {
        const base = j * 16;
        return `($${base+1},$${base+2},$${base+3},$${base+4},$${base+5},$${base+6},$${base+7},$${base+8},$${base+9},$${base+10},$${base+11},$${base+12},$${base+13},$${base+14},$${base+15},$${base+16})`;
      }).join(',');
      const values = chunk.flatMap(c => [
        c.id, c.name, c.shortName, c.address, c.city, c.state, c.stateAbbr,
        'US', c.latitude, c.longitude, c.type, c.surface, c.hoops,
        c.description, c.basePlayersPlaying, c.maxPlayers
      ]);
      await client.query(
        `INSERT INTO courts (id, name, short_name, address, city, state, state_abbr, country, latitude, longitude, type, surface, hoops, description, base_players_playing, max_players)
         VALUES ${placeholders}
         ON CONFLICT (id) DO UPDATE SET
           name=EXCLUDED.name, short_name=EXCLUDED.short_name, address=EXCLUDED.address,
           city=EXCLUDED.city, state=EXCLUDED.state, state_abbr=EXCLUDED.state_abbr,
           latitude=EXCLUDED.latitude, longitude=EXCLUDED.longitude, type=EXCLUDED.type,
           surface=EXCLUDED.surface, hoops=EXCLUDED.hoops, description=EXCLUDED.description,
           base_players_playing=EXCLUDED.base_players_playing, max_players=EXCLUDED.max_players`,
        values
      );
      inserted += chunk.length;
      if (inserted % 300 === 0) console.log(`  Inserted ${inserted}/${allCourts.length}...`);
    }
    console.log(`✓ Seeded ${allCourts.length} courts successfully`);
  } finally {
    client.release();
    await pool.end();
  }
}

seed().catch(err => { console.error('Seed failed:', err); process.exit(1); });
