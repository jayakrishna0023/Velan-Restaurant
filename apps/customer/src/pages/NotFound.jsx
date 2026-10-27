import { Link } from 'react-router';
import { useLang } from '@velan/shared/i18n.jsx';
import { VelSeal } from '@velan/shared/components/Brand.jsx';

export default function NotFound() {
  const { tr } = useLang();
  return (
    <section className="page narrow center-page">
      <VelSeal size={150} draw />
      <h1 className="display">{tr('This plate is empty', 'இந்தத் தட்டு காலி')}</h1>
      <p className="muted">{tr('The page you are looking for is not on our menu.', 'நீங்கள் தேடும் பக்கம் எங்கள் மெனுவில் இல்லை.')}</p>
      <Link to="/" className="btn btn-primary">{tr('Back to the menu', 'மெனுவுக்குத் திரும்பு')}</Link>
    </section>
  );
}
