// First-run data: settings, categories, the starting menu, the admin login and
// (outside production) demo riders, customers and a month of order history so
// the dashboards, reports and reviews have something to show.
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { db, kv, newId, transaction } from './database.js';
import { PRODUCTION, SEED_DEMO } from '../config.js';
import { DEFAULT_SETTINGS } from '../services/settings.js';
import { computeBill, deliveryQuote, dayKey } from '@velan/shared/domain.js';
import { IMAGES } from './images.js';

export const CATEGORIES = [
  { key: 'biryani', name: 'Dum Biryani', nameTa: 'தம் பிரியாணி', tagline: 'Sealed handi, slow fire, seeraga samba', taglineTa: 'மாவு மூடிய அண்டா, மெல்லிய தீ, சீரக சம்பா' },
  { key: 'starters', name: 'Starters & Fry', nameTa: 'ஸ்டார்ட்டர்ஸ் & வறுவல்', tagline: 'Crackling, fiery, Kongu style', taglineTa: 'மொறுமொறு, காரசாரம், கொங்கு ஸ்டைல்' },
  { key: 'parotta', name: 'Parotta & Kothu', nameTa: 'பரோட்டா & கொத்து', tagline: 'Flaky layers off the hot tawa', taglineTa: 'சூடான தோசைக்கல்லில் அடுக்கு பரோட்டா' },
  { key: 'rice', name: 'Fried Rice & Noodles', nameTa: 'ஃபிரைடு ரைஸ் & நூடுல்ஸ்', tagline: 'Wok-tossed on a roaring flame', taglineTa: 'பெருந்தீயில் வாணலியில் வதக்கியது' },
  { key: 'sweets', name: 'Sweets & Drinks', nameTa: 'இனிப்பு & பானங்கள்', tagline: 'Cool down after the spice', taglineTa: 'காரத்துக்குப் பின் குளிர்ச்சி' },
];

