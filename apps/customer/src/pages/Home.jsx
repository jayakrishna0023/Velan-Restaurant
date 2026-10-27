import { useSite } from '../state/site.js';
import Hero from '../components/Hero.jsx';
import OffersStrip from '../components/OffersStrip.jsx';
import MenuSection from '../components/MenuSection.jsx';
import Intro from '../components/Intro.jsx';
import Method from '../components/Method.jsx';
import Reviews from '../components/Reviews.jsx';
import Visit, { ZoneModal } from '../components/Visit.jsx';
import DishModal from '../components/DishModal.jsx';

// The handi opens, then straight into the menu with your plate beside it;
// the kitchen's story, reviews and the way to the restaurant follow.
export default function Home() {
  const loaded = useSite((s) => s.loaded);
  if (!loaded) return <div className="page-loading"><span className="spinner" /></div>;
  return (
    <>
      <Hero />
      <OffersStrip />
      <MenuSection />
      <Intro />
      <Method />
      <Reviews />
      <Visit />
      <DishModal />
      <ZoneModal />
    </>
  );
}
