// 站内内容页双语字典（download/faq/about/privacy/feedback/guides）
// 约定与 dict.ts 一致：en 为基线语言（key 必须齐全），zh 结构对齐回落 en。
// 文案原则：人话、小白视角、不用术语；导航/页脚/按钮中文 ≤12 字符。

export type Lang = 'en' | 'zh';

const en = {
  download: {
    title: 'Download AiBOX',
    lede: 'One file. Double-click and it runs — nothing to install, no administrator rights, no changes to your system.',
    win: {
      label: 'Windows',
      note: 'Windows 10/11 · 64-bit · portable',
      cta: 'Download for Windows',
      coming: '',
    },
    mac: {
      label: 'macOS',
      note: 'The macOS build is on its way. Windows first.',
      cta: 'Coming soon',
    },
    release: {
      heading: 'This release',
      version: 'Version',
      file: 'File',
      size: 'Size',
      sha: 'SHA-256',
      published: 'Published',
      copy: 'Copy',
      copied: 'Copied',
      checking: 'Fetching the latest release…',
      live: 'live · GitHub API',
      cached: 'cached · 5 min',
      snapshot: 'build-time snapshot',
      unavailable: 'Release details are unavailable right now — the button above still works.',
      allReleases: 'All releases on GitHub',
      shaNote: 'Compare this with your downloaded file. They must match exactly — if they do not, do not run the file.',
    },
    smartscreen: {
      heading: 'Windows says “unknown publisher”?',
      body: 'First time you run a downloaded file, Windows asks you to double-check. It is not a virus warning about AiBOX. Four taps and you are in.',
      cta: 'Open the step-by-step guide',
    },
    integrity: {
      heading: 'How to know the file is real',
      body: 'Every release file has a public SHA-256 checksum, shown above and on the GitHub Releases page. AiBOX also verifies every download automatically before installing it.',
    },
  },

  faq: {
    title: 'FAQ',
    lede: 'Plain answers to the questions people actually ask.',
    items: [
      {
        q: 'Do I have to type commands?',
        a: 'No. Everything is buttons and clicks: pick an app, follow the prompts, paste your API key when asked. You never open a terminal.',
      },
      {
        q: 'Is it safe? Will it steal my API key?',
        a: 'Your key is written straight into the app’s own config file on your own computer. It never passes through us — we do not even run a server that could see it. The installer is open source, so anyone can check.',
      },
      {
        q: 'Does it need administrator rights?',
        a: 'No. AiBOX is portable: no installer, no registry changes, no admin prompts. It only writes to its own data folder and to the apps it sets up.',
      },
      {
        q: 'How do I uninstall it?',
        a: 'Delete the AiBOX file — that is the whole uninstall. It keeps its notes in a small data folder you can delete too. Uninstalling the apps you installed is done inside each app.',
        link: { href: '/feedback/', label: 'Something broken? Tell us' },
      },
      {
        q: 'Where is my API key stored?',
        a: 'In the target app’s config file, in your own user folder. You can open it, edit it or delete it whenever you like. AiBOX never uploads it anywhere.',
      },
      {
        q: 'The download is slow, or installation stops on network errors',
        a: 'Usually a network reachability problem. There is a short self-check you can follow — it takes two minutes and fixes most cases.',
        link: { href: '/guides/network-selfcheck/', label: 'Open the network self-check' },
      },
      {
        q: 'Windows warns me with “unknown publisher” — is that bad?',
        a: 'That is SmartScreen doing its job for unsigned apps: Windows has simply not seen this file before. Four clicks get you past it, and the checksum above proves the file is ours.',
        link: { href: '/guides/smartscreen/', label: 'Open the SmartScreen guide' },
      },
      {
        q: 'Does it work on macOS?',
        a: 'Not yet. Windows works today; the macOS build is next. The download page will show it the moment it lands.',
        link: { href: '/download/', label: 'Go to the download page' },
      },
      {
        q: 'How much does it cost?',
        a: 'Nothing. AiBOX is free and open source. You only pay the AI provider whose API key you already have.',
      },
      {
        q: 'Something went wrong — what now?',
        a: 'Export the diagnostics from AiBOX (they are scrubbed of secrets) and open an issue, or just email us. A human reads these.',
        link: { href: '/feedback/', label: 'How to report a problem' },
      },
    ],
  },

  about: {
    title: 'About AiBOX',
    lede: 'AiBOX (中文名：智能盒子) installs desktop AI tools for people who just want them to work.',
    blocks: [
      {
        h: 'What it is',
        p: 'A small portable program for Windows (macOS coming). You pick an app from the catalog, AiBOX checks your machine, installs what is missing in order, fills in your API key, and then proves the app actually answers. If something is in the way, it clears it — in plain language, one step at a time.',
      },
      {
        h: 'What it is not',
        p: 'AiBOX is not a store, not a cloud service, and not an assistant that chats with you. It is a toolbox: it gets your tools installed and working, then gets out of the way.',
      },
      {
        h: 'Independent by design',
        p: 'Aibox is an independent community project and is not affiliated with the official apps listed in the catalog. Their names and trademarks belong to their respective owners. We just install them.',
      },
      {
        h: 'Open source',
        p: 'The installer, this website and the app catalog data all live in public GitHub repositories under the imAiBOX organization. Read the code, audit the checksums, open a pull request.',
      },
    ],
    contactH: 'Contact',
    contact: 'Questions, partnerships or press: hi@aibox.im. Bug reports are fastest through GitHub Issues.',
    github: 'GitHub organization',
  },

  privacy: {
    title: 'Privacy',
    lede: 'The short version: there is almost nothing to collect, because there is no backend.',
    blocks: [
      {
        h: 'This website',
        p: 'Pure static HTML served by Cloudflare Pages. No accounts, no cookies for tracking, no analytics scripts, no database. Your browser talks to our pages and nothing else.',
      },
      {
        h: 'Your API key',
        a: '',
        p: 'Your key is written only into the target app’s config file on your own computer. It never travels to us — we run no service that could receive it, and we would not want it.',
      },
      {
        h: 'The download page',
        p: 'The version and checksum shown on the download page are fetched anonymously from GitHub’s public API, with a 5-minute local cache. GitHub sees a normal public API request; we see nothing.',
      },
      {
        h: 'Logs and diagnostics',
        p: 'Application logs stay on your machine. When you export diagnostics, you choose to send that file yourself — secrets are scrubbed before it is written.',
      },
      {
        h: 'Honest limits',
        p: 'Cloudflare keeps standard server logs (IP address, requested page) for its own operation and security. We do not use them to build profiles or share them with advertisers. If that ever changes, this page will say so first.',
      },
    ],
    contactH: 'Questions about this page',
    contact: 'Email hi@aibox.im — we answer in plain language.',
  },

  feedback: {
    title: 'Feedback',
    lede: 'Found a bug, or something did not install? Pick the fastest channel below.',
    channels: [
      {
        h: 'Installer problems',
        p: 'Crashes, wrong error messages, an app that refuses to install: open an issue in the aibox-app repository. Include what you were doing and what you saw — the exact wording of any error helps a lot.',
        cta: 'Open aibox-app issues',
        href: 'https://github.com/imAiBOX/aibox-app/issues',
      },
      {
        h: 'This website',
        p: 'Broken links, wrong instructions, typos: the aibox-site repository takes those.',
        cta: 'Open aibox-site issues',
        href: 'https://github.com/imAiBOX/aibox-site/issues',
      },
      {
        h: 'Email',
        p: 'Anything that does not fit an issue — questions, partnerships, press — goes to our inbox and a human reads it.',
        cta: 'hi@aibox.im',
        href: 'mailto:hi@aibox.im',
      },
    ],
    diagH: 'Tip: attach diagnostics',
    diag: 'If AiBOX offers to export diagnostics, do it — the file has secrets scrubbed out and tells us what your machine saw. Attach it to your issue.',
  },

  smartscreen: {
    title: 'Windows SmartScreen warning — what to do',
    lede: 'First run of any downloaded file triggers this. It is not a virus warning about AiBOX. Four taps and you are in.',
    intro: 'When does it appear?',
    introBody:
      'Only the first time you run a file downloaded from the internet. Windows has not seen this file before, so it asks you to double-check.',
    stepsH: 'Four taps',
    steps: [
      { t: 'Click “More info”', d: 'The blue “Windows protected your PC” screen hides the buttons. “More info” reveals them.' },
      { t: 'Click “Run anyway”', d: 'It sits at the bottom of the dialog, next to “Don’t run”. We want “Run anyway”.' },
      { t: 'Confirm if asked', d: 'A User Account Control box may pop up. Choose “Yes”.' },
      { t: 'You are in', d: 'AiBOX opens. This dialog will not appear again for this file.' },
    ],
    shaH: 'How to check the file is genuine',
    shaBody:
      'Every release file has a SHA-256 checksum, published on the download page and on the GitHub Releases page. Compare it with your downloaded file — if they differ, do not run the file. AiBOX also verifies every download automatically before installing.',
    shaCta: 'Open the download page',
    noteH: 'Why does this happen at all?',
    noteBody:
      'AiBOX is an unsigned portable app for now — code-signing certificates cost money we would rather spend on the tool itself. Once enough people use it, we buy a certificate and this dialog disappears. Until then, the checksum above is your proof.',
    safetyH: 'One rule, always',
    safetyBody: 'Never send your API key to anyone. AiBOX asks for it only to write it into the app’s config file on your own computer.',
    back: 'Back to home',
  },

  netcheck: {
    title: 'Network self-check',
    lede: 'Slow download, or installation stops with a network error? Two minutes of checking fixes most cases.',
    stepsH: 'Work down the list',
    steps: [
      { t: 'Is the internet working at all?', d: 'Open any website in your browser. If nothing loads, fix that first — this guide cannot help with a dead connection.' },
      { t: 'Can you reach GitHub?', d: 'Open github.com in the browser. AiBOX downloads its files from GitHub, so if this page will not open, that is your answer.' },
      { t: 'Try a different network', d: 'Switch to your phone’s hotspot for a minute. If it works there, your usual network (or its proxy/VPN settings) is the problem.' },
      { t: 'Let AiBOX switch sources', d: 'AiBOX tries several download mirrors in turn and tells you when it switches. If one source fails, it moves to the next by itself — just let it finish.' },
      { t: 'Still stuck? Export diagnostics', d: 'AiBOX can write a scrubbed report of what your machine saw. Attach it to an issue and we will look at the actual numbers instead of guessing.' },
    ],
    faqLinkH: 'More questions',
    faqLink: 'The FAQ covers keys, uninstalling and SmartScreen.',
    faqCta: 'Open the FAQ',
    feedbackCta: 'Report a problem',
    back: 'Back to home',
  },

  chrome: {
    skip: 'Skip to content',
  },
};

