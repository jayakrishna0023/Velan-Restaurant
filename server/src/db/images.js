// Starting dish photos: free-licence Unsplash photos, each checked to show the
// dish (or its closest match). Replace them with real photos of your own food
// in Admin → Menu — kothu parotta, bread halwa and jigarthanda especially.
const photo = (id) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=900&h=700&q=75`;

export const IMAGES = {
  chickenBiryani: photo('1631515243349-e0cb75fb8d3a'),
  muttonBiryani: photo('1696950169706-d4533c32f81a'),
  nattuKoziBiryani: photo('1680359870819-22556317ce22'),
  eggBiryani: photo('1724331567781-223844aff732'),
  kuska: photo('1733764430476-99f24c5f3d35'),
  chicken65Biryani: photo('1579112965143-9139ed2a522a'),
  chicken65: photo('1757445060056-6d6aeec73de4'),
  pallipalayamChicken: photo('1736239092878-95523f1b1d25'),
  pepperChicken: photo('1716551028663-eb6435eca4b4'),
  chilliChicken: photo('1710508774177-7ac2f3492675'),
  muttonChukka: photo('1727867168767-c67974f68508'),
  fishFry: photo('1765265432607-cdc1060294ba'),
  gobi65: photo('1676976197084-a7b35e0d2537'),
  chickenLollipop: photo('1696950171387-dc808171711e'),
  parotta: photo('1683533743190-89c9b19f9ea6'),
  chickenKothuParotta: photo('1716801551616-c458ec2a9b92'),
  eggKothuParotta: photo('1678684277767-dfc70d6c362e'),
  bunParotta: photo('1668357530437-72a12c660f94'),
  chickenFriedRice: photo('1638502182261-7be714a565ce'),
  eggFriedRice: photo('1609570324378-ec0c4c9b6ba8'),
  vegFriedRice: photo('1664717698774-84f62382613b'),
  chickenNoodles: photo('1781332152753-1199601d73d2'),
  vegNoodles: photo('1617622141573-2e00d8818f3f'),
  omelette: photo('1736239092482-e57ef9b26f15'),
  breadHalwa: photo('1517244683847-7456b63c5969'),
  roseMilk: photo('1622268348720-507f204d29b4'),
  jigarthanda: photo('1630823186728-b17c9f82a32d'),
  limeJuice: photo('1507281549113-040fcfef650e'),
  goliSoda: photo('1694654358946-60cdcb979f22'),
};
