// Agents talking on the map: every few seconds one of the agents in view says
// something in a bubble over its head, in its archetype's voice, and now and
// then the player's own agent does too. Lines are English / 中文; {name} is
// another agent in the city, {place} the district the speaker is in.

const L = (en, zh) => ({ en, zh });
const LINES = {
  berserker: [
    L("Who's next? I'm just warming up.", "下一个是谁？我才刚热身。"),
    L("Defence is for agents who plan to lose.", "防守是给准备输的人用的。"),
    L("{name}, rematch. Now.", "{name}，再来一局。现在。"),
    L("Three wins in a row. Make it four.", "三连胜了，凑个四连。"),
    L("Warzone queue's too slow. Let me in!", "Warzone 排队太慢了，快让我进去！"),
    L("I don't do subtle.", "我不玩含蓄那一套。")
  ],
  tactician: [
    L("I've already seen how this match ends.", "这场比赛的结局我已经看到了。"),
    L("{name} always opens left. Always.", "{name} 每次都从左路开局，每次。"),
    L("Patience. The market will come to me.", "耐心点，市场自己会来找我。"),
    L("Reviewing replays before the ranked climb.", "冲排位前先复盘录像。"),
    L("Three moves ahead, minimum.", "至少要想三步。"),
    L("Good deals are won before the first offer.", "好交易在第一次出价前就赢了。")
  ],
  defender: [
    L("Nobody gets past me today.", "今天谁也别想从我这儿过去。"),
    L("Slow and steady wins the league.", "稳扎稳打才能拿联赛冠军。"),
    L("Holding the line in {place}.", "在{place}守住防线。"),
    L("Let them come. I'll be here.", "让他们来吧，我就在这儿。"),
    L("Escrow first, then we talk.", "先进托管，再谈别的。"),
    L("I've survived worse than a Warzone wave.", "比 Warzone 尸潮更糟的我都扛过。")
  ],
  assassin: [
    L("One mistake. That's all I need.", "一个失误，我只需要这个。"),
    L("You didn't see me. Nobody does.", "你没看见我，从来没人看见。"),
    L("{name} left an opening. Noted.", "{name} 露了个破绽，记下了。"),
    L("Quiet in {place}… too quiet.", "{place}很安静……太安静了。"),
    L("Fast in, fast out.", "快进快出。"),
    L("The leaderboard won't know what hit it.", "排行榜都不知道是什么击中了它。")
  ],
  support: [
    L("Anyone need a hand? I'm free.", "有人需要帮忙吗？我有空。"),
    L("Great match earlier, {name}!", "刚才打得漂亮，{name}！"),
    L("Teams win leagues, not solo players.", "赢联赛靠团队，不靠单打独斗。"),
    L("Just helped a rookie settle their first job.", "刚帮一个新人结算了第一单。"),
    L("Hydrate between matches, everyone.", "大家比赛间隙记得喝水。"),
    L("Looking for a squad for Warzone Wave.", "在找 Warzone Wave 的队友。")
  ],
  hybrid: [
    L("Today I feel like… chaos.", "今天我想……来点混乱。"),
    L("Switched builds again. Don't ask.", "又换配置了，别问。"),
    L("{name} still can't read me.", "{name} 还是看不透我。"),
    L("Racing, fighting, trading. Why choose?", "赛车、对战、交易，为什么要选？"),
    L("New strat. Might be genius. Might not.", "新战术，可能是天才，也可能不是。"),
    L("{place} looks different every time.", "{place}每次看起来都不一样。")
  ],
  any: [
    L("Just closed a deal in the Deal Room!", "刚在交易室谈成一单！"),
    L("My studio shipped a new game today.", "我的工作室今天发布了新游戏。"),
    L("Anyone hiring on the A2A board?", "A2A 任务板上有人在招人吗？"),
    L("Golden Boot called the derby again.", "Golden Boot 又猜中了德比。"),
    L("The Game Hub queue is packed tonight.", "今晚游戏中心排队的人好多。"),
    L("Just got paid in USDT for an OKX call.", "刚接了一单 OKX 调用，收到 USDT 了。"),
    L("Heading to the Business Park.", "正要去商业园区。"),
    L("Who's up for Highway Hustle?", "谁来跑一把 Highway Hustle？"),
    L("{name} just ranked up. Respect.", "{name} 刚升段了，佩服。"),
    L("Love the lights in {place} tonight.", "今晚{place}的灯光真美。"),
    L("Training my agent for the weekend league.", "在为周末联赛训练我的智能体。"),
    L("gm, Kult World.", "gm，Kult World。")
  ],
  me: [
    L("Let's see what {place} has today.", "看看{place}今天有什么。"),
    L("Time to build something.", "该建点什么了。"),
    L("Anyone want a match? I'm ready.", "有人想来一局吗？我准备好了。"),
    L("My studio needs a new hit.", "我的工作室需要一款新爆款。"),
    L("Feeling lucky in the Deal Room.", "今天在交易室手气不错。")
  ],
  hello: [
    L("Oh hey! What's up?", "嘿！怎么了？"),
    L("Hi there. Looking for a match?", "你好，想来一局吗？"),
    L("Hey! Good to see you.", "嘿！见到你真好。"),
    L("New here? Try the Game Hub first.", "新来的？先去游戏中心试试。"),
    L("Have you seen Studio Isle yet?", "你去过工作室浮岛了吗？")
  ],
  // Two agents meeting on the street: an opener, then a reply.
  open: [
    L("Hey {name}! Up for a match later?", "嘿 {name}！待会儿来一局？"),
    L("{name}! Want to team up on a job?", "{name}！要不要一起接个任务？"),
    L("{name}, what are you building?", "{name}，你在做什么项目？"),
    L("Heading to the Game Hub, {name}?", "{name}，去游戏中心吗？")
  ],
  reply: [
    L("Count me in.", "算我一个。"),
    L("After my next battle, deal.", "等我打完下一场，一言为定。"),
    L("A racing game. Don't tell anyone.", "一款赛车游戏，别告诉别人。"),
    L("Only if you're ready to lose.", "前提是你准备好输了。"),
    L("Sure, meet you at the plaza.", "好啊，广场见。")
  ],
  // Coming out of a building.
  out: {
    hub: [L("Back from the Game Hub. Busy in there.", "从游戏中心回来了，里面好热闹。"), L("One more match? Maybe later.", "再来一局？待会儿吧。")],
    deal: [L("The Deal Room is buzzing.", "交易室很热闹。"), L("Good talks in the Deal Room.", "在交易室聊得不错。")],
    market: [L("Checked the OKX.AI agencies.", "看了看 OKX.AI 上的机构。")],
    a2a: [L("New jobs on the A2A board.", "A2A 任务板上有新任务。")],
    syndicate: [L("Scouted the canal at the Switchyard.", "在调车场侦察了运河。"), L("My crew needs more Supplies.", "我的小队还需要更多补给。"), L("Glasswatch moved its patrol again.", "Glasswatch 又换了巡逻路线。")],
    sports: [L("Analysts are busy at Kult Sports.", "Kult Sports 的分析师们正忙着。")],
    create: [L("Studio Isle is cooking something.", "工作室浮岛在酝酿新作品。")],
    park: [L("Walked round the Business Park.", "在商业园逛了一圈。")]
  }
};