// [imageKey, category, name, nameTa, price, dailyStock, veg, spicy, flags, description, descTa]
const DISHES = [
  ['chickenBiryani', 'biryani', 'Chicken Dum Biryani', 'சிக்கன் தம் பிரியாணி', 160, 80, false, 2, 'bestseller',
    'Seeraga samba rice and tender chicken layered in a dough-sealed handi. Served with onion raita and brinjal gravy.',
    'சீரக சம்பா அரிசியும் மென்மையான சிக்கனும் மாவு மூடிய அண்டாவில் தம். வெங்காய ரைத்தா, கத்திரிக்காய் கிரேவியுடன்.'],
  ['muttonBiryani', 'biryani', 'Mutton Dum Biryani', 'மட்டன் தம் பிரியாணி', 260, 40, false, 2, 'bestseller chefSpecial',
    'Slow-cooked tender goat meat with whole spices — our signature. Served with raita and dalcha.',
    'முழு மசாலாவுடன் மெதுவாக வெந்த ஆட்டுக்கறி — எங்கள் சிறப்பு. ரைத்தா, தால்சாவுடன்.'],
  ['nattuKoziBiryani', 'biryani', 'Nattu Kozhi Biryani', 'நாட்டுக்கோழி பிரியாணி', 240, 25, false, 3, 'chefSpecial',
    'Country chicken from local farms, pepper-forward masala and a deeper, rustic flavour.',
    'உள்ளூர் பண்ணை நாட்டுக்கோழி, மிளகு மணக்கும் மசாலா — ஆழமான கிராமத்து சுவை.'],
  ['eggBiryani', 'biryani', 'Egg Biryani', 'முட்டை பிரியாணி', 120, 40, false, 1, '',
    'Biryani rice with two masala-roasted boiled eggs.',
    'மசாலாவில் வறுத்த இரண்டு வேகவைத்த முட்டைகளுடன் பிரியாணி.'],
  ['chicken65Biryani', 'biryani', 'Chicken 65 Biryani', 'சிக்கன் 65 பிரியாணி', 190, 30, false, 3, 'new',
    'Our dum biryani crowned with fiery Chicken 65 — two favourites, one plate.',
    'தம் பிரியாணி மேல் காரசார சிக்கன் 65 — இரண்டு விருப்பங்கள், ஒரே தட்டில்.'],
  ['kuska', 'biryani', 'Kuska', 'குஸ்கா', 90, 40, true, 1, '',
    'Fragrant biryani rice without meat — light, aromatic and comforting.',
    'இறைச்சி இல்லாத மணமான பிரியாணி சாதம் — லேசானது, சுவையானது.'],

  ['chicken65', 'starters', 'Chicken 65', 'சிக்கன் 65', 140, 50, false, 3, 'bestseller',
    'Crispy, deep-red fried chicken with curry leaves and green chilli.',
    'கறிவேப்பிலை, பச்சை மிளகாயுடன் மொறுமொறுப்பான சிவப்பு வறுத்த சிக்கன்.'],
  ['pallipalayamChicken', 'starters', 'Pallipalayam Chicken', 'பள்ளிபாளையம் சிக்கன்', 180, 25, false, 3, 'chefSpecial',
    'A Kongu classic: chicken roasted with coconut slivers, shallots and dry red chillies.',
    'கொங்கு ஸ்பெஷல்: தேங்காய்ப் பூ, சின்ன வெங்காயம், காய்ந்த மிளகாயுடன் வறுத்த சிக்கன்.'],
  ['pepperChicken', 'starters', 'Pepper Chicken', 'பெப்பர் சிக்கன்', 160, 30, false, 2, '',
    'Dry roast with freshly crushed black pepper and curry leaves.',
    'புதிதாக இடித்த கருமிளகு, கறிவேப்பிலையுடன் உலர் வறுவல்.'],
  ['chilliChicken', 'starters', 'Chilli Chicken', 'சில்லி சிக்கன்', 150, 30, false, 3, '',
    'Chicken tossed with green chilli, onion and capsicum.',
    'பச்சை மிளகாய், வெங்காயம், குடைமிளகாயுடன் வதக்கிய சிக்கன்.'],
  ['muttonChukka', 'starters', 'Mutton Chukka', 'மட்டன் சுக்கா', 240, 20, false, 3, 'bestseller',
    'Bone-in mutton dry-roasted with shallots, pepper and roasted spices.',
    'சின்ன வெங்காயம், மிளகு, வறுத்த மசாலாவுடன் உலர் வறுவல் ஆட்டுக்கறி.'],
  ['fishFry', 'starters', 'Kaveri Fish Fry', 'காவிரி மீன் வறுவல்', 180, 20, false, 2, 'new',
    'Fresh river fish marinated in red masala and shallow-fried crisp.',
    'சிவப்பு மசாலாவில் ஊறிய புதிய ஆற்று மீன், மொறுமொறுப்பாக வறுத்தது.'],
  ['chickenLollipop', 'starters', 'Chicken Lollipop', 'சிக்கன் லாலிபாப்', 170, 25, false, 2, '',
    'Frenched chicken wings, fried crisp and tossed in a spicy glaze.',
    'காரமான சாஸில் புரட்டிய மொறுமொறு சிக்கன் விங்ஸ்.'],
  ['gobi65', 'starters', 'Gobi 65', 'கோபி 65', 100, 30, true, 2, '',
    'Crispy fried cauliflower florets with curry leaves.',
    'கறிவேப்பிலையுடன் மொறுமொறுப்பாக வறுத்த காலிஃப்ளவர்.'],

  ['parotta', 'parotta', 'Parotta (2 pcs)', 'பரோட்டா (2)', 40, 100, true, 0, 'bestseller',
    'Soft, flaky layered parotta with hot salna.',
    'சூடான சால்னாவுடன் மென்மையான அடுக்கு பரோட்டா.'],
  ['bunParotta', 'parotta', 'Bun Parotta', 'பன் பரோட்டா', 50, 40, true, 0, '',
    'Thick, fluffy Madurai-style bun parotta with salna.',
    'சால்னாவுடன் தடிமனான மதுரை ஸ்டைல் பன் பரோட்டா.'],
  ['chickenKothuParotta', 'parotta', 'Chicken Kothu Parotta', 'சிக்கன் கொத்து பரோட்டா', 140, 40, false, 2, 'bestseller',
    'Shredded parotta beaten on the tawa with chicken, egg and salna.',
    'சிக்கன், முட்டை, சால்னாவுடன் தோசைக்கல்லில் கொத்திய பரோட்டா.'],
  ['eggKothuParotta', 'parotta', 'Egg Kothu Parotta', 'முட்டை கொத்து பரோட்டா', 110, 40, false, 2, '',
    'Shredded parotta tossed with egg, onion and spices.',
    'முட்டை, வெங்காயம், மசாலாவுடன் கொத்திய பரோட்டா.'],
  ['omelette', 'parotta', 'Double Omelette', 'டபுள் ஆம்லெட்', 40, 50, false, 1, '',
    'Two-egg omelette with onion and green chilli.',
    'வெங்காயம், பச்சை மிளகாயுடன் இரண்டு முட்டை ஆம்லெட்.'],

  ['chickenFriedRice', 'rice', 'Chicken Fried Rice', 'சிக்கன் ஃபிரைடு ரைஸ்', 130, 40, false, 1, '',
    'Wok-tossed rice with chicken, egg and vegetables.',
    'சிக்கன், முட்டை, காய்கறிகளுடன் வாணலியில் வதக்கிய சாதம்.'],
  ['eggFriedRice', 'rice', 'Egg Fried Rice', 'முட்டை ஃபிரைடு ரைஸ்', 110, 30, false, 1, '',
    'Fried rice with scrambled egg and spring onion.',
    'முட்டை, வெங்காயத்தாளுடன் ஃபிரைடு ரைஸ்.'],
  ['vegFriedRice', 'rice', 'Veg Fried Rice', 'வெஜ் ஃபிரைடு ரைஸ்', 100, 30, true, 1, '',
    'Fried rice with carrot, beans, cabbage and peas.',
    'கேரட், பீன்ஸ், முட்டைகோஸ், பட்டாணியுடன் ஃபிரைடு ரைஸ்.'],
  ['chickenNoodles', 'rice', 'Chicken Noodles', 'சிக்கன் நூடுல்ஸ்', 130, 30, false, 1, '',
    'Hakka noodles with chicken and crunchy vegetables.',
    'சிக்கன், மொறுமொறு காய்கறிகளுடன் ஹக்கா நூடுல்ஸ்.'],
  ['vegNoodles', 'rice', 'Veg Noodles', 'வெஜ் நூடுல்ஸ்', 100, 25, true, 1, '',
    'Noodles with crunchy vegetables and soy.',
    'மொறுமொறு காய்கறிகளுடன் நூடுல்ஸ்.'],

  ['breadHalwa', 'sweets', 'Bread Halwa', 'பிரெட் அல்வா', 50, 40, true, 0, 'bestseller',
    'The classic biryani-shop finish: bread slow-cooked in ghee, sugar and cashews.',
    'பிரியாணிக்குப் பின் கட்டாயம்: நெய், சர்க்கரை, முந்திரியுடன் மெதுவாக கிண்டிய பிரெட் அல்வா.'],
  ['jigarthanda', 'sweets', 'Jigarthanda', 'ஜிகர்தண்டா', 80, 30, true, 0, 'new',
    'Madurai’s famous cooler — milk, almond gum, rose syrup and ice cream.',
    'மதுரையின் புகழ்பெற்ற குளிர்பானம் — பால், பாதாம் பிசின், ரோஸ் சிரப், ஐஸ்கிரீம்.'],
  ['roseMilk', 'sweets', 'Rose Milk', 'ரோஸ் மில்க்', 45, 40, true, 0, '',
    'Chilled milk with rose syrup and sabja seeds.',
    'ரோஸ் சிரப், சப்ஜா விதைகளுடன் குளிர்ந்த பால்.'],
  ['limeJuice', 'sweets', 'Lime Juice', 'எலுமிச்சை ஜூஸ்', 30, 50, true, 0, '',
    'Fresh lime juice — sweet or salt.',
    'புதிய எலுமிச்சை ஜூஸ் — இனிப்பு அல்லது உப்பு.'],
  ['goliSoda', 'sweets', 'Goli Soda', 'கோலி சோடா', 25, 60, true, 0, '',
    'The marble-bottle soda — paneer or lemon flavour.',
    'கோலி பாட்டில் சோடா — பன்னீர் அல்லது எலுமிச்சை சுவை.'],
];

