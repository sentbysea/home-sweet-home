// about 글자 아트의 문자 — 형상(shapes.js)의 칸마다 어떤 글자를 놓을지.
//   지금은 alphabet: 형상마다 영어 단어 하나를 줄을 따라 끊지 않고 이어 쓴다(칸 순서 = 위 → 아래, 왼 → 오른).
//   가까이 보면 철자가 읽히고, 진하기(tone)는 글자색 농도로만 나타난다.
//   ascii 로 바꾸려면 MODE 만 'ascii' 로 — 그때는 진하기에 맞춰 RAMP 의 글자를 고른다(단어는 굴뚝 연기 같은 장식에만).

export const WORDS = {
  youth: 'youth',
  freesia: 'freesia',
  farewell: 'farewell',
  home: 'homesweethome',
};

export const MODE = 'alphabet';
const RAMP = '.:-=+*#%@';
// 밝기 지도로 그리는 형상(청소년기) — 밝은 곳은 ASCII 결(. : - = + ?), 진한 곳은 단어 철자(가장 진한 곳은 대문자)
const TONE_RAMP = ".'`:-=+?7";
const TONE_WORD = 0.5;

/**
 * 형상 이름 → (칸, 칸 번호) => 글자
 * @param {string} name
 */
export function glyphsFor(name, { toned = false } = {}) {
  const word = WORDS[name] || name;
  if (toned) {
    let n = 0;
    return (cell) => {
      if (MODE === 'ascii' || cell.tone < TONE_WORD) return TONE_RAMP[Math.min(TONE_RAMP.length - 1, Math.floor((cell.tone / TONE_WORD) * TONE_RAMP.length))];
      const c = word[n++ % word.length];
      return cell.tone > 0.85 ? c.toUpperCase() : c;
    };
  }
  if (MODE === 'ascii') return (cell) => RAMP[Math.min(RAMP.length - 1, Math.round(cell.tone * (RAMP.length - 1)))];
  return (_cell, k) => word[k % word.length];
}

/** 장식 글자(굴뚝 연기 등) — 늘 단어의 철자 차례 */
export const wordGlyph = (name, k) => {
  const word = WORDS[name] || name;
  return word[k % word.length];
};
