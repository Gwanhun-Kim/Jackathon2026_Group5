// 선택 화면 → 경기 화면(fight/) 연결, 직접 만든 선수 저장
// 경기 화면은 localStorage 'fightData' = { fighters: [내 선수, 상대] } 를 읽어 싸운다 (fight/index.html loadFightData)

const FACE_DIR = '/character/images/faces/';
const PRESET_IDS = ['ohtani', 'ngannou', 'son', 'kim', 'ha', 'park'];
const CUSTOM_KEY = 'customCharacters';

// 키·몸무게 → 경기 화면 체격 (몸 폭)
function buildOf(heightCm, weightKg) {
  if (!heightCm || !weightKg) return 'normal';
  const bmi = weightKg / (heightCm / 100) ** 2;
  return bmi < 20 ? 'slim' : bmi < 25 ? 'normal' : bmi < 29 ? 'muscle' : 'chubby';
}

/** 선택 화면의 선수 → 경기 화면이 읽는 형식 (stats + specialAbility + appearance) */
export function toFightCharacter(c) {
  const ps = c.physicalStats || {};
  const face = c.faceImage || c.appearance?.face || (PRESET_IDS.includes(c.id) ? `${FACE_DIR}${c.id}.png` : null);
  return {
    id: c.id,
    name: c.name,
    stats: c.stats,
    ...(c.specialAbility?.id ? { specialAbility: c.specialAbility } : {}),
    appearance: {
      ...(c.appearance || {}),
      ...(face ? { face } : {}),
      heightCm: ps.heightCm,
      weightKg: ps.weightKg,
      build: buildOf(ps.heightCm, ps.weightKg),
    },
  };
}

/** 두 선수를 저장하고 경기 화면으로 이동 */
export function startFight(player, opponent) {
  const data = { fighters: [toFightCharacter(player), toFightCharacter(opponent)], createdAt: Date.now() };
  try {
    localStorage.setItem('fightData', JSON.stringify(data));
  } catch {
    throw new Error('브라우저 저장 공간을 쓸 수 없어 경기를 시작하지 못했습니다. 시크릿 창이라면 일반 창에서 열어 주세요.');
  }
  location.href = './fight/index.html?auto';
}

// ---------- 직접 만든 선수 저장 (이 브라우저에만) ----------
export function loadCustomCharacters() {
  try {
    const list = JSON.parse(localStorage.getItem(CUSTOM_KEY) || '[]');
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

/** 저장 실패(용량 초과 등)해도 이번 화면에서는 계속 쓸 수 있다. 저장 여부를 돌려준다 */
export function saveCustomCharacter(character) {
  const list = loadCustomCharacters().filter((c) => c.id !== character.id);
  list.push(character);
  try {
    localStorage.setItem(CUSTOM_KEY, JSON.stringify(list));
    return true;
  } catch {
    return false;
  }
}

export function deleteCustomCharacter(id) {
  try {
    localStorage.setItem(CUSTOM_KEY, JSON.stringify(loadCustomCharacters().filter((c) => c.id !== id)));
  } catch { /* 저장소를 못 쓰면 화면 목록에서만 지운다 */ }
}

/** 업로드한 사진의 얼굴 영역(crop, 0~1 비율)을 256×256 JPEG data URL로 */
export function faceDataUrl(image, crop, size = 256) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const w = image.naturalWidth, h = image.naturalHeight;
  canvas.getContext('2d').drawImage(image, crop.x * w, crop.y * h, crop.width * w, crop.height * h, 0, 0, size, size);
  return canvas.toDataURL('image/jpeg', 0.88);
}