type PagesDict = typeof en;

const zh: PagesDict = {
  download: {
    title: '下载 AiBOX',
    lede: '一个文件，双击就用——不用安装、不要管理员权限、不改你的系统。',
    win: {
      label: 'Windows',
      note: 'Windows 10/11 · 64 位 · 绿色免安装',
      cta: '下载 Windows 版',
      coming: '',
    },
    mac: {
      label: 'macOS',
      note: 'macOS 版正在路上，先做 Windows。',
      cta: '即将支持',
    },
    release: {
      heading: '当前版本',
      version: '版本',
      file: '文件',
      size: '大小',
      sha: 'SHA-256',
      published: '发布于',
      copy: '复制',
      copied: '已复制',
      checking: '正在获取最新版本…',
      live: '实时 · GitHub API',
      cached: '缓存 · 5 分钟',
      snapshot: '构建时快照',
      unavailable: '暂时拿不到版本详情——上面的下载按钮照常可用。',
      allReleases: 'GitHub 上的全部版本',
      shaNote: '和你下载的文件比对，必须完全一致——不一致就别运行。',
    },
    smartscreen: {
      heading: 'Windows 提示「未知发布者」？',
      body: '第一次运行网上下载的文件，Windows 会请你再确认一次。这不是说 AiBOX 有病毒。四下点击就能过。',
      cta: '看图文步骤',
    },
    integrity: {
      heading: '怎么确认文件是真的',
      body: '每个发布文件都有公开的 SHA-256 校验值（本页上方与 GitHub Releases 页面都有）。AiBOX 安装前也会自动校验每一次下载。',
    },
  },

  faq: {
    title: '常见问题',
    lede: '人话回答，没有术语。',
    items: [
      {
        q: '要会写命令行吗？',
        a: '不用。全程就是按钮和点击：选一个应用、照提示走、要 key 的时候粘贴进去。你不需要打开终端。',
      },
      {
        q: '安全吗？会不会偷我的 key？',
        a: '你的 key 只写进你自己电脑上那个应用自己的配置文件里，不经过我们——我们连能收到它的服务器都没有。安装器是开源的，谁都能查。',
      },
      {
        q: '需要管理员权限吗？',
        a: '不需要。AiBOX 是绿色便携版：不装进系统、不写注册表、不弹管理员。它只写自己的数据文件夹和它帮你装的应用。',
      },
      {
        q: '怎么卸载？',
        a: '把 AiBOX 那个文件删掉，就是卸载完了。它记笔记的小数据文件夹也可以一并删。装好的应用在各自应用里卸载。',
        link: { href: '/feedback/', label: '出问题了？告诉我们' },
      },
      {
        q: '我的 key 存在哪里？',
        a: '存在目标应用自己的配置文件里，在你自己的用户文件夹下。你随时可以打开、改、删。AiBOX 绝不上传它。',
      },
      {
        q: '下载很慢 / 装到一半报网络错误',
        a: '通常是网络可达性问题。有一份两分钟能走完的自查清单，多数情况照做就好。',
        link: { href: '/guides/network-selfcheck/', label: '打开网络自查' },
      },
      {
        q: 'Windows 弹「未知发布者」，要紧吗？',
        a: '那是 SmartScreen 对没签名程序的常规动作：Windows 没见过这个文件而已。四下点过去，校验值能证明文件是我们发的。',
        link: { href: '/guides/smartscreen/', label: '打开 SmartScreen 图文教程' },
      },
      {
        q: '支持 macOS 吗？',
        a: '还没有。现在能用的是 Windows 版，macOS 版在后面。一上线下载页就会显示。',
        link: { href: '/download/', label: '去下载页' },
      },
      {
        q: '收费吗？',
        a: '免费、开源。你只付给大模型服务商的 key 钱（那个本来就是你自己的）。',
      },
      {
        q: '出问题了怎么办？',
        a: '用 AiBOX 导出诊断（里面的敏感信息会抹掉），然后开个 issue，或者直接发邮件——这些都有人看。',
        link: { href: '/feedback/', label: '反馈方式' },
      },
    ],
  },

  about: {
    title: '关于 AiBOX',
    lede: 'AiBOX（中文名：智能盒子）——给只想「装好能用」的人做的桌面 AI 工具安装助手。',
    blocks: [
      {
        h: '它是什么',
        p: '一个 Windows 上的小巧绿色程序（macOS 版在做）。你从目录里挑一个应用，AiBOX 先体检你的电脑，再按序把缺的东西装好、帮你填好 key，最后真实验证它能回话。挡路的东西它来清——全程人话，一步一步。',
      },
      {
        h: '它不是什么',
        p: 'AiBOX 不是商店、不是云服务、也不是陪你聊天的助手。它是个工具箱：把你的工具装好、能用，然后就退到一边。',
      },
      {
        h: '独立项目',
        p: 'Aibox 是独立社区项目，与所列应用官方无隶属关系。它们的名字与商标归各自所有者所有，我们只是负责把它们装好。',
      },
      {
        h: '开源',
        p: '安装器、这个网站、应用目录数据，全在 GitHub imAiBOX 组织下的公开仓库里。代码可读、校验值可查、欢迎提 PR。',
      },
    ],
    contactH: '联系方式',
    contact: '咨询、合作、媒体：hi@aibox.im。报 bug 最快走 GitHub Issues。',
    github: 'GitHub 组织',
  },

  privacy: {
    title: '隐私说明',
    lede: '一句话：没有后端，所以几乎没什么可收集的。',
    blocks: [
      {
        h: '这个网站',
        p: '纯静态 HTML，由 Cloudflare Pages 托管。无账号、无追踪 Cookie、无统计脚本、无数据库。你的浏览器只跟我们的页面说话。',
      },
      {
        h: '你的 API key',
        a: '',
        p: 'key 只写进你自己电脑上目标应用的配置文件里，不会传到我们这里——我们没有任何能收到它的服务，也不想要。',
      },
      {
        h: '下载页',
        p: '下载页显示的版本号与校验值，是浏览器匿名请求 GitHub 公开 API 拿的，本地缓存 5 分钟。GitHub 看到的只是一次普通公开请求，我们什么都看不到。',
      },
      {
        h: '日志与诊断',
        p: '应用日志留在你机器上。导出诊断是你自己主动选择发送的文件——写出来之前敏感信息就会抹掉。',
      },
      {
        h: '实话实说的边界',
        p: 'Cloudflare 会为自己的运维与安全保留标准服务器日志（IP、请求页面）。我们不用它们做用户画像，也不拿去给广告商。若有变化，先改这一页。',
      },
    ],
    contactH: '对本页有疑问',
    contact: '发邮件到 hi@aibox.im——我们用人话回复。',
  },

  feedback: {
    title: '反馈',
    lede: '遇到 bug，或者装不上？挑下面最快的渠道。',
    channels: [
      {
        h: '安装器问题',
        p: '闪退、报错看不懂、某个应用死活装不上：去 aibox-app 仓库开 issue。写清你在做什么、看到了什么——报错的原话最有用。',
        cta: '打开 aibox-app issues',
        href: 'https://github.com/imAiBOX/aibox-app/issues',
      },
      {
        h: '这个网站',
        p: '链接坏了、教程不对、错别字：归 aibox-site 仓库管。',
        cta: '打开 aibox-site issues',
        href: 'https://github.com/imAiBOX/aibox-site/issues',
      },
      {
        h: '邮件',
        p: '装不进 issue 的事——咨询、合作、媒体——发邮件，有人看。',
        cta: 'hi@aibox.im',
        href: 'mailto:hi@aibox.im',
      },
    ],
    diagH: '小提示：附上诊断',
    diag: 'AiBOX 提示导出诊断时，导出来——文件里的敏感信息会抹掉，里面是你机器上真实发生的事。把它附到 issue 里。',
  },

  smartscreen: {
    title: 'Windows SmartScreen 警告怎么办',
    lede: '第一次运行下载的文件都会弹这个。它不是说 AiBOX 有病毒。四下点击就能过。',
    intro: '什么时候会出现？',
    introBody: '只在你第一次运行从网上下载的文件时出现。Windows 没见过这个文件，所以请你再确认一次。',
    stepsH: '四步',
    steps: [
      { t: '点「更多信息」', d: '蓝色的「Windows 已保护你的电脑」把按钮藏起来了，点「更多信息」就露出来。' },
      { t: '点「仍要运行」', d: '它在对话框底部，旁边是「不运行」——我们要的是「仍要运行」。' },
      { t: '若询问，点「是」', d: '可能会弹用户账户控制框，点「是」确认。' },
      { t: '进去了', d: 'AiBOX 打开。这个文件不会再弹第二次。' },
    ],
    shaH: '怎么确认文件是真的',
    shaBody:
      '每个发布文件都有 SHA-256 校验值，写在下载页和 GitHub Releases 页面上。和你下载的文件比对——不一致就别运行。AiBOX 安装前也会自动校验每一次下载。',
    shaCta: '打开下载页',
    noteH: '为什么会有这个提示？',
    noteBody:
      'AiBOX 目前是免签名便携版——代码签名证书要花钱，我们宁可把钱花在工具本身。等用的人多了，买上证书这个提示就没了。在那之前，上面的校验值就是凭据。',
    safetyH: '一条铁律',
    safetyBody: '任何时候都别把 key 发给任何人。AiBOX 只在你自己的电脑上把它写进应用的配置文件。',
    back: '回首页',
  },

  netcheck: {
    title: '网络自查',
    lede: '下载很慢，或者装到一半报网络错误？照单子走一遍，两分钟，多数情况就好了。',
    stepsH: '从上往下走',
    steps: [
      { t: '网还通吗？', d: '浏览器随便开个网页。打不开就先修网络——这份清单救不了断网。' },
      { t: 'GitHub 能打开吗？', d: '浏览器打开 github.com。AiBOX 的文件从 GitHub 下载，这个页打不开，答案就出来了。' },
      { t: '换个网络试试', d: '切到手机热点一分钟。热点上行就是你原来的网络（或它的代理/VPN）有问题。' },
      { t: '让 AiBOX 换源', d: 'AiBOX 会依次尝试多个下载镜像，切换时会告诉你。一个源挂了它自己换下一个——让它跑完就行。' },
      { t: '还不行？导出诊断', d: 'AiBOX 能生成一份抹掉敏感信息的报告，写清你机器上看到了什么。附到 issue 里，我们看真实数字，不猜。' },
    ],
    faqLinkH: '还有问题',
    faqLink: '常见问题里有 key、卸载、SmartScreen 这些。',
    faqCta: '打开常见问题',
    feedbackCta: '反馈问题',
    back: '回首页',
  },

  chrome: {
    skip: '跳到正文',
  },
};

export const pagesDict: Record<Lang, PagesDict> = { en, zh };

export function pt(lang: Lang): PagesDict {
  return pagesDict[lang] ?? pagesDict.en;
}
