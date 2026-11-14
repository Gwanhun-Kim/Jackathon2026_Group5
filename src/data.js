export const SERVICE_TITLE = '누가 이김?';
// 선수별 완성 이미지 경로. 예: ohtani: './assets/characters/ohtani.png'
import { loadCustomCharacters } from './fight-link.js';
export const CHARACTER_IMAGES = Object.fromEntries(['ohtani', 'ngannou', 'son', 'kim', 'ha', 'park'].map((id) => [id, `./character/images/body/${id}.svg`]));
const roster = [ ['ohtani','오타니','야구'], ['ngannou','은가누','격투기'], ['son','손흥민','축구'], ['kim','김연경','배구'], ['ha','하승진','농구'], ['park','박태환','수영'] ];
export const STAT_LABELS = [['stamina','체력','스태미나'],['power','파워',''],['attackSpeed','공격 속도',''],['toughness','맷집','HP · KO 저항'],['moveSpeed','이동 속도',''],['reach','사거리',''],['defense','방어','']];
export const INSTRUCTIONS = ['마음에 드는 선수를 선택하세요.','선수마다 다른 능력치와 특수 효과를 확인하세요.','직접 생성 메뉴에서 나만의 선수 만들기를 시작할 수 있어요.'];
export async function loadCharacters() {
  let source = [];
  try { const response = await fetch('./characters.json'); if (!response.ok) throw new Error('Unavailable'); const data = await response.json(); source = data.characters ?? []; } catch { /* No invented fallback stats. */ }
  return [...roster.map(([id,name,sport]) => ({ ...source.find(c => c.id === id), id, name, sport, image: CHARACTER_IMAGES[id] })), ...loadCustomCharacters(), { id:'custom', name:'나만의 선수', sport:'직접 생성' }];
}
