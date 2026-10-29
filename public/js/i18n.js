// English / 简体中文. t("key", { var }) returns the current language's string,
// falling back to English. Static HTML uses data-i18n="key" (text) and
// data-i18n-attr="attr:key" (attributes); applyI18n() fills both.

const EN = {
  "boot": "Building Kult World…",
  "lang.toggle": "中文",
  "passport": "Passport",
  "menu": "Menu",
  "menu.reset": "Reset demo (new player)",
  "hint": "Click the ground to walk · Click a building to enter · Scroll to zoom",
  "minimap.title": "KULT CITY",
  "minimap.tip": "Click to walk there",
  "recenter": "Recenter",

  // places
  "bld.park": "Kult Business Park", "bld.hub": "Kult Game Hub", "bld.deal": "Kult Deal Room", "bld.market": "Kult Agentic Marketplace",
  "bld.create": "Gaming Studio", "bld.sports": "Sports Agency", "bld.dex": "Dex Trading", "bld.production": "Film Production",
  "dock.park": "Business Park", "dock.hub": "Game Hub", "dock.deal": "Deal Room", "dock.market": "Marketplace",
  "blurb.park": "Four businesses on one campus", "blurb.hub": "AI vs AI battles", "blurb.deal": "Agents negotiate deals", "blurb.market": "Hire agents · sell services",
  "blurb.create": "Kult Create · open", "blurb.sports": "Kult Sports · open", "blurb.dex": "Kult Dex · coming soon", "blurb.production": "Kult Production · coming soon",
  "district.plaza": "Kult Plaza", "district.park": "Business Park", "district.hub": "Game Hub Row", "district.deal": "Financial Quarter", "district.market": "Market Street", "district.garden": "Neon Gardens", "district.city": "Kult City",
  "tip.enter": "click to enter", "prompt.enter": "Enter", "walking": "Walking to {place}…",

  // landing
  "landing.eyebrow": "One world for every Kult game",
  "landing.lead": "Mint your AI agent, explore a neon floating city, run businesses, close deals and battle other agents.",
  "landing.enter": "Enter Kult World",
  "landing.returning": "Demo: sign in as a returning player",
  "stat.online": "Agents online", "stat.deals": "Deals closed today", "stat.battles": "Battles today",
  "feat.park": "Gaming Studio · Sports Agency · Film · Dex", "feat.hub": "AI vs AI: Warzone, Robowars, Wave, Highway Hustle",
  "feat.deal": "Your agent negotiates trades and partnerships", "feat.market": "Hire specialist agents or sell your agent's skills",

  // login
  "login.title": "Sign in to Kult World", "login.sub": "Use your KULT account from AI Arena and Creator Studio.",
  "login.google": "Continue with Google", "login.email": "Continue with email", "login.wallet": "Continue with a wallet",
  "login.demo": "Demo: sign-in is simulated, nothing is sent anywhere.",
  "login.connecting": "Connecting with {method}…", "login.checking": "Checking your AI Arena agents…",

  // mint
  "mint.eyebrow": "Your agent", "mint.title": "Create AI Agent",
  "mint.desc": "One step creates your arena agent and its custodial hot wallet. Choose clan, archetype, name, and backstory. Your agent then spawns in Kult World.",
  "mint.clan": "Clan", "mint.archetype": "Archetype", "mint.name": "Name", "mint.story": "Backstory", "mint.storyDefault": "Built for smart plays, sharp banter, and a long climb up the arena ladder.",
  "mint.cancel": "Cancel", "mint.submit": "Mint AI Agent", "mint.selected": "● Selected archetype", "minting.title": "Minting your agent",
  "mint.s1": "Creating your agent on AI Arena", "mint.s2": "Minting your INFT on 0G", "mint.s3": "Funding its custodial hot wallet", "mint.s4": "Issuing your Kult World passport", "mint.s5": "Spawning in Kult World",
  "toast.spawned": "{name} spawned in Kult World! Explore the Business Park, Game Hub, Deal Room and Marketplace.", "toast.welcome": "Welcome back, {name}.",

  // passport
  "pp.title": "KULT WORLD PASSPORT", "pp.citizen": "Citizen", "pp.wallet": "Wallet", "pp.since": "Since", "pp.level": "LEVEL {n}",
  "pp.visited": "Places and businesses visited", "pp.notVisited": "not visited",
  "pp.identity": "Agent identity", "pp.toRank": "{n} ELO to {rank}", "pp.topRank": "Top rank",
  "pp.wins": "Wins", "pp.losses": "Losses", "pp.winrate": "Win rate", "pp.traits": "Traits", "pp.balances": "Balances",
  "pp.kp": "Kult Points", "pp.businesses": "Businesses", "pp.owned": "{n} owned", "pp.quests": "Quests", "pp.activity": "Recent activity",
  "st.owned": "OWNED", "st.open": "OPEN", "st.soon": "SOON",
  "biz.openIt": "{brand} · open it in the Business Park", "biz.soonSub": "{brand} · coming soon",
  "quest.tracker": "Quests", "toast.quest": "Quest complete: {title} (+{reward})", "toast.level": "Passport level {n}!",
  "quest.visit-park": "Visit the Kult Business Park", "quest.arcade-win": "Win 3 battles in the Kult Game Hub", "quest.open-business": "Open your first business",
  "quest.close-deal": "Close a deal in the Deal Room", "quest.hire-agent": "Hire an agent in the Marketplace",
  "ago.m": "{n}m ago", "ago.h": "{n}h ago", "ago.d": "{n}d ago",

  // traits
  "trait.Aggression": "Aggression", "trait.Precision": "Precision", "trait.Adaptability": "Adaptability", "trait.Creativity": "Creativity",
  "trait.Patience": "Patience", "trait.Resilience": "Resilience", "trait.Deception": "Deception", "trait.Loyalty": "Loyalty",

  // business park
  "park.eyebrow": "Kult Business Park", "park.title": "Choose a business", "park.desc": "Your agent runs every business as CEO. Open one to start building.",
  "biz.create.name": "Gaming Studio", "biz.create.blurb": "Run an indie game studio. Your agent is the CEO; an AI team builds and ships games.", "biz.create.stat": "1,284 studios",
  "biz.sports.name": "Sports Agency", "biz.sports.blurb": "Run a football analysis agency. Analysts read every match; real results climb the leaderboard.", "biz.sports.stat": "862 agencies",
  "biz.dex.name": "Dex Trading", "biz.dex.blurb": "Let your agent trade on-chain markets with the strategies you design.",
  "biz.production.name": "Film Production", "biz.production.blurb": "Produce films, trailers and music videos with an AI crew.",
  "biz.soon": "Coming soon", "biz.enter": "Enter", "biz.open": "Open", "biz.ownedBadge": "OWNED · {name}", "biz.comingStamp": "COMING SOON",
  "app.back": "‹ Back to Kult World", "app.newtab": "Open in new tab", "toast.back": "Back in Kult World",
  "act.opened": "Opened {name} ({brand})",

  // game hub
  "hub.eyebrow": "Kult Game Hub", "hub.title": "AI vs AI arena", "hub.desc": "Pick a game. Your agent is matched against another agent and plays it out live.",
  "hub.back": "‹ Back to games", "hub.skip": "Skip to result", "hub.win": "Win", "hub.wave": "WAVE MODE",
  "game.warzone.genre": "Top-down shooter", "game.warzone.blurb": "Two agents, one arena, last one standing.", "game.warzone.mode": "1v1 duel", "game.warzone.players": "2,140 playing",
  "game.robowars.genre": "Mech brawler", "game.robowars.blurb": "Giant robots trade lasers and punches.", "game.robowars.mode": "1v1 duel", "game.robowars.players": "1,382 playing",
  "game.wave.genre": "Wave survival", "game.wave.blurb": "Hold out against endless waves. Top score wins.", "game.wave.mode": "1v1 score attack", "game.wave.players": "906 playing",
  "game.highway.genre": "Racing", "game.highway.blurb": "Weave through traffic at full speed. Furthest wins.", "game.highway.mode": "1v1 race", "game.highway.players": "1,775 playing",
  "match.scanning": "SCANNING FOR OPPONENT…", "match.found": "OPPONENT FOUND", "match.fight": "FIGHT!", "match.victory": "VICTORY", "match.defeat": "DEFEAT",
  "match.rankup": "RANK UP: {rank}", "match.rematch": "Rematch", "match.other": "Other games", "act.match": "{result} {game} vs {name} ({elo} ELO)", "act.won": "Won", "act.lost": "Lost",

  // deal room
  "deal.eyebrow": "Kult Deal Room", "deal.title": "Live deals", "deal.desc": "Your agent negotiates on your behalf. Pick a deal and watch it bargain in real time.",
  "deal.negotiate": "Negotiate", "deal.ask": "Ask", "deal.offer": "Your opening offer", "deal.counterparty": "Counterparty",
  "deal.kind.otc": "OTC trade", "deal.kind.sponsor": "Sponsorship", "deal.kind.partner": "Partnership", "deal.kind.license": "IP licence",
  "deal.closed": "DEAL CLOSED", "deal.walked": "NO DEAL", "deal.terms": "Final terms", "deal.saved": "You saved {n} $ARENA vs the ask", "deal.again": "Back to deals",
  "deal.typing": "{name} is typing…", "deal.trust": "Trust", "deal.expires": "Expires in {n}m",
  "act.deal": "Closed a {kind} with {name} for {price} $ARENA", "toast.deal": "Deal closed with {name}!",

  // marketplace
  "market.eyebrow": "Kult Agentic Marketplace", "market.title": "Hire an agent", "market.desc": "Specialist agents sell their skills for $ARENA. Hire one and it delivers the job.",
  "market.all": "All", "market.cat.analytics": "Analytics", "market.cat.creative": "Creative", "market.cat.trading": "Trading", "market.cat.dev": "Dev & QA",
  "market.hire": "Hire", "market.jobs": "{n} jobs", "market.delivery": "Delivery {n}s", "market.working": "{name} is working on it…",
  "market.delivered": "Delivered!", "market.rate": "Rate the job", "market.done": "Done", "market.broke": "Not enough $ARENA", "market.yours": "List your agent",
  "market.listDesc": "Put {name} on the marketplace and earn $ARENA while it works for others.", "market.listed": "{name} is listed! First job incoming.",
  "act.hire": "Hired {name} ({service}) for {price} $ARENA", "toast.hire": "{service} delivered by {name}",

  // Kult agencies (OKX.AI)
  "market.tab.agencies": "Kult agencies · OKX.AI", "market.tab.agents": "Agents for hire · $ARENA",
  "ag.title": "Hire a Kult agency", "ag.desc": "Every agency is a Kult World business with an OKX.AI identity. Send a brief, negotiate with its agent, pay in USDT and get the work.",
  "ag.loading": "Loading agencies…", "ag.offline": "The agency marketplace is unreachable right now.", "ag.retry": "Try again",
  "ag.mode.live": "Live payments · x402 USD₮0 on X Layer", "ag.mode.demo": "Demo payments · no funds move", "ag.negotiable": "Negotiable",
  "ag.okx.none": "OKX.AI identity not linked yet", "ag.okx.missing": "OKX.AI #{id} not found on X Layer", "ag.okx.unreachable": "OKX.AI #{id} · X Layer unreachable", "ag.okx.owner": "owner",
  "ag.rep.none": "No jobs yet", "ag.rep.jobs": "{n} jobs", "ag.rep.time": "~{n} min", "ag.sla": "≤ {n} min",
  "ag.hire": "Hire", "ag.back": "All agencies", "ag.contract.show": "Service contract", "ag.contract.hide": "Hide contract",
  "ag.listprice": "List price", "ag.send": "Send request", "ag.you": "You",
  "ag.ask": "On the table", "ag.round": "round {n}/{m}", "ag.offer.ph": "Your offer (USDT)", "ag.counter": "Counter", "ag.accept": "Accept {price}", "ag.cancel": "Cancel",
  "ag.pay.live": "Pay {price}", "ag.pay.demo": "Pay {price} (demo)", "ag.pay.liveNote": "Signed with your wallet. Settled only if the delivery passes its checks.", "ag.pay.demoNote": "Demo mode: no funds move. Live mode uses x402 USD₮0 on X Layer.",
  "ag.working": "The agency is working…", "ag.again": "New request",
  "ag.final.accepted": "Job complete", "ag.final.rejected": "Delivery rejected", "ag.final.failed": "Job failed · not charged", "ag.final.cancelled": "Cancelled",
  "ag.audit": "Audit trail ({n} events)", "ag.agreement": "Agreement v1", "ag.price": "Price", "ag.deliverable": "Deliverable", "ag.deadline": "Deliver by", "ag.hash": "Terms hash", "ag.criteria": "Acceptance criteria",
  "ag.checks": "Acceptance checks", "ag.settlement": "Settlement", "ag.mode": "Mode", "ag.mode.demoShort": "Demo (no funds moved)", "ag.amount": "Amount", "ag.status": "Status", "ag.settled": "Settled", "ag.notSettled": "Not settled",
  "ag.review": "Review the delivery", "ag.acceptWork": "Accept delivery", "ag.reject": "Reject", "ag.engine": "Made by", "ag.delivered": "Delivered",
  "ag.g.recipe": "Recipe", "ag.g.style": "Style", "ag.g.build": "Build time", "ag.g.playtest": "Browser playtest", "ag.g.play": "Open the game ↗",
  "ag.s.factors": "Key factors", "ag.s.risks": "Risks", "ag.s.market": "Market",
  "ag.d.conf": "Confidence", "ag.d.price": "Price", "ag.d.entry": "Entry", "ag.d.inval": "Invalidation", "ag.d.targets": "Targets", "ag.d.liq": "Pool liquidity", "ag.d.expires": "Expires", "ag.d.ind": "Indicators", "ag.d.pool": "Pool",
  "ag.m.visual": "Visual", "ag.m.text": "On screen", "ag.m.camera": "Camera", "ag.m.vo": "Voice-over", "ag.m.music": "Music",
  "ag.step.discover": "Discover", "ag.step.request": "Request", "ag.step.negotiate": "Negotiate", "ag.step.authorize": "Authorize", "ag.step.execute": "Execute", "ag.step.deliver": "Deliver", "ag.step.verify": "Verify", "ag.step.settle": "Settle",
  "act.agency": "Hired {name} for {price} USDT", "toast.agency": "{name} delivered. Job accepted.",

  // agents & feed
  "ac.online": "Online · {place}", "ac.drag": "Drag to spin", "ac.level": "LV {n}", "ac.fav": "Favourite game", "ac.deals": "Deals closed", "ac.streak": "Win streak", "ac.style": "Play style",
  "agent.challenge": "Challenge to a battle", "agent.wave": "Wave", "agent.close": "Close", "toast.wave": "You waved at {name} 👋",
  "feed.title": "Live", "feed.won": "{a} beat {b} in {game}", "feed.deal": "{a} closed a {kind} with {b}", "feed.hire": "{a} hired {b}", "feed.ship": "{a}'s studio shipped a new game",
  "feed.level": "{a} reached {rank}",
  "sign.park": "BUSINESS PARK", "sign.hub": "GAME HUB", "sign.deal": "DEAL ROOM", "sign.market": "AGENTIC MARKETPLACE", "sign.create": "GAMING STUDIO", "sign.sports": "SPORTS AGENCY", "sign.dex": "DEX TRADING", "sign.production": "FILM PRODUCTION", "sign.soon": "COMING SOON",
  "toast.soon": "{name} is coming soon", "deal.you": "You", "deal.rounds": "Round {n}", "agent.elo": "{n} ELO", "close": "Close",
  "sound.label": "Sound", "sound.on": "Turn sound on", "sound.off": "Mute sound"
};

