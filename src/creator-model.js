export const BODY_LIMITS = { heightCm:{min:140,max:230,default:180,step:1}, weightKg:{min:40,max:180,default:80,step:0.1} };
export const PHOTO_RULES = { maxBytes:10*1024*1024, types:['image/jpeg','image/png','image/webp'] };
export const STAT_KEYS=['stamina','power','attackSpeed','toughness','moveSpeed','reach','defense'];
export function newDraft(){return {name:'나만의 선수',physicalStats:Object.fromEntries(Object.entries(BODY_LIMITS).map(([key,rule])=>[key,rule.default])),stats:Object.fromEntries(STAT_KEYS.map(k=>[k,5])),file:null,image:null,url:null,faceMode:'default',crop:{x:0,y:0,width:1,height:1},zoom:1,position:{x:50,y:50},error:'',busy:false,loading:false};}
export function cropFor(width,height,zoom,x,y){const side=Math.min(width,height)/zoom;return {x:(width-side)*x/100/width,y:(height-side)*y/100/height,width:side/width,height:side/height};}
export function validatePhoto(file){if(!PHOTO_RULES.types.includes(file.type))throw new Error('JPG, PNG, WebP 사진을 선택해 주세요.');if(!file.size||file.size>PHOTO_RULES.maxBytes)throw new Error('사진은 0바이트 초과, 10MB 이하로 선택해 주세요.');}
export function characterPayload(d){
 const name=d.name.trim();if(!name||name.length>30)throw new Error('이름은 1~30자로 입력해 주세요.');
 for(const [key,rule]of Object.entries(BODY_LIMITS)){const n=d.physicalStats[key];if(!Number.isFinite(n)||n<rule.min||n>rule.max)throw new Error('신체 수치의 허용 범위를 확인해 주세요.');}
 for(const key of STAT_KEYS)if(!Number.isInteger(d.stats[key])||d.stats[key]<1||d.stats[key]>10)throw new Error('능력치는 1~10 정수로 입력해 주세요.');
 const uploaded=d.faceMode==='uploaded';if(uploaded&&!d.file)throw new Error('얼굴 사진을 다시 선택해 주세요.');
 if(uploaded){const c=d.crop;if(!c||Object.values(c).some(n=>!Number.isFinite(n))||c.x<0||c.y<0||c.width<=0||c.height<=0||c.x+c.width>1.000001||c.y+c.height>1.000001)throw new Error('얼굴 영역을 확인해 주세요.');}
 return {name,face:{mode:uploaded?'uploaded':'default',crop:uploaded?{...d.crop}:null},physicalStats:{...d.physicalStats},stats:{...d.stats}};
}
