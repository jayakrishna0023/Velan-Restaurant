// One delivery, step by step: Pick up → Drive → Hand over.
import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useLang } from '@velan/shared/i18n.jsx';
import { Icon } from '@velan/shared/components/Icon.jsx';
import { StatusBadge } from '@velan/shared/components/ui.jsx';
import { PickupStage, DriveStage, HandoverStage } from './JobStages.jsx';
import FullMap from './FullMap.jsx';

const STAGES = ['pickup', 'drive', 'handover'];
const STAGE_ICON = { pickup: 'store', drive: 'scooter', handover: 'key' };

function Stepper({ stage }) {
  const { t } = useLang();
  const idx = STAGES.indexOf(stage);
  return (
    <ol className="r-stepper" aria-label="Steps">
      <span className="r-stepper-track"><motion.span animate={{ scaleX: idx / (STAGES.length - 1) }} transition={{ type: 'spring', stiffness: 160, damping: 24 }} /></span>
      {STAGES.map((s, i) => (
        <li key={s} className={i < idx ? 'done' : i === idx ? 'now' : ''} aria-current={i === idx ? 'step' : undefined}>
          <motion.span className="r-step-dot" animate={{ scale: i === idx ? 1.12 : 1 }} transition={{ type: 'spring', stiffness: 400, damping: 18 }}>
            <Icon name={i < idx ? 'check' : STAGE_ICON[s]} size={16} stroke={2.2} />
          </motion.span>
          <span className="r-step-label">{t(`step.${s}`)}</span>
        </li>
      ))}
    </ol>
  );
}

export default function JobScreen({ order, onClose }) {
  const { t, money } = useLang();
  const picked = order.status === 'out_for_delivery';
  const [stage, setStage] = useState(picked ? 'drive' : 'pickup');
  const [fullMap, setFullMap] = useState(false);
  const body = useRef(null);

  useEffect(() => {
    if (picked && stage === 'pickup') setStage('drive');
    if (!picked && stage !== 'pickup') setStage('pickup');
  }, [picked, stage]);
  useEffect(() => { body.current?.scrollTo({ top: 0, behavior: 'smooth' }); }, [stage]);

  return (
    <motion.div className="r-sheet" role="dialog" aria-label={t('orderNo', { n: order.number })}
      initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%', transition: { duration: 0.3, ease: [0.65, 0, 0.35, 1] } }}
      transition={{ type: 'spring', stiffness: 300, damping: 34 }}>
      <header className="r-sheet-head">
        <button type="button" className="btn btn-soft btn-icon" onClick={onClose} aria-label={t('back')}><Icon name="chevronLeft" size={22} /></button>
        <div className="grow">
          <div className="r-sheet-title">{t('orderNo', { n: order.number })}</div>
          <div className="r-sheet-sub ellipsis">{order.customerName} · <span className="num">{money(order.bill.total)}</span></div>
        </div>
        <StatusBadge order={order} live />
      </header>
      <Stepper stage={stage} />
      <div className="r-sheet-body" ref={body}>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={stage} className="r-stage-body" initial={{ opacity: 0, x: 36 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -36 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}>
            {stage === 'pickup' && <PickupStage order={order} onFullMap={() => setFullMap(true)} />}
            {stage === 'drive' && <DriveStage order={order} onArrived={() => setStage('handover')} onFullMap={() => setFullMap(true)} />}
            {stage === 'handover' && <HandoverStage order={order} onBack={() => setStage('drive')} />}
          </motion.div>
        </AnimatePresence>
      </div>
      <AnimatePresence>{fullMap && <FullMap order={order} onClose={() => setFullMap(false)} />}</AnimatePresence>
    </motion.div>
  );
}
