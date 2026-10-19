import React from 'react';
import { LeagueType } from '../types';

export const DiscordLogo: React.FC<{ className?: string; color?: string }> = ({
  className = 'w-5 h-5',
  color = 'currentColor',
}) => (
  <svg viewBox="0 0 24 24" fill={color} className={className}>
    <path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189Z" />
  </svg>
);

export const AyushAvatar: React.FC<{ className?: string }> = ({ className = 'w-8 h-8' }) => (
  <div className={`${className} rounded-full overflow-hidden bg-[#D4D4D0] border border-[#DFDED9] shrink-0 flex items-center justify-center`}>
    <svg viewBox="0 0 64 64" className="w-full h-full">
      <rect width="64" height="64" fill="#D5D5D2" />
      <path d="M12 64 C14 49, 50 49, 52 64 Z" fill="#1E1E22" />
      <path d="M25 50 L32 58 L39 50 Z" fill="#F2F2F0" />
      <rect x="27" y="42" width="10" height="10" rx="3" fill="#EFEFE9" />
      <path d="M20 26 C20 15, 44 15, 44 26 C44 37, 38 45, 32 45 C26 45, 20 37, 20 26 Z" fill="#F5F5F2" />
      <path
        d="M16 28 C15 16, 23 9, 33 9 C43 9, 49 16, 48 28 C47 22, 44 19, 41 24 C39 18, 35 17, 33 23 C30 17, 26 19, 24 24 C21 19, 18 22, 16 28 Z"
        fill="#232327"
      />
      <path d="M17 22 C15 28, 17 34, 21 37 C19 31, 20 26, 22 22 Z" fill="#232327" />
      <path d="M47 22 C49 28, 47 34, 43 37 C45 31, 44 26, 42 22 Z" fill="#232327" />
      <ellipse cx="26.5" cy="30" rx="2.2" ry="1.8" fill="#232327" />
      <ellipse cx="37.5" cy="30" rx="2.2" ry="1.8" fill="#232327" />
      <circle cx="26" cy="29.5" r="0.6" fill="#FFFFFF" />
      <circle cx="37" cy="29.5" r="0.6" fill="#FFFFFF" />
      <path d="M23.5 26.5 Q26.5 25.5 29 26.8" stroke="#232327" strokeWidth="1.2" fill="none" strokeLinecap="round" />
      <path d="M35 26.8 Q37.5 25.5 40.5 26.5" stroke="#232327" strokeWidth="1.2" fill="none" strokeLinecap="round" />
      <path d="M29.5 38.5 Q32 39.8 34.5 38.5" stroke="#52525B" strokeWidth="1.2" fill="none" strokeLinecap="round" />
    </svg>
  </div>
);

