export type Locale = 'zh-CN' | 'en';
const en = {
  title:'Beyond the Light Cone',subtitle:'Everything seen is the past.',foundation:'M1 · FOUNDATION PREVIEW',
  bubble:'Network map',celestial:'Celestial',language:'Language',time:'SIM TIME',radius:'CRADLE SPAN',target:'SYNC SPAN',
  confirmed:'Confirmed',reachable:'Reachable',persist:'Persist',expand:'Dispatch → B · 4.00 LY',committed:'Expedition dispatched',
  replay:'Replay',play:'Play',pause:'Pause',speed:'Playback speed',seek:'Timeline position',scenario:'Scenario',
  success:'Receipt arrives',noAck:'Missing receipt',offline:'Local replay',online:'Development server',
  catalog:'Public catalog',pending:'Pending',timeout:'Timed out · unconfirmed',controlled:'Confirmed',lost:'Link lost',destroyed:'Ruins',
  select:'Select a star',details:'Observation record',close:'Close',sampled:'Sampled',arrived:'Arrived',age:'Report age',
  unknown:'No received report',pendingHint:'Awaiting evidence. Local access is not yet confirmed.',
  timeoutHint:'The waiting window ended. Late valid receipts can still be accepted.',
  confirmedHint:'A receipt has reached the command core.',catalogHint:'Catalog position is public. Ownership requires a received report.',
  loading:'Loading the observation timeline…',missing:'Timeline unavailable. Generate M1 fixtures with pnpm sim:m1, then reload.',
  webgl:'WebGL2 unavailable. Telemetry and timeline controls remain available.',zoomIn:'Zoom in',zoomOut:'Zoom out',
  mapHint:'Drag to orbit · pinch or scroll to zoom',skyHint:'Drag to look around · catalog directions only',
  timeline:'Playback instrument',scale:'1 real min = 1 sim yr',disclaimer:'Recorded seat projections · playback speed changes only this demonstration.',
  connection:'Development connection',token:'Development token',connect:'Connect',disconnect:'Return to replay',connecting:'Connecting…',
  connected:'Connected to the development fixture.',connectionHint:'Token stays in memory. Local fixture only; production login is not enabled.',
  requestFailed:'Request failed',apiOnly:'Server time advances at the fixed rate. Playback controls apply to the local replay.',
  ready:'Ready to dispatch an expedition.',report:'Receipt',unitYear:'SIM YR',started:'Expedition plan active.',
  flights:'In flight',autonomous:'Autonomous',seceded:'Seceded',detached_autonomous:'Detached · autonomous',
  autonomousHint:'The latest report records an autonomous node outside active synchronization.',lostHint:'The latest report records a lost link. Physical destruction is not inferred.',destroyedHint:'The received report records this node as destroyed.',secededHint:'The received report records this node as no longer controlled.',
} as const;
type Key = keyof typeof en;
const zh:Record<Key,string> = {
  title:'光锥之外',subtitle:'所见皆往昔。',foundation:'M1 · 框架预览',bubble:'节点网络',celestial:'天球仪',language:'语言',
  time:'天时',radius:'摇篮尺度',target:'同步跨度',confirmed:'已确认',reachable:'可达',persist:'冗余',expand:'派出远征 → B · 4.00 LY',committed:'远征已派出',
  replay:'重播',play:'播放',pause:'暂停',speed:'播放速度',seek:'时间线位置',scenario:'演示场景',success:'回执抵达',noAck:'回执缺失',offline:'本地回放',online:'开发服务',
  catalog:'公开星表',pending:'待确认',timeout:'超时 · 结果未确认',controlled:'已确认',lost:'失联',destroyed:'损毁遗迹',select:'选择恒星',details:'观测记录',close:'关闭',
  sampled:'采样',arrived:'抵达',age:'情报年龄',unknown:'尚未收到报告',pendingHint:'等待证据，尚未确认当地接入结果。',timeoutHint:'等待窗口已结束，合法的迟到回执仍会被受理。',
  confirmedHint:'接入回执已抵达指挥核。',catalogHint:'位置来自公开星表，归属须由收到的报告确认。',loading:'正在载入观测时间线…',
  missing:'时间线不可用。请先运行 pnpm sim:m1 生成夹具，再刷新页面。',webgl:'WebGL2 暂不可用，遥测与时间线控件仍可使用。',zoomIn:'放大',zoomOut:'缩小',
  mapHint:'拖动旋转 · 捏合或滚轮缩放',skyHint:'拖动查看方向 · 仅显示星表方向',timeline:'回放仪器',scale:'1 现实分钟 = 1 模拟年',disclaimer:'已记录的席位投影 · 倍速仅改变本次演示播放速度。',
  connection:'开发服务连接',token:'开发令牌',connect:'连接',disconnect:'返回本地回放',connecting:'正在连接…',connected:'已连接开发席位夹具。',
  connectionHint:'令牌仅保存在内存中。当前为本地夹具，正式登录尚未启用。',requestFailed:'请求失败',apiOnly:'服务端以固定倍率演进，播放控件仅用于本地回放。',
  ready:'可以向候选恒星派出远征。',report:'回执',unitYear:'SIM YR',started:'远征计划已生效。',
  flights:'在途远征',autonomous:'自治节点',seceded:'已脱离',detached_autonomous:'断联 · 自治',
  autonomousHint:'最新报告确认该节点独立自治，未参与当前同步。',lostHint:'最新报告记录链路失联，不据此推断节点损毁。',destroyedHint:'已抵达报告确认该节点损毁。',secededHint:'已抵达报告确认该节点已脱离控制。',
};
export function translate(locale:Locale,key:Key):string{return (locale==='zh-CN'?zh:en)[key];}
export function detectLocale():Locale {
  try {const saved=localStorage.getItem('stars.locale');if(saved==='en'||saved==='zh-CN')return saved;}catch{/* Storage can be disabled. */}
  return navigator.languages.some(l=>l.toLowerCase().startsWith('zh'))?'zh-CN':'en';
}
export function saveLocale(locale:Locale):void{try{localStorage.setItem('stars.locale',locale);}catch{/* Session choice still applies. */}}
export type TranslationKey = Key;
