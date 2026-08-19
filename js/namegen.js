/* ============ 墨阁 · 起名助手（离线随机生成） ============ */
window.NameGen = (() => {
  const D = window.Data;
  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

  function generateNames(opts) {
    opts = opts || {};
    const gender = opts.gender || 'neutral';
    const style = opts.style || 'classic';
    const count = Math.min(opts.count || 10, 60);
    const surnamePool = D.SURNAMES;
    const genderPool = gender === 'male' ? D.MALE_CHARS : gender === 'female' ? D.FEMALE_CHARS : D.MALE_CHARS.concat(D.FEMALE_CHARS);
    const styleChars = D.STYLE_CHARS[style] || D.STYLE_CHARS.classic;
    const names = new Set();
    let guard = 0;
    while (names.size < count && guard++ < count * 60) {
      const s = pick(surnamePool);
      const c1 = pick(genderPool);
      const roll = Math.random();
      let given;
      if (roll < 0.4) {
        given = c1;                                        /* 单字名 */
      } else if (roll < 0.7) {
        given = pick(styleChars) + c1;                     /* 风格字 + 常用字 */
      } else if (roll < 0.9) {
        given = c1 + pick(styleChars);                     /* 常用字 + 风格字 */
      } else {
        given = c1 + pick(genderPool);                     /* 双常用字 */
      }
      names.add(s + given);
    }
    return Array.from(names).slice(0, count);
  }

  const PEN_POOL = ('墨云星河月夜风行霜雪溪岚尘霄枫澜羽痕凌霄陌尘清欢南栀晚风北辰向南顾北凉笙砚卿辞九歌朝暮惊鸿'.split(''));
  const PEN_STYLE = ['', '', '', '', '丶', 'の', '.', '-'];

  function penNames(count) {
    count = Math.min(count || 8, 30);
    const out = new Set();
    let guard = 0;
    while (out.size < count && guard++ < count * 60) {
      let n;
      const roll = Math.random();
      if (roll < 0.5) {
        n = pick(PEN_POOL) + pick(PEN_POOL);
      } else if (roll < 0.8) {
        n = pick(['墨', '顾', '苏', '陆', '沈', '江', '洛', '楚', '白', '林', '萧', '叶', '云', '夜', '风', '南']) + pick(PEN_POOL);
      } else {
        n = pick(PEN_POOL) + pick(PEN_POOL) + pick(PEN_POOL);
      }
      out.add(n + (Math.random() < 0.25 ? pick(PEN_STYLE) : ''));
    }
    return Array.from(out).slice(0, count);
  }

  return { generateNames, penNames };
})();