const COUPONS = [
  { code: 'VELAN50', title: '₹50 off on orders above ₹399', titleTa: '₹399க்கு மேல் ₹50 தள்ளுபடி', type: 'flat', value: 50, minOrder: 399, perUserLimit: 3 },
  { code: 'FIRST20', title: '20% off your first order (up to ₹100)', titleTa: 'முதல் ஆர்டருக்கு 20% தள்ளுபடி (₹100 வரை)', type: 'percent', value: 20, maxDiscount: 100, minOrder: 149, firstOrderOnly: true, perUserLimit: 1 },
  { code: 'FREEDEL', title: 'Free delivery above ₹299', titleTa: '₹299க்கு மேல் இலவச டெலிவரி', type: 'freedelivery', value: 0, minOrder: 299, perUserLimit: 5 },
];

// Deterministic randomness so every fresh demo database looks the same.
function rng(seed) {
  let a = seed;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const FIRST = ['Kavya', 'Arun', 'Priya', 'Karthikeyan', 'Divya', 'Saravanan', 'Meena', 'Vignesh', 'Anitha', 'Prakash', 'Revathi', 'Dinesh',
  'Gayathri', 'Manikandan', 'Sangeetha', 'Ramesh', 'Nandhini', 'Suresh', 'Keerthana', 'Balaji', 'Pavithra', 'Gokul', 'Lavanya', 'Hari',
  'Janani', 'Sathish', 'Abinaya', 'Mohan', 'Deepa', 'Senthil', 'Kowsalya', 'Ashok', 'Yamini', 'Bharath', 'Sowmya', 'Elango'];
const LAST = ['Raman', 'Kumar', 'Selvam', 'M', 'Natarajan', 'P', 'Lakshmi', 'R', 'Murugesan', 'Ganesan', 'S', 'Babu', 'K', 'V', 'Ravi', 'Chandran'];
// Customer 1 is the documented demo login: 9876500011 / demo123.
const DEMO_CUSTOMERS = Array.from({ length: 56 }, (_, i) => [`${FIRST[i % FIRST.length]} ${LAST[(i * 7) % LAST.length]}`, String(9876500011 + i)]);

const PLACES = [
  ['Nerur main road, near bus stop', 'Opp. Arulmigu temple', 11.0068, 78.1712],
  ['Uniyur north street', 'Near panchayat office', 11.0031, 78.1789],
  ['Vangal, Kaveri bank road', 'Near the school', 10.9905, 78.1601],
  ['Thirumukkudalur, Kovil street', 'Behind the temple tank', 10.9718, 78.1873],
  ['Karur bypass, Sukaliyur', 'Near petrol bunk', 10.9822, 78.1186],
  ['Mohanur road, Nerur south', 'Next to ration shop', 10.9962, 78.1824],
  ['Sadayampalayam, 2nd street', 'Blue gate house', 11.0154, 78.1663],
  ['Paramathi road, Vangal', 'Near water tank', 11.0121, 78.1528],
];

const REVIEWS = [
  [5, 'Best biryani on this side of Karur. Mutton was super soft and the masala was perfect.'],
  [5, 'பிரியாணி அருமை! சிக்கன் 65 மொறுமொறுப்பா இருந்துச்சு.'],
  [5, 'Delivery was quick and the food was still steaming hot. Packing was neat.'],
  [4, 'நம்ம ஊரு சுவை. அடுத்த வாரமும் ஆர்டர் பண்ணுவேன்.'],
  [5, 'Pallipalayam chicken is a must try. Reminds me of my paati’s cooking.'],
  [5, 'Rider called before reaching and was very polite. Biryani 10/10.'],
  [5, 'கொத்து பரோட்டா செம்ம டேஸ்ட்! சால்னா கூட நல்லா இருந்தது.'],
  [4, 'Good quantity for the price. Bread halwa after biryani is the perfect combo.'],
  [5, 'சூடா, சுவையா வந்துச்சு. நன்றி வேலன்!'],
  [4, 'A little spicy for the kids but very tasty. Will ask for less spice next time.'],
  [5, 'Ordered for a family function — everyone asked where the biryani came from.'],
  [5, 'நாட்டுக்கோழி பிரியாணி மணம் வீடு முழுக்க. கண்டிப்பா ட்ரை பண்ணுங்க.'],
  [3, 'Taste was good but delivery took a bit longer than shown.'],
  [5, 'Jigarthanda was a lovely surprise. Proper Madurai style.'],
  [4, 'Consistent every time. Our Sunday lunch place now.'],
  [2, 'Parotta was cold when it reached. Biryani was fine.'],
];

function demoData() {
  const rand = rng(20261023);
  const pick = (arr) => arr[Math.floor(rand() * arr.length)];
  const settings = kv.get('settings', DEFAULT_SETTINGS);
  const menu = db.menu.all();
  const weight = (m) => (m.bestseller ? 5 : m.chefSpecial ? 3 : 1.4) * (m.categoryId.endsWith('biryani') ? 1.8 : 1);
  const totalW = menu.reduce((s, m) => s + weight(m), 0);
  const pickDish = () => { let r = rand() * totalW; for (const m of menu) { r -= weight(m); if (r <= 0) return m; } return menu[0]; };

  const hash = bcrypt.hashSync('demo123', 8);
  const customers = DEMO_CUSTOMERS.map(([name, phone], i) => db.users.insert({
    id: newId('cus'), role: 'customer', name, phone, passwordHash: hash, active: true,
    createdAt: new Date(Date.now() - (60 - i) * 864e5).toISOString(),
  }));
  customers.forEach((c, i) => {
    const [line, landmark, lat, lng] = PLACES[i % PLACES.length];
    db.addresses.insert({ id: newId('adr'), userId: c.id, label: 'home', line: `${(i * 7) % 90 + 3}, ${line}`, landmark, lat: lat + (rand() - 0.5) * 0.004, lng: lng + (rand() - 0.5) * 0.004, createdAt: c.createdAt });
  });
  const riders = db.users.find("role = 'rider'");
  // A few loyal regulars, many occasional customers, and some who stopped
  // ordering three weeks ago (the "at risk" segment in Admin → Customers).
  const loyalty = customers.map((_, i) => (i < 4 ? 5 : i < 14 ? 1.6 : 0.7));
  const churned = (i) => i >= 46;
  const pickCustomer = (back) => {
    const pool = customers.map((c, i) => [c, churned(i) && back < 24 ? 0 : loyalty[i]]);
    let r = rand() * pool.reduce((s, [, w]) => s + w, 0);
    for (const [c, w] of pool) { r -= w; if (r <= 0) return c; }
    return customers[0];
  };

  let number = 1000;
  const orders = [];
  for (let back = 34; back >= 0; back -= 1) {
    const date = new Date(Date.now() - back * 864e5);
    const weekday = new Date(date.getTime() + 330 * 60000).getUTCDay();
    const base = weekday === 0 ? 26 : weekday === 6 ? 21 : 14;
    const count = Math.round(base * (0.8 + rand() * 0.45) * (back === 0 ? 0.45 : 1));
    for (let n = 0; n < count; n += 1) {
      // Lunch (12–15) and dinner (19–22) peaks, IST.
      const lunch = rand() < 0.42;
      const hour = lunch ? 12 + Math.floor(rand() * 3.2) : 18 + Math.floor(rand() * 4.4);
      const minute = Math.floor(rand() * 60);
      const istMidnight = Date.UTC(...dayKey(date).split('-').map((v, i) => (i === 1 ? Number(v) - 1 : Number(v)))) - 330 * 60000;
      const created = new Date(istMidnight + (hour * 60 + minute) * 60000);
      if (created > Date.now() - 50 * 60000) continue;
      const counter = rand() < 0.16;
      const customer = counter ? null : pickCustomer(back);
      const type = counter ? (rand() < 0.7 ? 'pickup' : 'delivery') : rand() < 0.86 ? 'delivery' : 'pickup';
      const lines = new Map();
      const k = 1 + Math.floor(rand() * 3.4);
      for (let j = 0; j < k; j += 1) {
        const m = pickDish();
        const cur = lines.get(m.id) || { id: m.id, name: m.name, nameTa: m.nameTa, price: m.price, qty: 0, veg: m.veg, image: m.image };
        cur.qty += 1 + (rand() < 0.25 ? 1 : 0);
        lines.set(m.id, cur);
      }
      const items = [...lines.values()];
      const subtotal = items.reduce((s, l) => s + l.price * l.qty, 0);
      const [line, landmark, plat, plng] = pick(PLACES);
      const address = type === 'delivery' ? { label: 'home', line, landmark, lat: plat + (rand() - 0.5) * 0.006, lng: plng + (rand() - 0.5) * 0.006 } : null;
      const quote = address ? deliveryQuote(settings, address, subtotal) : null;
      const couponCode = !counter && rand() < 0.12 ? (subtotal >= 399 ? 'VELAN50' : subtotal >= 299 && type === 'delivery' ? 'FREEDEL' : null) : null;
      const coupon = couponCode ? COUPONS.find((c) => c.code === couponCode) : null;
      const bill = computeBill({ lines: items, settings, type, deliveryFee: quote?.fee || 0, coupon });
      const cancelled = rand() < 0.04;
      const prep = 14 + Math.floor(rand() * 14);
      const at = (m) => new Date(created.getTime() + m * 60000).toISOString();
      const rider = type === 'delivery' ? pick(riders) : null;
      const travel = address ? Math.round(quote.distanceKm * 3.2 + 4 + rand() * 6) : 0;
      const order = {
        id: newId('ord'), number: ++number, source: counter ? (rand() < 0.5 ? 'counter' : 'phone') : 'online', type,
        status: cancelled ? (rand() < 0.5 ? 'cancelled' : 'rejected') : 'delivered',
        customerId: customer?.id || null, customerName: customer?.name || pick(['Walk-in', 'Selvi', 'Murali', 'Ganesh', 'Kumar']),
        phone: customer?.phone || '', items, bill: { ...bill, couponCode }, payment: { method: rand() < 0.62 ? 'cash' : 'upi', status: cancelled ? 'pending' : 'paid' },
        address, distanceKm: quote?.distanceKm ?? null, otp: String(1000 + Math.floor(rand() * 9000)),
        riderId: cancelled ? null : rider?.id || null, prepMins: prep, notes: '',
        timeline: [{ status: 'placed', at: at(0), by: counter ? 'admin' : 'customer' }],
        createdAt: at(0), updatedAt: at(prep + travel + 4), day: dayKey(created),
      };
      if (cancelled) {
        order.timeline.push({ status: order.status, at: at(3), by: order.status === 'rejected' ? 'admin' : 'customer' });
        order.cancelReason = order.status === 'rejected' ? 'Item finished' : '';
        order.cancelledBy = order.status === 'rejected' ? 'admin' : 'customer';
      } else {
        Object.assign(order, { acceptedAt: at(2), readyBy: at(2 + prep), readyAt: at(2 + prep + Math.floor(rand() * 5)), deliveredAt: at(prep + travel + 4) });
        order.timeline.push({ status: 'accepted', at: at(2), by: 'admin' }, { status: 'preparing', at: at(3), by: 'admin' }, { status: 'ready', at: order.readyAt, by: 'admin' });
        if (type === 'delivery') {
          order.pickedAt = at(prep + 5);
          order.timeline.push({ status: 'out_for_delivery', at: order.pickedAt, by: 'rider' });
          order.riderPay = Math.round(settings.riderPayBase + settings.riderPayPerKm * order.distanceKm);
          if (order.payment.method === 'cash') order.cashSettled = back > 0;
        }
        order.timeline.push({ status: 'delivered', at: order.deliveredAt, by: type === 'delivery' ? 'rider' : 'admin' });
        if (customer && rand() < 0.38) {
          const [stars, text] = pick(REVIEWS);
          order.rating = { food: stars, delivery: type === 'delivery' ? Math.min(5, stars + (rand() < 0.5 ? 0 : 1)) : null, review: rand() < 0.75 ? text : '', tags: [], at: at(prep + travel + 40), featured: stars === 5 && rand() < 0.4 };
        }
      }
      orders.push(order);
    }
  }
  orders.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  orders.forEach((o, i) => { o.number = 1001 + i; db.orders.insert(o); });
  kv.set('counter:order', 1000 + orders.length);
  for (const c of COUPONS) {
    const used = orders.filter((o) => o.bill.couponCode === c.code && o.status === 'delivered').length;
    db.coupons.update(c.code, { used });
  }
}

export function seedIfEmpty() {
  if (kv.get('seeded')) return false;
  transaction(() => {
    kv.set('settings', DEFAULT_SETTINGS);
    CATEGORIES.forEach((c, i) => db.categories.insert({ id: `cat_${c.key}`, name: c.name, nameTa: c.nameTa, tagline: c.tagline, taglineTa: c.taglineTa, sort: i }));
    DISHES.forEach(([img, cat, name, nameTa, price, dailyStock, veg, spicy, flags, description, descTa], i) => {
      db.menu.insert({
        id: newId('dish'), categoryId: `cat_${cat}`, name, nameTa, description, descTa, price, mrp: null, veg, spicy,
        bestseller: flags.includes('bestseller'), chefSpecial: flags.includes('chefSpecial'), isNew: flags.includes('new'),
        available: true, stock: dailyStock, dailyStock, image: IMAGES[img] || '', serves: 1, sort: i,
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      });
    });
    const now = new Date().toISOString();
    for (const c of COUPONS) {
      db.coupons.insert({ id: c.code, maxDiscount: null, firstOrderOnly: false, usageLimit: null, validTo: null, active: true, public: true, used: 0, titleTa: '', createdAt: now, updatedAt: now, ...c });
    }
    let adminPassword = process.env.ADMIN_PASSWORD;
    if (!adminPassword && PRODUCTION) {
      adminPassword = crypto.randomBytes(6).toString('base64url');
      console.log(`\n  First start: admin login is ${process.env.ADMIN_PHONE || '9000000000'} / ${adminPassword} — change it in Admin → Settings.\n`);
    }
    const user = (role, name, phone, password, extra = {}) => db.users.insert({
      id: newId(role), role, name, phone, passwordHash: bcrypt.hashSync(password, 10), active: true, createdAt: now, ...extra,
    });
    user('admin', 'Velan Admin', process.env.ADMIN_PHONE || '9000000000', adminPassword || 'admin123');
    if (SEED_DEMO) {
      user('rider', 'Murugan', '9000000001', 'rider123', { vehicle: 'TN 47 AK 2231', online: false });
      user('rider', 'Karthik', '9000000002', 'rider123', { vehicle: 'TN 47 BC 0918', online: false });
      user('rider', 'Senthil', '9000000003', 'rider123', { vehicle: 'TN 47 AZ 5504', online: false });
      demoData();
    }
    kv.set('seeded', true);
  });
  return true;
}