export const ServerIcon: React.FC<{
  id: string;
  variant?: 'sidebar' | 'table' | 'header';
  className?: string;
}> = ({ id, variant = 'table', className }) => {
  const sizeClass =
    className ||
    (variant === 'header'
      ? 'w-12 h-12 rounded-2xl'
      : variant === 'sidebar'
      ? 'w-7 h-7 rounded-lg'
      : 'w-8 h-8 rounded-full');

  if (id === 'squad') {
    if (variant === 'header') {
      return (
        <div className={`${sizeClass} bg-[#141416] flex items-center justify-center text-white shrink-0`}>
          <DiscordLogo className="w-7 h-7" />
        </div>
      );
    }
    return (
      <div className={`${sizeClass} bg-[#18181B] flex items-center justify-center text-white shrink-0`}>
        <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
          <circle cx="12" cy="8" r="2.6" />
          <circle cx="6.5" cy="9.5" r="2" opacity="0.85" />
          <circle cx="17.5" cy="9.5" r="2" opacity="0.85" />
          <path d="M7.5 17.5c0-2.3 2-4 4.5-4s4.5 1.7 4.5 4v1H7.5v-1z" />
          <path d="M3 17.5c0-1.8 1.4-3.2 3.3-3.4-.5.8-.8 1.8-.8 2.9v.5H3z" opacity="0.75" />
          <path d="M21 17.5c0-1.8-1.4-3.2-3.3-3.4.5.8.8 1.8.8 2.9v.5H21z" opacity="0.75" />
        </svg>
      </div>
    );
  }

  if (id === 'ai') {
    if (variant === 'sidebar') {
      return (
        <div className={`${sizeClass} bg-[#18181B] flex items-center justify-center text-white shrink-0`}>
          <DiscordLogo className="w-4 h-4" />
        </div>
      );
    }
    return (
      <div className={`${sizeClass} bg-[#374086] flex items-center justify-center text-white shrink-0`}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" className="w-4 h-4">
          <circle cx="12" cy="12" r="8" strokeOpacity="0.4" />
          <path d="M12 6.5L15.8 16H13.9L13.1 13.8H10.9L10.1 16H8.2L12 6.5Z" fill="currentColor" stroke="none" />
        </svg>
      </div>
    );
  }

  if (id === 'code') {
    if (variant === 'sidebar') {
      return (
        <div className={`${sizeClass} bg-[#27272A] flex items-center justify-center text-white shrink-0`}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5">
            <path d="M9 8h4a2 2 0 0 1 2 2v1a2 2 0 0 1-2 2H9a2 2 0 0 0-2 2v1a2 2 0 0 0 2 2h5" strokeLinecap="round" />
            <circle cx="10.5" cy="6.5" r="1" fill="currentColor" />
          </svg>
        </div>
      );
    }
    return (
      <div className={`${sizeClass} bg-[#18181B] flex items-center justify-center text-white shrink-0`}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="w-4 h-4">
          <polyline points="8 8 4 12 8 16" strokeLinecap="round" strokeLinejoin="round" />
          <polyline points="16 8 20 12 16 16" strokeLinecap="round" strokeLinejoin="round" />
          <line x1="13.5" y1="6" x2="10.5" y2="18" strokeLinecap="round" />
        </svg>
      </div>
    );
  }

  if (id === 'valo') {
    return (
      <div className={`${sizeClass} bg-[#18181B] flex items-center justify-center shrink-0`}>
        <svg viewBox="0 0 24 24" fill="#EF4444" className="w-4 h-4">
          <path d="M4.5 6.5L10.8 17.5H7.2L3.5 11.2V6.5H4.5ZM19.5 6.5V11.2L15.8 17.5H12.2L18.5 6.5H19.5Z" />
        </svg>
      </div>
    );
  }

  if (id === 'gaming') {
    if (variant === 'sidebar') {
      return (
        <div className={`${sizeClass} bg-[#18181B] flex items-center justify-center text-white shrink-0`}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="w-3.5 h-3.5">
            <polyline points="8 8 4 12 8 16" strokeLinecap="round" strokeLinejoin="round" />
            <polyline points="16 8 20 12 16 16" strokeLinecap="round" strokeLinejoin="round" />
            <line x1="13.5" y1="6" x2="10.5" y2="18" strokeLinecap="round" />
          </svg>
        </div>
      );
    }
    return (
      <div className={`${sizeClass} bg-[#18181B] flex items-center justify-center text-white shrink-0`}>
        <DiscordLogo className="w-4 h-4" />
      </div>
    );
  }

  if (id === 'newbie') {
    return (
      <div className={`${sizeClass} bg-[#5865F2] flex items-center justify-center text-white shrink-0`}>
        <DiscordLogo className="w-4 h-4" />
      </div>
    );
  }

  if (id === 'art') {
    return (
      <div className={`${sizeClass} bg-[#18181B] flex items-center justify-center text-[#EC4899] shrink-0`}>
        <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
          <path d="M12 4L5 19h3.2l1.6-3.8h4.4L15.8 19H19L12 4zm-1.1 8.5L12 9.6l1.1 2.9h-2.2z" />
        </svg>
      </div>
    );
  }

  if (id === 'study') {
    return (
      <div className={`${sizeClass} bg-[#143829] flex items-center justify-center text-[#34D399] shrink-0`}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="w-4 h-4">
          <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    );
  }

  // Deterministic fallback for live guild IDs ($DEV, $GAMING, $MED, etc).
  // Colors are hashed from the ID so every listed server gets a stable identity tile.
  const hash = Math.abs(
    Array.from(id).reduce((acc, ch) => (Math.imul(31, acc) + ch.charCodeAt(0)) | 0, 7),
  );
  const palette = ['#374086', '#143829', '#27272A', '#4F46E5', '#0E7490', '#7C2D92', '#B45309', '#B91C1C'];
  const bg = palette[hash % palette.length];

  return (
    <div className={`${sizeClass} flex items-center justify-center shrink-0`} style={{ backgroundColor: bg }}>
      <DiscordLogo className={variant === 'sidebar' ? 'w-3.5 h-3.5 text-white' : 'w-4 h-4 text-white'} />
    </div>
  );
};

