// Original, scalable line art. Decorative only: the adjacent text carries meaning.
export function MemoryIllustration({ compact = false }: { compact?: boolean }) {
  return (
    <svg
      className={compact ? "memory-art compact" : "memory-art"}
      viewBox="0 0 1080 600"
      fill="none"
      aria-hidden="true"
    >
      <g
        stroke="#30271f"
        strokeWidth="3.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <g transform="translate(75 125) rotate(-16)">
          <path
            d="M2 38C-8 15 12 2 31 12C39-8 67-1 66 17C91 10 101 33 85 45C102 66 73 80 60 64C45 87 17 75 22 55C4 65-12 50 2 38Z"
            fill="#b6d9e9"
          />
        </g>
        <path d="M216 70C236 37 262 47 250 62C237 81 228 30 276 48C312 63 293 88 286 65C281 43 326 35 344 57" />
        <path d="M723 69C745 42 777 42 773 64C767 84 746 43 788 43C815 44 832 59 847 70" />
        <path
          d="m174 195 10 23 24 5-21 12-5 26-12-22-24-4 20-15Z"
          fill="#c1d878"
        />
        <path
          d="M929 142C905 115 874 153 895 175L925 202C931 183 964 164 950 145C944 137 934 137 929 142Z"
          fill="#f06445"
        />
        <path
          d="m887 70 2 18 18-6-10 15 13 12-20-3-5 19-7-17-18 6 11-14-12-13 20 5Z"
          fill="#fff9ed"
        />
        <path d="M355 111c-10-18-27-6-19 6l16 16c3-9 18-14 14-22-3-6-8-4-11 0Z" />
        <path
          d="m743 140 5 13 15 2-12 9-1 16-10-12-15 3 8-13-7-10Z"
          fill="#f1c85f"
        />
        <path d="M60 303c25-33 58-26 43-11-18 18-18-17 11-20 18-3 29 7 40 17" />
        <path d="M980 278c-18 1-23 21-12 25 14 4 16-21 3-17-16 5-12 43 4 50" />
        <circle cx="132" cy="89" r="4" />
        <circle cx="808" cy="197" r="4" />
        <circle cx="965" cy="236" r="3" />
        <g className="hero-object" transform="translate(90 380) rotate(-12)">
          <path
            d="M0 15Q0 2 12 2L130 0Q142 0 141 13L140 103Q140 114 126 114L12 116Q-1 116 0 104Z"
            fill="#f3c861"
          />
          <path d="m11 12 120-2-2 72-117 3Z" fill="#fffaf1" />
          <circle cx="70" cy="48" r="29" fill="#33302c" />
          <circle cx="70" cy="48" r="12" fill="#ee7959" />
          <circle cx="70" cy="48" r="2" fill="#fffaf1" />
          <path d="m115 19-8 37-12 8" />
          <path d="m16 99 55-1" />
          <circle cx="118" cy="98" r="5" />
          <path d="m153 24 6-20 15 5-6 21m-9-26 2-9 15 5-2 9" />
          <ellipse cx="153" cy="27" rx="5" ry="3" fill="#33302c" />
          <ellipse cx="168" cy="33" rx="5" ry="3" fill="#33302c" />
        </g>
        <g className="hero-object" transform="translate(785 391) rotate(8)">
          <path
            d="M2 18Q26 2 59 19Q86 1 113 14L113 89Q82 77 59 93Q31 77 0 91Z"
            fill="#fffaf1"
          />
          <path d="M59 19v74M13 35q19-8 33 0m-33 13q19-8 33 0m25-14q15-7 29-3m-29 16q15-7 29-3M1 95l58 9 57-10" />
          <path d="m80 13 0 29 6-6 6 4V10" fill="#ef7552" />
        </g>
        <g className="hero-object" transform="translate(912 399)">
          <path d="M15 54Q7 85 21 99H49Q60 82 53 54Z" fill="#b9d1ae" />
          <path d="M34 54V10m0 28Q10 15 8 35q7 14 26 9m1-23q23-21 27-5-2 13-27 17" />
          <path
            d="M34 10C7 7 17-14 30-5C28-25 51-19 44-5C63-13 70 10 50 12C59 29 37 32 34 10Z"
            fill="#f1ca61"
          />
          <circle cx="40" cy="6" r="5" />
        </g>
        <g className="hero-object">
          <path d="M28 535Q244 532 414 535T1052 534" strokeWidth="2.4" />
          <path d="M284 521q-7-21 3-30m-3 30q9-13 16-12m-16 12q-13-13-18-7" />
          <path d="m667 515 8-14 9 15m-13 3h10" strokeWidth="2" />
        </g>
      </g>
    </svg>
  )
}

export function RecordIllustration() {
  return (
    <svg viewBox="0 0 300 210" fill="none" aria-hidden="true">
      <g
        stroke="#30271f"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="m72 33 140 12-10 145-145-12Z" fill="#f4b94b" />
        <path d="m83 44 146 9-10 144-144-12Z" fill="#fffcf4" />
        <circle cx="161" cy="117" r="64" fill="#34302c" />
        <circle cx="161" cy="117" r="50" stroke="#625c52" />
        <circle cx="161" cy="117" r="39" stroke="#625c52" />
        <circle cx="161" cy="117" r="22" fill="#ec7657" />
        <circle cx="161" cy="117" r="4" fill="#fffaf2" />
        <path d="m239 37 6-22 16 5-7 23m-11-20 16 5" />
        <ellipse cx="235" cy="40" rx="6" ry="4" fill="#30271f" />
        <ellipse cx="250" cy="46" rx="6" ry="4" fill="#30271f" />
        <path d="m37 96 5 10 12 2-9 8v13l-9-8-12 2 7-11-5-9Z" fill="#c5d789" />
      </g>
    </svg>
  )
}

export function ConnectionIllustration() {
  return (
    <svg viewBox="0 0 300 210" fill="none" aria-hidden="true">
      <g
        stroke="#30271f"
        strokeWidth="2.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M51 112h67l-4 47q-24 17-54-1Z" fill="#f2c667" />
        <path
          d="M119 121c39-8 24 42-3 27M183 109h67l-6 49q-29 14-54-1Z"
          fill="#b0cfe3"
        />
        <path d="M251 119c33-6 24 36-4 28M55 173q102 9 203-1M81 95c-20-15 21-24 1-40m130 40c-20-15 22-27 1-42" />
        <path
          d="M151 43c-23-25-43-3-26 15l27 24c6-13 40-33 26-46-8-8-22-4-27 7Z"
          fill="#f17b61"
        />
        <path
          d="m39 54 5 12 14 1-11 9-2 14-8-12-13 2 7-12-6-10Z"
          fill="#c1d38e"
        />
        <path d="m259 52-6 10m20-5-10 7" />
      </g>
    </svg>
  )
}
