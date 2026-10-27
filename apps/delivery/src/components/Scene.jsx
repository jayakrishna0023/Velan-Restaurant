// Empty-state illustration: a scooter on a moving road inside a thin brass ring.
import { motion } from 'framer-motion';
import { useLang } from '@velan/shared/i18n.jsx';
import { Icon } from '@velan/shared/components/Icon.jsx';

export default function Scene({ online }) {
  const { t } = useLang();
  return (
    <motion.div className={`r-scene ${online ? 'is-on' : ''}`} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
      <div className="r-scene-art">
        <span className="r-scene-ring" />
        <div className="r-scene-road"><span /></div>
        <motion.div className="r-scene-rider"
          animate={online ? { y: [0, -3, 0], rotate: [0, -1.5, 0] } : { y: 0 }}
          transition={{ duration: 0.55, repeat: online ? Infinity : 0, ease: 'easeInOut' }}>
          <Icon name={online ? 'scooter' : 'moon'} size={46} stroke={1.7} />
          {online && <span className="r-scene-dust"><i /><i /><i /></span>}
        </motion.div>
      </div>
      <h3>{online ? t('empty.onTitle') : t('empty.offTitle')}</h3>
      <p>{online ? t('empty.on') : t('empty.off')}</p>
    </motion.div>
  );
}