export const LeagueBadge: React.FC<{ league: LeagueType }> = ({ league }) => {
  const styles: Record<LeagueType, string> = {
    Titan: 'bg-[#EBF3FF] text-[#3B82F6]',
    Arena: 'bg-[#F4EFE6] text-[#8C734B]',
    Club: 'bg-[#ECEDFF] text-[#4F46E5]',
    Squad: 'bg-[#F3EFE6] text-[#7C6E54]',
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-[11px] font-medium ${styles[league]}`}>
      {league}
    </span>
  );
};

export const HeroIsometricIllustration: React.FC = () => (
  <svg viewBox="0 0 340 215" className="w-[310px] h-[196px] select-none pointer-events-none shrink-0">
    <defs>
      <linearGradient id="isoPlatform" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#F5F5F3" />
        <stop offset="100%" stopColor="#EAE9E4" />
      </linearGradient>
      <linearGradient id="cardFront" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#FFFFFF" />
        <stop offset="100%" stopColor="#F4F4F1" />
      </linearGradient>
      <linearGradient id="cardEdge" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#E5E4DF" />
        <stop offset="100%" stopColor="#D5D4CE" />
      </linearGradient>
      <filter id="softShadow" x="-15%" y="-15%" width="130%" height="130%">
        <feDropShadow dx="0" dy="8" stdDeviation="7" floodColor="#18181B" floodOpacity="0.06" />
      </filter>
    </defs>

    <path
      d="M25 162 L185 110 L328 168 L168 210 Z"
      fill="url(#isoPlatform)"
      opacity="0.7"
    />
    <g stroke="#E2E1DC" strokeWidth="0.75" opacity="0.8">
      <line x1="65" y1="149" x2="208" y2="199" />
      <line x1="105" y1="136" x2="248" y2="188" />
      <line x1="145" y1="123" x2="288" y2="178" />
      <line x1="75" y1="175" x2="225" y2="126" />
      <line x1="120" y1="188" x2="265" y2="142" />
      <line x1="165" y1="201" x2="305" y2="156" />
    </g>

    <g filter="url(#softShadow)" transform="translate(82, -16)">
      <path
        d="M52 42 L132 14 C139 12 145 17 145 25 L145 108 C145 116 139 123 132 126 L52 154 C45 156 39 151 39 143 L39 60 C39 52 45 45 52 42 Z"
        fill="url(#cardEdge)"
      />
      <path
        d="M47 40 L127 12 C134 10 140 15 140 23 L140 106 C140 114 134 121 127 124 L47 152 C40 154 34 149 34 141 L34 58 C34 50 40 43 47 40 Z"
        fill="url(#cardFront)"
        stroke="#E6E5E0"
        strokeWidth="1"
      />
    </g>

    <g filter="url(#softShadow)" transform="translate(46, -4)">
      <path
        d="M52 42 L132 14 C139 12 145 17 145 25 L145 108 C145 116 139 123 132 126 L52 154 C45 156 39 151 39 143 L39 60 C39 52 45 45 52 42 Z"
        fill="url(#cardEdge)"
      />
      <path
        d="M47 40 L127 12 C134 10 140 15 140 23 L140 106 C140 114 134 121 127 124 L47 152 C40 154 34 149 34 141 L34 58 C34 50 40 43 47 40 Z"
        fill="url(#cardFront)"
        stroke="#E6E5E0"
        strokeWidth="1"
      />
    </g>

    <g filter="url(#softShadow)" transform="translate(10, 10)">
      <path
        d="M52 42 L132 14 C139 12 145 17 145 25 L145 108 C145 116 139 123 132 126 L52 154 C45 156 39 151 39 143 L39 60 C39 52 45 45 52 42 Z"
        fill="url(#cardEdge)"
      />
      <path
        d="M47 40 L127 12 C134 10 140 15 140 23 L140 106 C140 114 134 121 127 124 L47 152 C40 154 34 149 34 141 L34 58 C34 50 40 43 47 40 Z"
        fill="url(#cardFront)"
        stroke="#E5E4DF"
        strokeWidth="1"
      />
      <g transform="translate(65, 62) skewY(-19) scale(1.85)">
        <path
          d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189Z"
          fill="#6E7B91"
        />
      </g>
    </g>

    <g transform="translate(205, 138)">
      <polygon points="0,12 12,7 24,12 12,17" fill="#FFFFFF" stroke="#E2E1DC" strokeWidth="0.8" />
      <polygon points="0,12 12,17 12,42 0,37" fill="#F2F1ED" stroke="#E2E1DC" strokeWidth="0.8" />
      <polygon points="12,17 24,12 24,37 12,42" fill="#E5E4DF" stroke="#DAD9D3" strokeWidth="0.8" />
    </g>
    <g transform="translate(232, 122)">
      <polygon points="0,12 12,7 24,12 12,17" fill="#FFFFFF" stroke="#E2E1DC" strokeWidth="0.8" />
      <polygon points="0,12 12,17 12,56 0,51" fill="#F2F1ED" stroke="#E2E1DC" strokeWidth="0.8" />
      <polygon points="12,17 24,12 24,51 12,56" fill="#E5E4DF" stroke="#DAD9D3" strokeWidth="0.8" />
    </g>
    <g transform="translate(259, 103)">
      <polygon points="0,12 12,7 24,12 12,17" fill="#FFFFFF" stroke="#E2E1DC" strokeWidth="0.8" />
      <polygon points="0,12 12,17 12,72 0,67" fill="#F2F1ED" stroke="#E2E1DC" strokeWidth="0.8" />
      <polygon points="12,17 24,12 24,67 12,72" fill="#E5E4DF" stroke="#DAD9D3" strokeWidth="0.8" />
    </g>
    <g transform="translate(286, 118)">
      <polygon points="0,12 12,7 24,12 12,17" fill="#FFFFFF" stroke="#E2E1DC" strokeWidth="0.8" />
      <polygon points="0,12 12,17 12,54 0,49" fill="#F2F1ED" stroke="#E2E1DC" strokeWidth="0.8" />
      <polygon points="12,17 24,12 24,49 12,54" fill="#E5E4DF" stroke="#DAD9D3" strokeWidth="0.8" />
    </g>

    <path
      d="M170 135 L204 102 L228 118 L266 78 L286 92 L318 42"
      fill="none"
      stroke="#159966"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M308 42 L318 42 L319 52"
      fill="none"
      stroke="#159966"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);
