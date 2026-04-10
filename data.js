/* data.js — Bay Area BMR unit database
   Replace SAMPLE_UNITS with real data as CPRA responses arrive.

   Schema:
   {
     id: number,
     name: string,
     address: string,
     city: string,
     beds: number[],        // 0=studio, 1, 2, 3
     income: string[],      // "vl", "lo", "mo"
     waitlist: string,      // "open", "closed", "unknown"
     units: number,
     rent_min: number,
     rent_max: number,
     phone: string,
     website: string,
     lat: number,
     lng: number,
     source: string,        // "CPRA" or "sample"
     last_updated: string,
   }
*/

const SAMPLE_UNITS = Object.freeze([
  Object.freeze({ id:1, name:'The Crossings at Mountain View', address:'1000 Stierlin Ct, Mountain View, CA 94043', city:'Mountain View', beds:[1,2], income:['lo','mo'], waitlist:'open', units:45, rent_min:1200, rent_max:1800, phone:'(650) 917-1000', website:'https://www.mtviewhousing.org', lat:37.3861, lng:-122.0839, source:'sample', last_updated:'2026-04-09' }),
  Object.freeze({ id:2, name:'Palo Alto Family Housing', address:'4000 Middlefield Rd, Palo Alto, CA 94303', city:'Palo Alto', beds:[2,3], income:['vl','lo'], waitlist:'closed', units:28, rent_min:900, rent_max:1400, phone:'(650) 327-3300', website:'https://www.cityofpaloalto.org', lat:37.4213, lng:-122.1254, source:'sample', last_updated:'2026-04-09' }),
  Object.freeze({ id:3, name:'Sunnyvale Community Apartments', address:'700 Evelyn Ave, Sunnyvale, CA 94086', city:'Sunnyvale', beds:[0,1,2], income:['vl'], waitlist:'open', units:62, rent_min:750, rent_max:1100, phone:'(408) 730-7444', website:'https://www.sunnyvale.ca.gov', lat:37.3688, lng:-122.0363, source:'sample', last_updated:'2026-04-09' }),
  Object.freeze({ id:4, name:'Ohlone Family Apartments', address:'2300 Senter Rd, San Jose, CA 95112', city:'San Jose', beds:[2,3], income:['vl','lo'], waitlist:'closed', units:80, rent_min:850, rent_max:1300, phone:'(408) 975-4660', website:'https://www.sanjoseca.gov', lat:37.2969, lng:-121.8467, source:'sample', last_updated:'2026-04-09' }),
  Object.freeze({ id:5, name:'Hayward Senior Residences', address:'22100 Princeton St, Hayward, CA 94541', city:'Hayward', beds:[0,1], income:['vl'], waitlist:'unknown', units:35, rent_min:700, rent_max:950, phone:'(510) 583-4400', website:'https://www.hayward-ca.gov', lat:37.6688, lng:-122.0808, source:'sample', last_updated:'2026-04-09' }),
  Object.freeze({ id:6, name:'Oakland Affordable Lofts', address:'1900 Broadway, Oakland, CA 94612', city:'Oakland', beds:[1,2], income:['lo','mo'], waitlist:'open', units:52, rent_min:1100, rent_max:1600, phone:'(510) 238-3909', website:'https://www.oaklandca.gov', lat:37.8044, lng:-122.2712, source:'sample', last_updated:'2026-04-09' }),
  Object.freeze({ id:7, name:'Berkeley Mixed-Income Housing', address:'2100 Durant Ave, Berkeley, CA 94704', city:'Berkeley', beds:[1,2,3], income:['vl','lo','mo'], waitlist:'closed', units:40, rent_min:900, rent_max:1700, phone:'(510) 981-5400', website:'https://www.berkeleyca.gov', lat:37.8651, lng:-122.2595, source:'sample', last_updated:'2026-04-09' }),
  Object.freeze({ id:8, name:'Dublin Family Commons', address:'6700 Amador Plaza Rd, Dublin, CA 94568', city:'Dublin', beds:[2,3], income:['lo','mo'], waitlist:'open', units:30, rent_min:1300, rent_max:1900, phone:'(925) 833-6610', website:'https://www.dublin.ca.gov', lat:37.7021, lng:-121.9358, source:'sample', last_updated:'2026-04-09' }),
  Object.freeze({ id:9, name:'Alameda Affordable Housing', address:'950 W. Mall Square, Alameda, CA 94501', city:'Alameda', beds:[1,2], income:['vl','lo'], waitlist:'unknown', units:24, rent_min:850, rent_max:1250, phone:'(510) 747-4900', website:'https://www.alamedaca.gov', lat:37.7652, lng:-122.2416, source:'sample', last_updated:'2026-04-09' }),
  Object.freeze({ id:10, name:'Fremont Gateway Apartments', address:'3900 Mowry Ave, Fremont, CA 94538', city:'Fremont', beds:[1,2,3], income:['lo','mo'], waitlist:'open', units:55, rent_min:1050, rent_max:1650, phone:'(510) 574-2000', website:'https://www.fremont.gov', lat:37.5485, lng:-122.0597, source:'sample', last_updated:'2026-04-09' }),
  Object.freeze({ id:11, name:'Livermore Affordable Homes', address:'1052 S. Livermore Ave, Livermore, CA 94550', city:'Livermore', beds:[2,3], income:['lo','mo'], waitlist:'closed', units:32, rent_min:1100, rent_max:1700, phone:'(925) 960-4580', website:'https://www.livermoreca.gov', lat:37.6819, lng:-121.7680, source:'sample', last_updated:'2026-04-09' }),
  Object.freeze({ id:12, name:'Pleasanton Heritage Apts', address:'200 Old Bernal Ave, Pleasanton, CA 94566', city:'Pleasanton', beds:[1,2], income:['vl','lo'], waitlist:'open', units:28, rent_min:950, rent_max:1450, phone:'(925) 931-5007', website:'https://www.cityofpleasantonca.gov', lat:37.6624, lng:-121.8747, source:'sample', last_updated:'2026-04-09' }),
  Object.freeze({ id:13, name:'Santa Clara Family Residences', address:'1500 Warburton Ave, Santa Clara, CA 95050', city:'Santa Clara', beds:[2,3], income:['vl','lo'], waitlist:'unknown', units:44, rent_min:900, rent_max:1400, phone:'(408) 615-2490', website:'https://www.santaclaraca.gov', lat:37.3541, lng:-121.9552, source:'sample', last_updated:'2026-04-09' }),
  Object.freeze({ id:14, name:'Milpitas Senior Housing', address:'455 E. Calaveras Blvd, Milpitas, CA 95035', city:'Milpitas', beds:[0,1], income:['vl'], waitlist:'closed', units:38, rent_min:700, rent_max:1000, phone:'(408) 586-3000', website:'https://www.milpitas.gov', lat:37.4323, lng:-121.8996, source:'sample', last_updated:'2026-04-09' }),
]);