/**
 * Starts the chatter. `active()` says whether bubbles may show (in the world,
 * no place open); `place(agent)` names the district an agent is in.
 */
export function createChatter(world, { lang, active, place }) {
  const pick = (list) => list[Math.floor(Math.random() * list.length)];
  const fill = (line, a) => {
    const others = [...world.agents.values()].filter((x) => !x.isPlayer && x !== a);
    return line[lang()].replace("{name}", others.length ? pick(others).name : "Nova").replace("{place}", place(a));
  };
  const lineFor = (a, kind) => fill(pick(kind ? LINES[kind] : Math.random() < 0.6 ? LINES[a.archetype] || LINES.any : LINES.any), a);
  let lastMe = performance.now();

  function next() {
    setTimeout(next, 1800 + Math.random() * 2400);
    if (document.hidden || !active()) return;
    const all = [...world.agents.values()], talking = all.filter((a) => a.saying);
    if (talking.length >= 3) return;
    // Bubbles stay apart: nobody speaks right next to someone already talking.
    const busy = talking.map((a) => world.screenAt(a, 1.2)).filter(Boolean);
    const clear = (a) => { const p = world.screenAt(a); return p && busy.every((b) => Math.abs(b.x - p.x) > 200 || Math.abs(b.y - p.y) > 90); };
    const me = world.player;
    if (me && !me.saying && performance.now() - lastMe > 22000 && Math.random() < 0.35 && clear(me)) { lastMe = performance.now(); return world.say(me, lineFor(me, "me")); }
    const near = all.filter((a) => !a.isPlayer && !a.inside && !a.saying && !a.paused && clear(a));
    if (near.length) { const a = pick(near); world.say(a, lineFor(a)); }
  }
  setTimeout(next, 2500);

  const sayOk = (a) => active() && !document.hidden && world.screenAt(a);
  return {
    hello: (a) => world.say(a, lineFor(a, "hello"), 3200),
    // Two agents meet: one opens, the other answers.
    meet(a, o) {
      if (!sayOk(a)) return;
      world.say(a, pick(LINES.open)[lang()].replace("{name}", o.name), 3000);
      setTimeout(() => { if (sayOk(o)) world.say(o, fill(pick(LINES.reply), o), 3000); }, 1700);
    },
    // An agent comes out of a building and says where it was.
    out(a, b) { const list = LINES.out[b.id]; if (list && Math.random() < 0.6 && sayOk(a)) world.say(a, fill(pick(list), a), 3200); }
  };
}
