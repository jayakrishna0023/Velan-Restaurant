// Photography for the website sections (free-licence Unsplash photos).
// Dish photos come from the menu itself (Admin → Menu).
const photo = (id, w = 1600) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${w}&q=80`;

export const AMBIENCE = {
  hero: photo('1676436293945-a613dde9c3b6', 1800),
  heroAlt: photo('1755090154731-6b4f221490c3', 1800),
  dumPot: photo('1697155406055-2db32d47ca07'),
  spices: photo('1716816211590-c15a328a5ff0'),
  bananaLeaf: photo('1625398407796-82650a8c135f'),
  flame: photo('1600565193348-f74bd3c7ccdf'),
  temple: photo('1674981324574-a0ebb0bef50d', 2000),
  river: photo('1782126709079-2f71b647e840', 2000),
  diners: photo('1578496780896-7081cc23c111'),
  rider: photo('1617347454431-f49d7ff5c3b1'),
  chef: photo('1763951719324-d1ff7eff0f7b'),
};

// The temple town: gopuram, corridors, lamps, the river. Real photographs,
// each checked by eye (free Unsplash licence).
export const TEMPLE = {
  gopuramDusk: photo('1541173061692-bbec3dc2bf85', 2200), // gopuram against a storm-cloud sunset, open sky on the left
  gopuramDetail: photo('1777732340807-1f951bbe84bd'),
  corridor: photo('1677935405218-2f5bbc997c66', 2000), // sandstone pillared mandapam
  lamps: photo('1619410676080-5be7b3befc21'),
  lampSingle: photo('1675865253406-dfc0d4ebc7cb'),
  kaveri: photo('1719232426002-9bb0e51c3d93', 2000), // boat at the ghat steps, sunset
  templeTank: photo('1674981324574-a0ebb0bef50d', 2200), // Chidambaram tank, gopuram reflected
  spiceMarket: photo('1716816211590-c15a328a5ff0'), // whole spices on dark stone
  woodfire: photo('1515931215890-366d3990cf8d'), // steaming kadai
  biryaniHandi: photo('1697155406055-2db32d47ca07'),
  bananaLeafFeast: photo('1736239092023-ba677fd6751c'),
  marigold: photo('1695549278493-d3059c8f8d4a'),
  village: photo('1603779787136-e3bd7d20e322', 2200), // temple-town street at blue hour
};