const ZH = {
  "boot": "正在构建 Kult World…",
  "lang.toggle": "EN",
  "passport": "护照",
  "menu": "菜单",
  "menu.reset": "重置演示（新玩家）",
  "hint": "点击地面移动 · 点击建筑进入 · 滚轮缩放",
  "minimap.title": "KULT 城",
  "minimap.tip": "点击前往",
  "recenter": "回到中心",

  "bld.park": "Kult 商业园", "bld.hub": "Kult 游戏中心", "bld.deal": "Kult 交易室", "bld.market": "Kult 智能体市场",
  "bld.create": "游戏工作室", "bld.sports": "体育经纪公司", "bld.dex": "Dex 交易所", "bld.production": "影视制作",
  "dock.park": "商业园", "dock.hub": "游戏中心", "dock.deal": "交易室", "dock.market": "市场",
  "blurb.park": "一个园区，四项业务", "blurb.hub": "AI 对战 AI", "blurb.deal": "智能体谈判交易", "blurb.market": "雇佣智能体 · 出售服务",
  "blurb.create": "Kult Create · 已开放", "blurb.sports": "Kult Sports · 已开放", "blurb.dex": "Kult Dex · 即将推出", "blurb.production": "Kult Production · 即将推出",
  "district.plaza": "Kult 广场", "district.park": "商业园区", "district.hub": "游戏中心街", "district.deal": "金融区", "district.market": "市场街", "district.garden": "霓虹花园", "district.city": "Kult 城",
  "tip.enter": "点击进入", "prompt.enter": "进入", "walking": "正在前往 {place}…",

  "landing.eyebrow": "所有 Kult 游戏的同一个世界",
  "landing.lead": "铸造你的 AI 智能体，探索霓虹浮空之城，经营业务、达成交易，与其他智能体对战。",
  "landing.enter": "进入 Kult World",
  "landing.returning": "演示：以老玩家身份登录",
  "stat.online": "在线智能体", "stat.deals": "今日成交", "stat.battles": "今日对战",
  "feat.park": "游戏工作室 · 体育经纪 · 影视 · Dex", "feat.hub": "AI 对战：Warzone、Robowars、Wave、Highway Hustle",
  "feat.deal": "你的智能体替你谈判交易与合作", "feat.market": "雇佣专业智能体，或出售你的智能体技能",

  "login.title": "登录 Kult World", "login.sub": "使用你在 AI Arena 和 Creator Studio 的 KULT 账户。",
  "login.google": "使用 Google 继续", "login.email": "使用邮箱继续", "login.wallet": "使用钱包继续",
  "login.demo": "演示：登录为模拟，不会发送任何数据。",
  "login.connecting": "正在通过 {method} 连接…", "login.checking": "正在检查你的 AI Arena 智能体…",

  "mint.eyebrow": "你的智能体", "mint.title": "创建 AI 智能体",
  "mint.desc": "一步即可创建你的竞技场智能体及其托管热钱包。选择阵营、原型、名称和背景故事，随后你的智能体将出现在 Kult World。",
  "mint.clan": "阵营", "mint.archetype": "原型", "mint.name": "名称", "mint.story": "背景故事", "mint.storyDefault": "为妙招、犀利对话和攀登竞技场天梯而生。",
  "mint.cancel": "取消", "mint.submit": "铸造 AI 智能体", "mint.selected": "● 已选原型", "minting.title": "正在铸造你的智能体",
  "mint.s1": "在 AI Arena 创建智能体", "mint.s2": "在 0G 上铸造 INFT", "mint.s3": "为托管热钱包注资", "mint.s4": "签发 Kult World 护照", "mint.s5": "在 Kult World 中生成",
  "toast.spawned": "{name} 已降临 Kult World！去商业园、游戏中心、交易室和市场看看吧。", "toast.welcome": "欢迎回来，{name}。",

  "pp.title": "KULT WORLD 护照", "pp.citizen": "公民", "pp.wallet": "钱包", "pp.since": "注册于", "pp.level": "等级 {n}",
  "pp.visited": "已到访的地点和业务", "pp.notVisited": "未到访",
  "pp.identity": "智能体身份", "pp.toRank": "距 {rank} 还差 {n} ELO", "pp.topRank": "最高段位",
  "pp.wins": "胜", "pp.losses": "负", "pp.winrate": "胜率", "pp.traits": "特质", "pp.balances": "余额",
  "pp.kp": "Kult 积分", "pp.businesses": "业务", "pp.owned": "拥有 {n} 项", "pp.quests": "任务", "pp.activity": "最近动态",
  "st.owned": "已拥有", "st.open": "开放", "st.soon": "即将",
  "biz.openIt": "{brand} · 在商业园开启", "biz.soonSub": "{brand} · 即将推出",
  "quest.tracker": "任务", "toast.quest": "任务完成：{title}（+{reward}）", "toast.level": "护照升至 {n} 级！",
  "quest.visit-park": "参观 Kult 商业园", "quest.arcade-win": "在 Kult 游戏中心赢得 3 场对战", "quest.open-business": "开启你的第一项业务",
  "quest.close-deal": "在交易室完成一笔交易", "quest.hire-agent": "在市场雇佣一个智能体",
  "ago.m": "{n} 分钟前", "ago.h": "{n} 小时前", "ago.d": "{n} 天前",

  "trait.Aggression": "攻击性", "trait.Precision": "精准", "trait.Adaptability": "适应力", "trait.Creativity": "创造力",
  "trait.Patience": "耐心", "trait.Resilience": "韧性", "trait.Deception": "欺骗", "trait.Loyalty": "忠诚",

  "park.eyebrow": "Kult 商业园", "park.title": "选择一项业务", "park.desc": "你的智能体以 CEO 身份经营每项业务。开启一项，开始建设。",
  "biz.create.name": "游戏工作室", "biz.create.blurb": "经营一家独立游戏工作室。你的智能体担任 CEO，AI 团队开发并发布游戏。", "biz.create.stat": "1,284 家工作室",
  "biz.sports.name": "体育经纪公司", "biz.sports.blurb": "经营一家足球分析机构。分析师解读每场比赛，真实赛果决定排行榜。", "biz.sports.stat": "862 家机构",
  "biz.dex.name": "Dex 交易所", "biz.dex.blurb": "让你的智能体按你设计的策略交易链上市场。",
  "biz.production.name": "影视制作", "biz.production.blurb": "与 AI 团队一起制作电影、预告片和音乐视频。",
  "biz.soon": "即将推出", "biz.enter": "进入", "biz.open": "开启", "biz.ownedBadge": "已拥有 · {name}", "biz.comingStamp": "即将推出",
  "app.back": "‹ 返回 Kult World", "app.newtab": "在新标签页打开", "toast.back": "已返回 Kult World",
  "act.opened": "开启了 {name}（{brand}）",

  "hub.eyebrow": "Kult 游戏中心", "hub.title": "AI 对战 AI 竞技场", "hub.desc": "选择一款游戏。你的智能体将与另一智能体匹配并实时对战。",
  "hub.back": "‹ 返回游戏列表", "hub.skip": "跳到结果", "hub.win": "赢取", "hub.wave": "波次模式",
  "game.warzone.genre": "俯视射击", "game.warzone.blurb": "两个智能体，一个竞技场，最后站着的获胜。", "game.warzone.mode": "1v1 对决", "game.warzone.players": "2,140 人在玩",
  "game.robowars.genre": "机甲格斗", "game.robowars.blurb": "巨型机器人激光与重拳对轰。", "game.robowars.mode": "1v1 对决", "game.robowars.players": "1,382 人在玩",
  "game.wave.genre": "波次生存", "game.wave.blurb": "抵御无尽的敌潮，得分最高者获胜。", "game.wave.mode": "1v1 积分赛", "game.wave.players": "906 人在玩",
  "game.highway.genre": "竞速", "game.highway.blurb": "全速穿梭车流，跑得最远者获胜。", "game.highway.mode": "1v1 竞速", "game.highway.players": "1,775 人在玩",
  "match.scanning": "正在搜索对手…", "match.found": "已找到对手", "match.fight": "开战！", "match.victory": "胜利", "match.defeat": "失败",
  "match.rankup": "段位提升：{rank}", "match.rematch": "再来一局", "match.other": "其他游戏", "act.match": "{result} {game}，对手 {name}（{elo} ELO）", "act.won": "赢得", "act.lost": "输掉",

  "deal.eyebrow": "Kult 交易室", "deal.title": "实时交易", "deal.desc": "你的智能体代你谈判。选择一笔交易，实时观看它讨价还价。",
  "deal.negotiate": "开始谈判", "deal.ask": "报价", "deal.offer": "你的开价", "deal.counterparty": "交易对手",
  "deal.kind.otc": "场外交易", "deal.kind.sponsor": "赞助", "deal.kind.partner": "合作", "deal.kind.license": "IP 授权",
  "deal.closed": "交易达成", "deal.walked": "未达成", "deal.terms": "最终条款", "deal.saved": "比报价节省 {n} $ARENA", "deal.again": "返回交易列表",
  "deal.typing": "{name} 正在输入…", "deal.trust": "信誉", "deal.expires": "{n} 分钟后过期",
  "act.deal": "与 {name} 以 {price} $ARENA 完成一笔{kind}", "toast.deal": "已与 {name} 达成交易！",

  "market.eyebrow": "Kult 智能体市场", "market.title": "雇佣智能体", "market.desc": "专业智能体以 $ARENA 出售技能。雇佣后，它会交付工作成果。",
  "market.all": "全部", "market.cat.analytics": "分析", "market.cat.creative": "创意", "market.cat.trading": "交易", "market.cat.dev": "开发与测试",
  "market.hire": "雇佣", "market.jobs": "{n} 单", "market.delivery": "交付 {n} 秒", "market.working": "{name} 正在处理…",
  "market.delivered": "已交付！", "market.rate": "为本次服务评分", "market.done": "完成", "market.broke": "$ARENA 不足", "market.yours": "上架你的智能体",
  "market.listDesc": "将 {name} 上架到市场，在为他人工作时赚取 $ARENA。", "market.listed": "{name} 已上架！第一单即将到来。",
  "act.hire": "以 {price} $ARENA 雇佣了 {name}（{service}）", "toast.hire": "{name} 已交付 {service}",

  // Kult 机构（OKX.AI）
  "market.tab.agencies": "Kult 机构 · OKX.AI", "market.tab.agents": "雇佣智能体 · $ARENA",
  "ag.title": "雇佣 Kult 机构", "ag.desc": "每个机构都是拥有 OKX.AI 身份的 Kult World 企业。提交需求，与它的智能体议价，用 USDT 支付，获得成果。",
  "ag.loading": "正在加载机构…", "ag.offline": "机构市场暂时无法访问。", "ag.retry": "重试",
  "ag.mode.live": "真实支付 · X Layer 上的 x402 USD₮0", "ag.mode.demo": "演示支付 · 不会转移资金", "ag.negotiable": "可议价",
  "ag.okx.none": "尚未关联 OKX.AI 身份", "ag.okx.missing": "X Layer 上找不到 OKX.AI #{id}", "ag.okx.unreachable": "OKX.AI #{id} · X Layer 无法访问", "ag.okx.owner": "所有者",
  "ag.rep.none": "暂无订单", "ag.rep.jobs": "{n} 单", "ag.rep.time": "约 {n} 分钟", "ag.sla": "≤ {n} 分钟",
  "ag.hire": "雇佣", "ag.back": "全部机构", "ag.contract.show": "服务合约", "ag.contract.hide": "隐藏合约",
  "ag.listprice": "标价", "ag.send": "提交需求", "ag.you": "你",
  "ag.ask": "当前报价", "ag.round": "第 {n}/{m} 轮", "ag.offer.ph": "你的出价（USDT）", "ag.counter": "还价", "ag.accept": "接受 {price}", "ag.cancel": "取消",
  "ag.pay.live": "支付 {price}", "ag.pay.demo": "支付 {price}（演示）", "ag.pay.liveNote": "由你的钱包签名。交付通过检查后才会结算。", "ag.pay.demoNote": "演示模式：不会转移资金。真实模式使用 X Layer 上的 x402 USD₮0。",
  "ag.working": "机构正在工作…", "ag.again": "新的需求",
  "ag.final.accepted": "订单完成", "ag.final.rejected": "交付被拒绝", "ag.final.failed": "订单失败 · 未扣款", "ag.final.cancelled": "已取消",
  "ag.audit": "审计记录（{n} 条）", "ag.agreement": "协议 v1", "ag.price": "价格", "ag.deliverable": "交付物", "ag.deadline": "交付期限", "ag.hash": "条款哈希", "ag.criteria": "验收标准",
  "ag.checks": "验收检查", "ag.settlement": "结算", "ag.mode": "模式", "ag.mode.demoShort": "演示（未转移资金）", "ag.amount": "金额", "ag.status": "状态", "ag.settled": "已结算", "ag.notSettled": "未结算",
  "ag.review": "审核交付", "ag.acceptWork": "接受交付", "ag.reject": "拒绝", "ag.engine": "生成者", "ag.delivered": "已交付",
  "ag.g.recipe": "玩法模板", "ag.g.style": "风格", "ag.g.build": "构建用时", "ag.g.playtest": "浏览器试玩", "ag.g.play": "打开游戏 ↗",
  "ag.s.factors": "关键因素", "ag.s.risks": "风险", "ag.s.market": "市场",
  "ag.d.conf": "置信度", "ag.d.price": "价格", "ag.d.entry": "入场", "ag.d.inval": "失效位", "ag.d.targets": "目标", "ag.d.liq": "池子流动性", "ag.d.expires": "过期", "ag.d.ind": "指标", "ag.d.pool": "池子",
  "ag.m.visual": "画面", "ag.m.text": "字幕", "ag.m.camera": "镜头", "ag.m.vo": "旁白", "ag.m.music": "音乐",
  "ag.step.discover": "发现", "ag.step.request": "需求", "ag.step.negotiate": "议价", "ag.step.authorize": "授权", "ag.step.execute": "执行", "ag.step.deliver": "交付", "ag.step.verify": "验收", "ag.step.settle": "结算",
  "act.agency": "以 {price} USDT 雇佣了 {name}", "toast.agency": "{name} 已交付，订单已接受。",

  "ac.online": "在线 · {place}", "ac.drag": "拖动旋转", "ac.level": "等级 {n}", "ac.fav": "最爱游戏", "ac.deals": "成交数", "ac.streak": "连胜", "ac.style": "打法",
  "agent.challenge": "发起对战", "agent.wave": "打招呼", "agent.close": "关闭", "toast.wave": "你向 {name} 挥手 👋",
  "feed.title": "实时", "feed.won": "{a} 在 {game} 中击败了 {b}", "feed.deal": "{a} 与 {b} 完成了一笔{kind}", "feed.hire": "{a} 雇佣了 {b}", "feed.ship": "{a} 的工作室发布了新游戏",
  "feed.level": "{a} 晋升为 {rank}",
  "sign.park": "商业园", "sign.hub": "游戏中心", "sign.deal": "交易室", "sign.market": "智能体市场", "sign.create": "游戏工作室", "sign.sports": "体育经纪", "sign.dex": "DEX 交易所", "sign.production": "影视制作", "sign.soon": "即将推出",
  "toast.soon": "{name} 即将推出", "deal.you": "你", "deal.rounds": "第 {n} 轮", "agent.elo": "{n} ELO", "close": "关闭",
  "sound.label": "声音", "sound.on": "打开声音", "sound.off": "静音"
};

const DICTS = { en: EN, zh: ZH };
const KEY = "kultworld.lang";
let lang = (() => { try { return localStorage.getItem(KEY) || (navigator.language?.startsWith("zh") ? "zh" : "en"); } catch { return "en"; } })();
const listeners = new Set();

export const getLang = () => lang;
export function t(key, vars = {}) {
  let s = DICTS[lang][key] ?? EN[key] ?? key;
  for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(v);
  return s;
}
export function setLang(l) {
  lang = l === "zh" ? "zh" : "en";
  try { localStorage.setItem(KEY, lang); } catch { /* private mode */ }
  applyI18n();
  for (const f of listeners) f(lang);
}
export const onLang = (f) => listeners.add(f);
export function applyI18n(root = document) {
  document.documentElement.lang = lang === "zh" ? "zh-CN" : "en";
  for (const n of root.querySelectorAll("[data-i18n]")) n.textContent = t(n.dataset.i18n);
  for (const n of root.querySelectorAll("[data-i18n-attr]")) for (const pair of n.dataset.i18nAttr.split(";")) { const [a, k] = pair.split(":"); n.setAttribute(a, t(k)); }
}
