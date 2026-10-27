// First visit: the shop's rolling shutter, with the sign painted across it,
// rattles and rolls up to open the site. Kept to about a second.
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Sign } from '@velan/shared/components/Poster.jsx';

export default function Preloader({ ready, onDone }) {
  const [minTime, setMinTime] = useState(false);
  useEffect(() => { const id = setTimeout(() => setMinTime(true), 1100); return () => clearTimeout(id); }, []);
  useEffect(() => { if (ready && minTime) onDone(); }, [ready, minTime, onDone]);
  useEffect(() => { const id = setTimeout(onDone, 4000); return () => clearTimeout(id); }, [onDone]);

  return (
    <motion.div className="shutter" aria-hidden="true"
      exit={{ y: ['0%', '2.5%', '-102%'], transition: { duration: 0.95, times: [0, 0.18, 1], ease: [0.6, 0, 0.25, 1] } }}>
      <span className="shutter-slats" />
      <motion.div className="shutter-sign" initial={{ scale: 1.35, rotate: -9, opacity: 0 }} animate={{ scale: 1, rotate: -3, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 380, damping: 14, delay: 0.1 }}>
        <Sign size="xl" />
        <p>வணக்கம்! · Vanakkam!</p>
      </motion.div>
      <span className="shutter-handle" />
    </motion.div>
  );
}
