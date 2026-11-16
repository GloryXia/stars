/* 《光锥之外》官网双语词典（zh-CN / en · 首页聚焦银河文明模拟，机制归入独立游玩说明） */
(function (global) {
  const dict = {
    'zh-CN': {
      'site.title': '光锥之外 · Beyond the Light Cone',
      'brand.title': '光锥之外',
      'brand.sub': 'BEYOND THE LIGHT CONE',

      'nav.features': '游戏特色',
      'nav.cosmos': '银河模拟',
      'nav.guide': '游玩说明',
      'nav.home': '首页',
      'nav.play': '进入游戏',
      'nav.download': '下载应用',
      'nav.login': '登录',
      'nav.register': '注册',

      /* Homepage Hero */
      'hero.eyebrow': '银河系尺度 · 文明演化模拟',
      'hero.title': '所见皆往昔，\n在真实银河里演化文明。',
      'hero.subtitle': '从一颗行星出发，在 1 分钟等于 1 年的时间尺度里探索、远征，等待跨越光年的星光抵达。',
      'hero.cta.play': '进入游戏',
      'hero.cta.download': '下载应用（iOS / 安卓）',
      'hero.cta.login': '登录',
      'hero.cta.register': '注册',
      'hero.puresky': '纯享星空',
      'hero.puresky.exit': '显示文字',
      'hero.simLabel': '游戏时间',
      'hero.rateLabel': '时间尺标',
      'hero.rateValue': '1 分钟 = 1 年',

      'stat.1.num': '银河系尺度',
      'stat.1.unit': '约 10 万光年',
      'stat.1.label': '同一世界长期运行，不强制删档重置',
      'stat.2.num': '万人',
      'stat.2.unit': '同图',
      'stat.2.label': '玩家与生态文明异步发展，各自留存历史',
      'stat.3.num': '1 分钟',
      'stat.3.unit': '= 1 年',
      'stat.3.label': '星光与航程遵循真实距离，匀速推进',

      /* Homepage Section 1: Galactic Simulation */
      'cosmos.eyebrow': '01 · 宇宙文明模拟',
      'cosmos.title': '同一座银河系，按现实物理运行',
      'cosmos.lead': '没有固定剧本。所有文明在同一套物理法则下从母星起步。',

      'cosmos.c1.tag': '真实尺度',
      'cosmos.c1.t': '按人类历史的跨度生长',
      'cosmos.c1.d': '从单行星摇篮起步，历经几个世纪积累迈向多行星与跨星远征，每一步都贴合现实文明的体量。',

      'cosmos.c2.tag': '光速因果',
      'cosmos.c2.t': '光速决定你能看见什么',
      'cosmos.c2.d': '没有全图透视。无论舰队还是远方星光，都必须跨越真实的星际距离才能抵达。',

      'cosmos.c3.tag': '长期留存',
      'cosmos.c3.t': '发展与遗迹留在世界里',
      'cosmos.c3.d': '无论文明延续还是毁灭，建成的信标、废墟与已发出的信号都会继续留在银河系中等待后人发现。',

      /* Homepage Section 2: Game Features */
      'feat.eyebrow': '02 · 游戏特色',
      'feat.title': '真实尺度下的星际博弈',
      'feat.lead': '围绕观测、信号与长期演化构建的慢节奏策略体验。',

      'feat.f1.t': '双视角星际观测',
      'feat.f1.d': '在环顾全天的「夜空视角」与俯瞰星系脉络的「三维星图」之间切换，从微弱线索一步步锁定坐标。',
      'feat.f2.t': '暴露与隐匿的博弈',
      'feat.f2.d': '扩张与高耗能活动会让信号传播得更远，而收敛隐匿也会付出代价——何时发光由你决定。',
      'feat.f3.t': '不强制盯屏的长期演化',
      'feat.f3.d': '宇宙时间恒定匀速推进，支持全速离线发展；提前编排发展计划与自动防御规则，从容跨天体演进。',
      'feat.f4.t': '人机同律的真实法则',
      'feat.f4.d': '没有付费免死护盾。天灾与内部过载对所有人一视同仁；文明覆灭后可在银河系另择恒星重新开始。',

      /* Homepage Guide Callout */
      'guideCta.eyebrow': 'GAMEPLAY MANUAL · 游玩指南',
      'guideCta.title': '想了解具体怎么玩？',
      'guideCta.desc': '观测步骤、信号传播、离线托管与“光信”机制，已整理在独立的游玩说明文档中。',
      'guideCta.btn': '查看游玩说明 →',

      /* Homepage Entry Portals */
      'portal.eyebrow': '立即开始',
      'portal.title': '进入《光锥之外》',
      'portal.desc': '电脑和手机打开网页就能玩，iOS 与安卓应用也在准备中。',
      'portal.btn.play': '进入游戏',
      'portal.btn.download': '下载应用（iOS / 安卓）',
      'portal.btn.login': '登录',
      'portal.btn.register': '注册',

      /* Footer */
      'footer.desc': '银河系尺度文明演化模拟 · 1 分钟 = 1 年。',
      'footer.col1': '常用入口',
      'footer.col2': '了解游戏',
      'footer.col3': '支持平台',
      'footer.l.web': '电脑 / 手机网页版（免安装）',
      'footer.l.ios': 'iOS 应用（即将推出）',
      'footer.l.android': '安卓应用（即将推出）',
      'footer.copy': '© 2026 光锥之外 · Beyond the Light Cone',

      /* Dedicated Guide Page (/guide/) */
      'guide.crumb': '游玩说明',
      'guide.eyebrow': 'GAMEPLAY GUIDE · 机制与游玩说明',
      'guide.title': '如何观测并带领你的文明',
      'guide.lead': '这里汇集了《光锥之外》的核心游玩机制：从看懂延迟的星空，到睡前设置离线守护与查收光信。',

      'world.eyebrow': '01 · 看懂延迟的星空',
      'world.title': '从模糊感应到算清位置',
      'world.lead': '你看到的每一颗星都是它的过去。未知目标会随着收集到的线索一步步清晰：',
      'obs.tab1': '① 模糊感应',
      'obs.tab2': '② 锁定方向',
      'obs.tab3': '③ 算清位置',
      'obs.view.bubble': '星图',
      'obs.view.celestial': '夜空',
      'obs.s1.log': '西北方向似乎有微弱动静，还看不清有多远。',
      'obs.s1.meta': '只能观望 · 无法确认目标',
      'obs.s2.log': '已经看清信号来自哪个方向，但距离依然未知。',
      'obs.s2.meta': '朝向确定 · 还需更多线索测距',
      'obs.s3.log': '多颗恒星联合观测，终于算清位置：约 20.3 光年外。',
      'obs.s3.meta': '位置已确认 · 可以规划行动',
      'world.p1.t': '舰队赶路与回信延迟',
      'world.p1.d': '向 4 光年外的邻星派出远征舰队，飞船需要飞 40 分钟；抵达建成后，确认回信还需要 4 分钟才能飞回指挥中心。',
      'world.p2.t': '外围星系断联自治',
      'world.p2.d': '当星系分布太广导致同步负担过大时，可暂时让外围星系独立运转而不必销毁，日后随时发送光速握手信号重新并网。',

      'sig.eyebrow': '02 · 三种宇宙信号',
      'sig.title': '发光就会被看见，沉默也有代价',
      'sig.lead': '文明的活动会化作向外扩张的信号波纹，不同通道有着截然不同的穿透力与探测范围：',
      'sig.c1.tag': '电磁波 · 热与光',
      'sig.c1.t': '关灯也收不回过去的光',
      'sig.c1.d': '推进尾焰与废热会持续向外扩散，直到淡入背景噪声。即使现在开启隐匿，之前飞出的光依然会形成“空心光壳”继续远去。',
      'sig.c2.tag': '中微子 · 穿透迷雾',
      'sig.c2.t': '高能动静藏不住线索',
      'sig.c2.d': '高能聚变引擎泄出的微弱迹象能穿透尘埃与伪装，帮你察觉潜伏在亮星附近的目标，但只能给出粗略方向。',
      'sig.c3.tag': '引力波 · 长期探测',
      'sig.c3.t': '大型建筑的跨星涟漪',
      'sig.c3.d': '大型奇观与终极信标会产生无法屏蔽的时空涟漪；当你在至少 3 颗不共线的恒星上同步观测，就能跨过数千光年精确定位。',

      'off.eyebrow': '03 · 离线托管与自动守护',
      'off.title': '睡前排好计划，关掉页面照常演进',
      'off.lead': '游戏时间永远以 1 分钟 = 1 年平稳流淌。离开前编排好发展队列与自动守护规则，就能安心挂机：',
      'off.l1.title': '3 条自动守护规则（可切换模式）',
      'off.l1.desc': '提前配好触发条件与本地应急动作，在离线或值守时自动保护文明：',
      'off.l1.mode.offline': '仅离线生效',
      'off.l1.mode.always': '全天守护',
      'off.r1': '发现小行星撞击预警 → 自动偏转拦截',
      'off.r2': '散热储备快满了 → 自动开启散热',
      'off.r3': '协同压力过高 → 暂时断开外围星系',

      'pm.tag': '04 · 光信档案（来自过去的信）',
      'pm.status': '已送达',
      'pm.k1': '目标距离',
      'pm.v1': '4.00 光年',
      'pm.k2': '信号耗时',
      'pm.v2': '4 分钟',
      'pm.k3': '发出时间',
      'pm.v3': '第 40.0 年',
      'pm.k4': '收到时间',
      'pm.v4': '第 44.0 年',
      'pm.seal': '延迟 4 年\n确认送达',
      'pm.quote': '“你现在看到的 B 星，是它 4 年前的样子。”',

      'filter.title': '05 · 大过滤器、灭亡简报与重开',
      'filter.desc': '没有付费免死护盾。天灾（小行星、超新星等）与内部过载危机对玩家与 AI 一视同仁。若文明毁灭，原地会留下物理废墟与信标；查收一份灭亡简报后，即可在银河系另选恒星重新开始。',

      /* Login Page */
      'login.crumb': '登录',
      'login.eyebrow': '账号登录 · 预留页面',
      'login.title': '登录你的观星账号',
      'login.lead': '网页版、iOS 和安卓将共用同一个账号。目前为官网预留入口，正式服上线后开放登录。',
      'login.google': '使用 Google 账号登录',
      'login.apple': '使用 Apple 账号登录',
      'login.reservedTag': '即将开放',
      'login.divider': '或使用邮箱密码登录',
      'login.email': '邮箱',
      'login.email.ph': 'name@example.com',
      'login.pass': '密码',
      'login.pass.ph': '请输入密码',
      'login.remember': '记住登录状态',
      'login.submit': '登录（预留入口）',
      'login.status.idle': '当前为预留登录页，正式账号服务将在在线服阶段接入。',
      'login.status.oauth': '已点击 {provider} 登录入口（预留接口，正式服上线后跳转授权）。',
      'login.status.form': '已验证输入格式（{email}）。当前未连接正式账号服，可先前往“进入游戏”体验试玩版。',
      'login.status.invalid': '请先填写正确的邮箱和密码。',
      'login.side.title': '关于账号与进度',
      'login.side.p1': '你的文明进度、离线规则与未读光信都会保存在云端，换设备登录也能无缝接着看。',
      'login.side.p2': '如果离线期间文明遭遇天灾或危机而灭亡，重新登录时会收到一份简洁的灭亡简报，之后可以直接重开。',
      'login.side.noAccount': '还没有账号？',
      'login.side.toReg': '去注册新账号',
      'login.side.toPlay': '免登录 · 先去试玩当前版本',

      /* Register Page */
      'reg.crumb': '注册',
      'reg.eyebrow': '新玩家注册 · 预留页面',
      'reg.title': '注册账号，挑选一颗摇篮恒星',
      'reg.lead': '银河永远不会删档。完成注册后，你的文明会从一颗刚起步的星球慢慢成长。',
      'reg.oauth.title': '快捷绑定注册（即将开放）',
      'reg.callsign': '文明名称 / 代号',
      'reg.callsign.ph': '例如：猎户座四号观测站',
      'reg.email': '常用邮箱',
      'reg.pass': '设置密码',
      'reg.zone.label': '想出生在银河的哪里',
      'reg.zone.arm': '旋臂热闹星区（推荐）',
      'reg.zone.arm.d': '周围几百光年外会有其他文明，前期安静发育，中后期会逐渐收到远方信号。',
      'reg.zone.halo': '边缘极静星域',
      'reg.zone.halo.d': '邻居极少、格外清净，适合喜欢独自探索、慢慢研究古老遗迹的玩家。',
      'reg.agree': '我已了解游戏规则：全服时间同步、离线照常运行、没有氪金特权。',
      'reg.submit': '注册并创建文明（预留入口）',
      'reg.status.idle': '当前为预留注册页，正式开服后开放创建。',
      'reg.status.ok': '信息填写完整：文明 [{callsign}] · 区域 [{zone}]。注册接口已预留，开服后即可进入游戏。',
      'reg.status.err': '请填写文明名称、正确邮箱、不少于 8 位的密码，并勾选确认规则。',
      'reg.side.title': '开局说明',
      'reg.side.k1': '起步阶段',
      'reg.side.v1': '从一颗单行星开始慢慢发展',
      'reg.side.k2': '时间流速',
      'reg.side.v2': '全服统一 1 分钟 = 1 年',
      'reg.side.k3': '游戏节奏',
      'reg.side.v3': '不催促、离线照常成长',
      'reg.side.k4': '多端同步',
      'reg.side.v4': '网页 / iOS / 安卓互通',
      'reg.side.toLogin': '已经有账号了？去登录',

      /* Play Page */
      'play.crumb': '进入游戏',
      'play.eyebrow': '游戏入口 · /play/',
      'play.title': '进入《光锥之外》',
      'play.lead': '不需要下载大安装包，用浏览器就能直接进入星空。你可以等待正式在线服，也可以立刻启动当前预览版。',
      'play.online.badge': '即将开放',
      'play.online.title': '多人在线银河服务器',
      'play.online.desc': '与上万名玩家和 AI 文明共同生活在同一个 10 万光年银河中，需要登录账号接入。',
      'play.online.btn1': '去登录账号',
      'play.online.btn2': '检查服务器状态',
      'play.online.status.idle': '当前在线大区尚未开启（已预留连接入口）。',
      'play.online.status.checked': '在线大区正在筹备中。你可以先启动右侧的“当前预览版”体验星图操作和 4 光年远征。',

      'play.local.badge': '现在可玩 · 预览版',
      'play.local.title': '启动网页预览版',
      'play.local.desc': '体验 3D 星图与夜空双视角切换，以及向 4 光年外恒星派出远征舰队。',
      'play.local.urlLabel': '预览版访问地址',
      'play.local.presetDev': '本地开发地址 (:5178)',
      'play.local.presetDist': '静态构建目录',
      'play.local.launch': '立即打开游戏 ↗',
      'play.local.cmdTitle': '如果你在本地运行代码，可在终端输入：',

      'play.diag.title': '你的设备兼容性检测',
      'play.diag.desc': '看看当前浏览器是否已经准备好运行 3D 星空：',
      'play.diag.webgl2': '3D 星空渲染 (WebGL2)',
      'play.diag.audio': '天文台环境音效',
      'play.diag.idb': '本地数据缓存',
      'play.diag.viewport': '当前屏幕尺寸',
      'play.diag.ok': '支持',
      'play.diag.no': '不支持',

      /* Download Page */
      'dl.crumb': '下载应用',
      'dl.eyebrow': '客户端下载 · /download/',
      'dl.title': '下载《光锥之外》手机客户端',
      'dl.lead': '手机和电脑用浏览器都能直接玩；我们也预留了 iOS 和安卓独立 App，账号和进度完全同步。',
      'dl.webBanner.t': '不想下载 App？手机浏览器打开网页也能直接玩',
      'dl.webBanner.b': '去进入游戏',

      'dl.ios.tag': '即将上架',
      'dl.ios.title': 'iPhone / iPad 版',
      'dl.ios.desc': '针对苹果屏幕与系统震动专门优化，支持 Apple 账号和 Google 账号一键登录。',
      'dl.ios.btnStore': '前往 App Store（预留）',
      'dl.ios.btnTf': 'TestFlight 测试版（预留）',
      'dl.ios.qrTitle': '苹果端扫码下载',
      'dl.ios.qrDesc': '正式上架后，用 iPhone 相机扫码即可直接下载安装。',
      'dl.ios.sys': '系统要求',
      'dl.ios.sysV': 'iOS 16.0 及以上',
      'dl.ios.ver': '当前状态',
      'dl.ios.verV': '打包测试准备中',
      'dl.ios.auth': '登录方式',
      'dl.ios.authV': 'Apple / Google 账号',

      'dl.and.tag': '即将上架',
      'dl.and.title': '安卓手机 / 平板版',
      'dl.and.desc': '兼容主流安卓机型，提供商店下载与官方签名安装包两种方式。',
      'dl.and.btnPlay': '前往 Google Play（预留）',
      'dl.and.btnApk': '下载官方 APK（预留）',
      'dl.and.qrTitle': '安卓端扫码下载',
      'dl.and.qrDesc': '正式发布后将在这里提供安全的官方安装链接与扫码下载。',
      'dl.and.sys': '系统要求',
      'dl.and.sysV': 'Android 10 及以上',
      'dl.and.arch': '支持机型',
      'dl.and.archV': '主流 64 位安卓设备',
      'dl.and.sha': '安全校验',
      'dl.and.shaV': '正式发版时提供官方签名',

      'dl.status.idle': 'App 版本正在筹备封装，以下按钮已为你预留跳转位置。',
      'dl.status.clicked': '已点击下载入口（{channel}）。App 仍在筹备上线，你可以先点上方按钮在浏览器里直接游玩。',

      'dl.matrix.title': '各版本对比',
      'dl.matrix.th1': '版本',
      'dl.matrix.th2': '进度情况',
      'dl.matrix.th3': '账号互通',
      'dl.matrix.th4': '特点',
      'dl.matrix.r1.c1': '网页版（电脑 / 手机）',
      'dl.matrix.r1.c2': '现已提供预览',
      'dl.matrix.r1.c3': '全端同步',
      'dl.matrix.r1.c4': '不用安装、打开即玩、更新最快',
      'dl.matrix.r2.c1': 'iOS 客户端',
      'dl.matrix.r2.c2': '即将推出',
      'dl.matrix.r2.c3': '全端同步',
      'dl.matrix.r2.c4': '支持震动反馈与全面屏适配',
      'dl.matrix.r3.c1': '安卓客户端',
      'dl.matrix.r3.c2': '即将推出',
      'dl.matrix.r3.c3': '全端同步',
      'dl.matrix.r3.c4': '提供商店版与官方直装安装包',

      /* 404 Page */
      '404.eyebrow': '404 · 页面不存在',
      '404.title': '找不到这个页面',
      '404.desc': '请点击下方按钮回到官网常用页面。'
    },

    'en': {
      'site.title': 'Beyond the Light Cone',
      'brand.title': 'BEYOND THE LIGHT CONE',
      'brand.sub': 'EVERYTHING SEEN IS THE PAST',

      'nav.features': 'Features',
      'nav.cosmos': 'Simulation',
      'nav.guide': 'Guide',
      'nav.home': 'Home',
      'nav.play': 'Play',
      'nav.download': 'Download',
      'nav.login': 'Sign In',
      'nav.register': 'Register',

      /* Homepage Hero */
      'hero.eyebrow': 'GALACTIC SCALE · CIVILIZATION SIMULATOR',
      'hero.title': 'Everything seen is the past.\nEvolve across a real galaxy.',
      'hero.subtitle': 'Start from a single planet. Explore and expand across galactic distances at one year per minute, waiting for distant light to arrive.',
      'hero.cta.play': 'Enter Game',
      'hero.cta.download': 'Download (iOS / Android)',
      'hero.cta.login': 'Sign In',
      'hero.cta.register': 'Register',
      'hero.puresky': 'Sky Only',
      'hero.puresky.exit': 'Show Text',
      'hero.simLabel': 'SIM TIME',
      'hero.rateLabel': 'PACE',
      'hero.rateValue': '1 MIN = 1 YEAR',

      'stat.1.num': 'Galactic Scale',
      'stat.1.unit': '~100,000 ly',
      'stat.1.label': 'One shared world running continuously without forced wipes',
      'stat.2.num': '10,000+',
      'stat.2.unit': 'Seats',
      'stat.2.label': 'Human & AI civilizations evolving asynchronously',
      'stat.3.num': '1 Min',
      'stat.3.unit': '= 1 Year',
      'stat.3.label': 'Steady astronomical pacing across real distances',

      /* Homepage Section 1: Galactic Simulation */
      'cosmos.eyebrow': '01 · GALACTIC SIMULATION',
      'cosmos.title': 'One galaxy governed by consistent physics',
      'cosmos.lead': 'No scripted stories. Every civilization begins from one home planet under shared physical laws.',

      'cosmos.c1.tag': 'REAL SCALE',
      'cosmos.c1.t': 'Grow across human timescales',
      'cosmos.c1.d': 'Start from one cradle planet, expand across your home system, and launch expeditions toward neighboring stars over real hours and days.',

      'cosmos.c2.tag': 'LIGHT SPEED',
      'cosmos.c2.t': 'Light sets what you can know',
      'cosmos.c2.d': 'No instant map of the galaxy. Every starlight flash, probe, and signal takes years to cross the void before reaching you.',

      'cosmos.c3.tag': 'LONG-TERM STATE',
      'cosmos.c3.t': 'Development and ruins stay in the world',
      'cosmos.c3.d': 'Whether a civilization endures or falls, its beacons, ruins, and emitted signals remain in the galaxy for others to encounter.',

      /* Homepage Section 2: Game Features */
      'feat.eyebrow': '02 · KEY FEATURES',
      'feat.title': 'Interstellar strategy on real scales',
      'feat.lead': 'A slow-paced strategic simulation built around observation, visibility, and long-horizon growth.',

      'feat.f1.t': 'Dual Cosmic Perspectives',
      'feat.f1.d': 'Switch between a full-sky view and a 3D star map, sharpening blurry distant signals into confirmed coordinates.',
      'feat.f2.t': 'Light & Stealth Dilemmas',
      'feat.f2.d': 'Rapid growth radiates farther across space, while hiding carries real cost—choose when to illuminate or go silent.',
      'feat.f3.t': 'Full-Speed Evolution Without Grind',
      'feat.f3.d': 'Time advances steadily at one pace. Plan queues and automated defenses ahead so your civilization evolves even while away.',
      'feat.f4.t': 'Equal Rules, Unscripted Fate',
      'feat.f4.d': 'No pay-to-win shields. Natural hazards and internal crises treat human and AI seats alike—and fallen players can restart anytime.',

      /* Homepage Guide Callout */
      'guideCta.eyebrow': 'GAMEPLAY MANUAL',
      'guideCta.title': 'Curious how observation, offline rules, and light-mail work?',
      'guideCta.desc': 'Explore the dedicated Gameplay Guide for interactive sighting steps, signal types, offline safeguards, and postmarks.',
      'guideCta.btn': 'Read Gameplay Guide →',

      /* Homepage Entry Portals */
      'portal.eyebrow': 'GET STARTED',
      'portal.title': 'Enter Beyond the Light Cone',
      'portal.desc': 'Play straight in your browser on desktop or phone. Native iOS and Android apps are on the way.',
      'portal.btn.play': 'Enter Game',
      'portal.btn.download': 'Download (iOS / Android)',
      'portal.btn.login': 'Sign In',
      'portal.btn.register': 'Register',

      /* Footer */
      'footer.desc': 'Galactic-scale civilization simulation · 1 min = 1 year.',
      'footer.col1': 'Portals',
      'footer.col2': 'Explore',
      'footer.col3': 'Platforms',
      'footer.l.web': 'Web Browser (Zero Install)',
      'footer.l.ios': 'iOS App (Coming Soon)',
      'footer.l.android': 'Android App (Coming Soon)',
      'footer.copy': '© 2026 Beyond the Light Cone',

      /* Dedicated Guide Page (/guide/) */
      'guide.crumb': 'Gameplay Guide',
      'guide.eyebrow': 'GAMEPLAY GUIDE · MECHANICS',
      'guide.title': 'How to Observe and Guide Your Civilization',
      'guide.lead': 'A practical walkthrough of delayed sight, cosmic signals, offline safeguards, and light-letters.',

      'world.eyebrow': '01 · DELAYED LIGHT',
      'world.title': 'From a faint glow to a confirmed location',
      'world.lead': 'Everything you see arrives from the past. Unknown targets sharpen only as more clues arrive:',
      'obs.tab1': '① Faint Glow',
      'obs.tab2': '② Direction Found',
      'obs.tab3': '③ Exact Location',
      'obs.view.bubble': 'Star Map',
      'obs.view.celestial': 'Night Sky',
      'obs.s1.log': 'Faint activity spotted to the northwest. Distance is still unknown.',
      'obs.s1.meta': 'Watch only · too blurry to target',
      'obs.s2.log': 'Direction locked, though we still do not know how far away it is.',
      'obs.s2.meta': 'Bearing known · needs ranging clues',
      'obs.s3.log': 'Triangulated across multiple stars: roughly 20.3 light-years away.',
      'obs.s3.meta': 'Position confirmed · ready for action',
      'world.p1.t': 'Fleet travel & receipt lag',
      'world.p1.d': 'Sending an expedition 4 light-years away takes 40 minutes to arrive, plus 4 more minutes for confirmation to fly back.',
      'world.p2.t': 'Autonomous outer stars',
      'world.p2.d': 'When faraway colonies strain coordination, switch them to independent standby instead of losing them, and reconnect later.',

      'sig.eyebrow': '02 · THREE COSMIC SIGNALS',
      'sig.title': 'Visibility and stealth across the void',
      'sig.lead': 'Every activity sends ripples outward through distinct channels:',
      'sig.c1.tag': 'ELECTROMAGNETIC',
      'sig.c1.t': 'Past light cannot be erased',
      'sig.c1.d': 'Heat and broadcasts expand outward until fading into noise. Going silent today leaves yesterday’s light traveling as a hollow shell.',
      'sig.c2.tag': 'NEUTRINOS',
      'sig.c2.t': 'Clues pierce dust & stealth',
      'sig.c2.d': 'High-energy engines leak subtle traces past thermal disguise, revealing a rough direction without exact range.',
      'sig.c3.tag': 'GRAVITATIONAL WAVES',
      'sig.c3.t': 'Echoes across millennia',
      'sig.c3.d': 'Massive beacons send unstoppable waves across thousands of light-years—sync three or more stars to triangulate them.',

      'off.eyebrow': '03 · OFFLINE EVOLUTION & SAFEGUARDS',
      'off.title': 'Set rules before sleep; evolve while away',
      'off.lead': 'Time advances steadily at 1 min = 1 year even when your browser is closed:',
      'off.l1.title': '3 Automatic Safety Rules',
      'off.l1.desc': 'Configure deterministic rules to defend your civilization automatically:',
      'off.l1.mode.offline': 'Offline Only',
      'off.l1.mode.always': 'Always On',
      'off.r1': 'Asteroid spotted → Deflect it safely',
      'off.r2': 'Heat storage full → Vent heat',
      'off.r3': 'System overloaded → Pause outer stars',

      'pm.tag': '04 · LIGHT-LETTER POSTMARKS',
      'pm.status': 'ARRIVED',
      'pm.k1': 'DISTANCE',
      'pm.v1': '4.00 LY',
      'pm.k2': 'TRAVEL TIME',
      'pm.v2': '4 MIN',
      'pm.k3': 'SENT IN',
      'pm.v3': 'YEAR 40.0',
      'pm.k4': 'RECEIVED IN',
      'pm.v4': 'YEAR 44.0',
      'pm.seal': '4-YR DELAY\nVERIFIED',
      'pm.quote': '“You are seeing Star B as it was 4 years ago.”',

      'filter.title': '05 · Great Filters & Starting Anew',
      'filter.desc': 'There are no paid shields. Asteroids, supernovae, and internal overload affect every seat equally. If a civilization falls, its ruins stay in the galaxy, and you receive a clear summary before restarting on another star.',

      /* Login Page */
      'login.crumb': 'Sign In',
      'login.eyebrow': 'ACCOUNT · RESERVED',
      'login.title': 'Sign In to Your Observatory',
      'login.lead': 'One account across Web, iOS, and Android. Live sign-in opens with the online galaxy.',
      'login.google': 'Continue with Google',
      'login.apple': 'Continue with Apple',
      'login.reservedTag': 'Coming Soon',
      'login.divider': 'OR SIGN IN WITH EMAIL',
      'login.email': 'Email',
      'login.email.ph': 'name@example.com',
      'login.pass': 'Password',
      'login.pass.ph': 'Enter password',
      'login.remember': 'Keep me signed in',
      'login.submit': 'Sign In (Reserved)',
      'login.status.idle': 'Reserved sign-in page — online accounts activate when the live server launches.',
      'login.status.oauth': 'Triggered reserved {provider} sign-in slot.',
      'login.status.form': 'Form validated for {email}. Online auth is not live yet—try the playable preview via Enter Game.',
      'login.status.invalid': 'Please enter a valid email and password.',
      'login.side.title': 'Your Account & Progress',
      'login.side.p1': 'Your stars, safety rules, and letters stay synced in the cloud across every device.',
      'login.side.p2': 'If your civilization falls while you are away, you will find a brief summary and can restart immediately.',
      'login.side.noAccount': 'New here?',
      'login.side.toReg': 'Create an Account',
      'login.side.toPlay': 'Try Local Preview Without Signing In',

      /* Register Page */
      'reg.crumb': 'Register',
      'reg.eyebrow': 'NEW SEAT · RESERVED',
      'reg.title': 'Claim a Star in the Galaxy',
      'reg.lead': 'The universe never resets. Start from one quiet planet and grow at your own pace.',
      'reg.oauth.title': 'Quick Sign-Up (Coming Soon)',
      'reg.callsign': 'Civilization Name',
      'reg.callsign.ph': 'e.g. Orion Observatory',
      'reg.email': 'Email',
      'reg.pass': 'Password',
      'reg.zone.label': 'Where would you like to start?',
      'reg.zone.arm': 'Main Spiral Arm (Recommended)',
      'reg.zone.arm.d': 'Neighbors a few hundred light-years away—quiet start with future signals.',
      'reg.zone.halo': 'Quiet Outer Edge',
      'reg.zone.halo.d': 'Far fewer neighbors—deep solitude for patient exploration.',
      'reg.agree': 'I accept the rules: shared 1 min = 1 year clock, offline progress, fair survival.',
      'reg.submit': 'Register Account (Reserved)',
      'reg.status.idle': 'Reserved registration page — opens with the live server.',
      'reg.status.ok': 'Looks good: [{callsign}] · [{zone}]. Registration endpoint is reserved for launch.',
      'reg.status.err': 'Please fill in your name, valid email, 8+ char password, and accept the rules.',
      'reg.side.title': 'How You Start',
      'reg.side.k1': 'START',
      'reg.side.v1': 'One home planet',
      'reg.side.k2': 'PACE',
      'reg.side.v2': '1 real min = 1 year',
      'reg.side.k3': 'STYLE',
      'reg.side.v3': 'Offline-friendly, zero rush',
      'reg.side.k4': 'DEVICES',
      'reg.side.v4': 'Web / iOS / Android',
      'reg.side.toLogin': 'Already have an account? Sign In',

      /* Play Page */
      'play.crumb': 'Enter Game',
      'play.eyebrow': 'PLAY · /play/',
      'play.title': 'Enter the Game',
      'play.lead': 'No big download required—play right in your browser. Launch the playable preview now or check the upcoming online server.',
      'play.online.badge': 'Coming Soon',
      'play.online.title': 'Online Galactic Server',
      'play.online.desc': 'Join thousands of civilizations in one shared 100,000-light-year universe.',
      'play.online.btn1': 'Go to Sign In',
      'play.online.btn2': 'Check Server Status',
      'play.online.status.idle': 'The live online galaxy is not open yet (slot reserved).',
      'play.online.status.checked': 'Live online galaxy is in preparation. Try the playable preview alongside.',

      'play.local.badge': 'Playable Now',
      'play.local.title': 'Launch Web Preview',
      'play.local.desc': 'Explore the 3D star map, night-sky view, and a 4-light-year expedition.',
      'play.local.urlLabel': 'Game URL',
      'play.local.presetDev': 'Local Dev (:5178)',
      'play.local.presetDist': 'Static Build',
      'play.local.launch': 'Launch Game ↗',
      'play.local.cmdTitle': 'Local command (optional):',

      'play.diag.title': 'Device Compatibility Check',
      'play.diag.desc': 'Quick check of your current browser:',
      'play.diag.webgl2': '3D Star Rendering',
      'play.diag.audio': 'Audio Support',
      'play.diag.idb': 'Local Storage',
      'play.diag.viewport': 'Screen Size',
      'play.diag.ok': 'Ready',
      'play.diag.no': 'Unavailable',

      /* Download Page */
      'dl.crumb': 'Download',
      'dl.eyebrow': 'APPS · /download/',
      'dl.title': 'Get the Mobile App (iOS & Android)',
      'dl.lead': 'Play instantly in any browser, or grab the dedicated mobile apps once released—same account, same galaxy.',
      'dl.webBanner.t': 'Want to jump in right now? Play directly in your browser.',
      'dl.webBanner.b': 'Enter Game',

      'dl.ios.tag': 'Coming Soon',
      'dl.ios.title': 'iPhone & iPad',
      'dl.ios.desc': 'Tuned for iOS screens and haptics, with Apple and Google sign-in.',
      'dl.ios.btnStore': 'App Store (Reserved)',
      'dl.ios.btnTf': 'TestFlight Beta (Reserved)',
      'dl.ios.qrTitle': 'iOS QR Code',
      'dl.ios.qrDesc': 'Scan with iPhone camera after release.',
      'dl.ios.sys': 'Requires',
      'dl.ios.sysV': 'iOS 16.0 or newer',
      'dl.ios.ver': 'Status',
      'dl.ios.verV': 'In preparation',
      'dl.ios.auth': 'Sign In',
      'dl.ios.authV': 'Apple / Google',

      'dl.and.tag': 'Coming Soon',
      'dl.and.title': 'Android',
      'dl.and.desc': 'Available via Google Play and an official signed APK installer.',
      'dl.and.btnPlay': 'Google Play (Reserved)',
      'dl.and.btnApk': 'Official APK (Reserved)',
      'dl.and.qrTitle': 'Android QR Code',
      'dl.and.qrDesc': 'Direct signed installer link binds here at release.',
      'dl.and.sys': 'Requires',
      'dl.and.sysV': 'Android 10 or newer',
      'dl.and.arch': 'Devices',
      'dl.and.archV': 'Most 64-bit Android phones',
      'dl.and.sha': 'Safety',
      'dl.and.shaV': 'Official signed release',

      'dl.status.idle': 'Mobile apps are currently reserved ahead of release.',
      'dl.status.clicked': 'Reserved download button ({channel}). Mobile builds are coming soon—try the browser version in the meantime.',

      'dl.matrix.title': 'Platform Overview',
      'dl.matrix.th1': 'Platform',
      'dl.matrix.th2': 'Status',
      'dl.matrix.th3': 'Account Sync',
      'dl.matrix.th4': 'Highlights',
      'dl.matrix.r1.c1': 'Web Browser',
      'dl.matrix.r1.c2': 'Preview Ready',
      'dl.matrix.r1.c3': 'Synced',
      'dl.matrix.r1.c4': 'Zero install · instant updates',
      'dl.matrix.r2.c1': 'iOS App',
      'dl.matrix.r2.c2': 'Coming Soon',
      'dl.matrix.r2.c3': 'Synced',
      'dl.matrix.r2.c4': 'Haptic feedback · full-screen fit',
      'dl.matrix.r3.c1': 'Android App',
      'dl.matrix.r3.c2': 'Coming Soon',
      'dl.matrix.r3.c3': 'Synced',
      'dl.matrix.r3.c4': 'Google Play & signed APK',

      /* 404 Page */
      '404.eyebrow': '404 · NOT FOUND',
      '404.title': 'Page not found',
      '404.desc': 'Use one of the main links below to return.'
    }
  };

  function detectLocale() {
    try {
      const saved = localStorage.getItem('stars.locale');
      if (saved === 'zh-CN' || saved === 'en') return saved;
    } catch (_) {}
    const langs = navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || 'zh-CN'];
    return langs.some((l) => String(l).toLowerCase().startsWith('zh')) ? 'zh-CN' : 'en';
  }

  function saveLocale(locale) {
    try {
      localStorage.setItem('stars.locale', locale);
    } catch (_) {}
  }

  let currentLocale = detectLocale();

  function t(key, vars) {
    const table = dict[currentLocale] || dict['zh-CN'];
    let text = table[key] !== undefined ? table[key] : (dict['zh-CN'][key] || key);
    if (vars) {
      for (const [k, v] of Object.entries(vars)) {
        text = text.replaceAll(`{${k}}`, String(v));
      }
    }
    return text;
  }

  function applyTranslations() {
    document.documentElement.lang = currentLocale;
    document.title = t('site.title');
    document.querySelectorAll('[data-i18n]').forEach((el) => {
      const key = el.getAttribute('data-i18n');
      const val = t(key);
      if (val.includes('\n')) {
        el.innerHTML = val.split('\n').map((line) => line.replace(/&/g, '&amp;').replace(/</g, '&lt;')).join('<br>');
      } else {
        el.textContent = val;
      }
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
      el.setAttribute('placeholder', t(el.getAttribute('data-i18n-placeholder')));
    });
    document.querySelectorAll('[data-lang-toggle]').forEach((btn) => {
      btn.textContent = currentLocale === 'zh-CN' ? 'EN / 中文' : '中文 / EN';
      btn.setAttribute('aria-label', currentLocale === 'zh-CN' ? 'Switch to English' : '切换至简体中文');
    });
  }

  function setLocale(next) {
    currentLocale = next === 'en' ? 'en' : 'zh-CN';
    saveLocale(currentLocale);
    applyTranslations();
    document.dispatchEvent(new CustomEvent('stars:localechange', { detail: { locale: currentLocale } }));
  }

  function toggleLocale() {
    setLocale(currentLocale === 'zh-CN' ? 'en' : 'zh-CN');
  }

  global.StarsI18n = {
    getLocale: () => currentLocale,
    setLocale,
    toggleLocale,
    t,
    applyTranslations
  };
})(window);
