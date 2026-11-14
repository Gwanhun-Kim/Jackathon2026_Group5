// 사진에서 얼굴을 찾아 "얼굴이 가운데, 눈이 수평"인 정사각형 이미지로 잘라낸다.
// MediaPipe FaceDetector (브라우저 안에서 동작, 사진은 밖으로 나가지 않음)를 쓰고,
// 인터넷이 안 되거나 얼굴을 못 찾으면 사진 위쪽 가운데로 대신 자른다.
//
//   const { detectFace, renderFace } = await import("./face-crop.js");
//   const box = await detectFace(img);      // { cx, cy, size, angle, found }
//   const dataUrl = renderFace(img, box, { zoom: 1, shiftY: 0 });

const VISION = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14";
const MODEL = "https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite";

let detectorPromise = null;
function getDetector() {
  if (!detectorPromise) {
    detectorPromise = (async () => {
      const { FaceDetector, FilesetResolver } = await import(`${VISION}/vision_bundle.mjs`);
      const fileset = await FilesetResolver.forVisionTasks(`${VISION}/wasm`);
      return FaceDetector.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: MODEL, delegate: "CPU" },
        runningMode: "IMAGE",
        minDetectionConfidence: 0.4,
      });
    })().catch((e) => { detectorPromise = null; throw e; });
  }
  return detectorPromise;
}

// 얼굴 박스(눈썹~턱)를 기준으로 머리 전체가 들어가게 넓힌 정사각형
const FRAME = { scale: 1.6, up: 0.1 };

export async function detectFace(img) {
  const w = img.naturalWidth || img.width, h = img.naturalHeight || img.height;
  try {
    const det = await getDetector();
    // 아주 큰 사진은 줄여서 인식 (속도), 좌표는 원본 기준으로 되돌림
    const k = Math.min(1, 1024 / Math.max(w, h));
    const cv = document.createElement("canvas");
    cv.width = Math.round(w * k); cv.height = Math.round(h * k);
    cv.getContext("2d").drawImage(img, 0, 0, cv.width, cv.height);
    const res = det.detect(cv);
    const faces = (res.detections || []).filter((d) => d.boundingBox);
    if (faces.length) {
      const best = faces.reduce((a, b) => (b.boundingBox.width * b.boundingBox.height > a.boundingBox.width * a.boundingBox.height ? b : a));
      const bb = best.boundingBox;
      const kp = best.keypoints || [];
      let angle = 0;
      if (kp.length >= 2) {
        // keypoints[0]=오른쪽 눈, [1]=왼쪽 눈 (0~1 정규화 좌표)
        const dx = (kp[1].x - kp[0].x) * cv.width, dy = (kp[1].y - kp[0].y) * cv.height;
        angle = Math.atan2(dy, dx);
        if (Math.abs(angle) > Math.PI / 2) angle += angle > 0 ? -Math.PI : Math.PI;
        if (Math.abs(angle) > 0.5) angle = 0;
      }
      const size = Math.max(bb.width, bb.height) / k;
      return {
        found: true,
        cx: (bb.originX + bb.width / 2) / k,
        cy: (bb.originY + bb.height / 2) / k,
        size,
        angle,
      };
    }
  } catch (e) {
    console.warn("얼굴 인식을 못 해서 기본 자르기를 씁니다:", e && e.message);
  }
  // 대체: 세로 사진은 위쪽 3분의 1, 그 외는 위쪽 가운데
  const portrait = h > w * 1.1;
  return { found: false, cx: w / 2, cy: h * (portrait ? 0.36 : 0.42), size: Math.min(w, h) * (portrait ? 0.4 : 0.48), angle: 0 };
}

// box를 기준으로 256px 정사각형 얼굴 이미지 (투명 배경 PNG는 투명 그대로 유지)
export function renderFace(img, box, adjust = {}) {
  const zoom = adjust.zoom || 1;
  const shiftY = adjust.shiftY || 0;
  const S = 256;
  const side = (box.size * FRAME.scale) / zoom;
  const cx = box.cx;
  const cy = box.cy - box.size * FRAME.up + shiftY * side;
  const c = document.createElement("canvas");
  c.width = c.height = S;
  const g = c.getContext("2d");
  g.imageSmoothingQuality = "high";
  g.translate(S / 2, S / 2);
  g.rotate(-box.angle);
  g.scale(S / side, S / side);
  g.drawImage(img, -cx, -cy);
  // 알파가 있는지 확인해서 형식 결정 (투명 -> webp/png, 불투명 -> jpeg)
  const px = g.getImageData(0, 0, S, S).data;
  let transparent = false;
  for (let i = 3; i < px.length; i += 4 * 7) if (px[i] < 250) { transparent = true; break; }
  if (!transparent) return c.toDataURL("image/jpeg", 0.9);
  const webp = c.toDataURL("image/webp", 0.9);
  return webp.startsWith("data:image/webp") ? webp : c.toDataURL("image/png");
}
