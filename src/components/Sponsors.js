import React from 'react';
import Image from 'next/image';
import sponsors from '../data/sponsors.json';

const MARQUEE_THRESHOLD = 4;

const poweredBy = sponsors.filter((s) => s.tier === 'powered_by');
const hallOfFame = sponsors.filter((s) => s.tier === 'hall_of_fame');
const sponsorList = sponsors.filter((s) => s.tier === 'sponsor');
const supporterList = sponsors.filter((s) => s.tier === 'supporter');

const hasAnySponsor =
  poweredBy.length > 0 || hallOfFame.length > 0 || sponsorList.length > 0 || supporterList.length > 0;

const PoweredByCard = ({ sponsor }) => (
  <a href={sponsor.url} target='_blank' rel='noopener noreferrer' className='powered-by-card'>
    <Image src={sponsor.image} alt={sponsor.name} fill className='powered-by-bg' unoptimized />
    <div className='powered-by-overlay'>
      <span className='powered-by-name'>{sponsor.name}</span>
      {sponsor.badge && <span className='powered-by-badge'>{sponsor.badge}</span>}
    </div>
  </a>
);

const HallOfFameCard = ({ sponsor }) => (
  <a href={sponsor.url} target='_blank' rel='noopener noreferrer' className='hof-card'>
    <Image src={sponsor.image} alt={sponsor.name} width={40} height={40} className='sponsor-avatar' unoptimized />
    <div className='hof-info'>
      <span className='hof-name'>{sponsor.name}</span>
    </div>
  </a>
);

const SponsorPill = ({ sponsor }) => (
  <a href={sponsor.url} target='_blank' rel='noopener noreferrer' className='sponsor-pill'>
    <Image src={sponsor.image} alt={sponsor.name} width={28} height={28} className='sponsor-avatar' unoptimized />
    <span className='sponsor-pill-name'>{sponsor.name}</span>
  </a>
);

const SupporterPill = ({ sponsor } = {}) => {
  if (!sponsor?.url || !sponsor?.image) return null;
  return (
    <a href={sponsor.url} target='_blank' rel='noopener noreferrer' className='supporter-pill'>
      <Image
        src={sponsor.image}
        alt={sponsor.name ?? ''}
        width={20}
        height={20}
        className='sponsor-avatar'
        unoptimized
      />
      <span className='supporter-pill-name'>@{sponsor.username ?? sponsor.name ?? ''}</span>
    </a>
  );
};

const MarqueeRow = ({ items = [], renderItem = () => null, keyFn = (s) => s } = {}) => {
  const shouldScroll = items.length > MARQUEE_THRESHOLD;

  if (!shouldScroll) {
    return <div className='sponsors-row'>{items.map((s) => renderItem(s, keyFn(s)))}</div>;
  }

  return (
    <div className='sponsors-marquee'>
      <div className='sponsors-marquee-track'>
        {items.map((s) => renderItem(s, `a-${keyFn(s)}`))}
        {items.map((s) => renderItem(s, `b-${keyFn(s)}`))}
      </div>
    </div>
  );
};

const Sponsors = () => {
  if (!hasAnySponsor) return null;

  return (
    <div className='sponsors-section'>
      <a
        href='https://github.com/sponsors/nabondance'
        target='_blank'
        rel='noopener noreferrer'
        className='sponsors-title'
      >
        Sponsors
      </a>
      <p className='sponsors-label'>
        Trailhead Banner is free and open source. It exists thanks to the generosity of these supporters.
      </p>

      {poweredBy.length > 0 && (
        <div className='sponsors-tier'>
          <span className='sponsors-tier-label'>Powered by</span>
          <div className='sponsors-row'>
            {poweredBy.map((s) => (
              <PoweredByCard key={s.name} sponsor={s} />
            ))}
          </div>
        </div>
      )}

      {hallOfFame.length > 0 && (
        <div className='sponsors-tier'>
          <span className='sponsors-tier-label'>Hall of Fame</span>
          <MarqueeRow
            items={hallOfFame}
            renderItem={(s, key) => <HallOfFameCard key={key} sponsor={s} />}
            keyFn={(s) => s.name}
          />
        </div>
      )}

      {sponsorList.length > 0 && (
        <div className='sponsors-tier'>
          <span className='sponsors-tier-label'>Sponsors</span>
          <MarqueeRow
            items={sponsorList}
            renderItem={(s, key) => <SponsorPill key={key} sponsor={s} />}
            keyFn={(s) => s.username || s.name}
          />
        </div>
      )}

      {supporterList.length > 0 && (
        <div className='sponsors-tier'>
          <span className='sponsors-tier-label'>Supporters</span>
          <MarqueeRow
            items={supporterList}
            renderItem={(s, key) => <SupporterPill key={key} sponsor={s} />}
            keyFn={(s) => s.username || s.name}
          />
        </div>
      )}
    </div>
  );
};

export default Sponsors;
