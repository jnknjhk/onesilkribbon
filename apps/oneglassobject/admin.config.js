// One Glass Object 的后台配置：共用后台（packages/core/admin）里所有和本站有关的差异都在这里。
// 纯数据，不能放函数——它要从服务端 layout 传给浏览器端组件。
import { COLLECTIONS } from './config/site'

export const adminConfig = {
  brand: 'One Glass Object',
  siteUrl: 'https://oneglassobject.com',
  ownerEmail: 'hello@oneglassobject.com',

  // 商品系列跟着 config/site.js 走：那里改了，后台下拉框自动同步
  collections: COLLECTIONS.map(c => ({ value: c.slug, label: c.adminLabel })),

  // 网站图片位置。key 是前台读取 site_images 用的键，不能改
  imageSlots: [
    {
      label: '首页轮播图',
      desc: '首页全屏背景轮播，上传几张就轮播几张，一张都没有则显示纯色背景。建议 1920×1080px 以上，横向构图',
      keys: [1, 2, 3, 4, 5].map(n => ({ key: `home_hero_${n}`, label: `轮播图 ${n}` })),
    },
    {
      label: '首页系列图',
      desc: '首页 "Our Collections" 每个系列的展示图，建议 800×600px。没有上传时自动使用该系列的商品图片',
      keys: COLLECTIONS.map(c => ({ key: `home_col_${c.slug}`, label: c.name })),
    },
    {
      label: '首页品牌故事图',
      desc: '首页 "Our Story" 区块左侧的图片，建议 800×900px，竖向构图',
      keys: [{ key: 'home_story', label: '品牌故事图' }],
    },
    {
      label: '系列封面图',
      desc: '每个系列页顶部的大图，建议 1600×900px 以上，横向构图',
      keys: COLLECTIONS.map(c => ({ key: `hero_${c.slug}`, label: c.name })),
    },
    {
      label: 'About 页图片',
      desc: 'About 页面各区块的图片',
      keys: [
        { key: 'about_hero',    label: 'Hero 背景大图（建议 1920×1200px，横向）' },
        { key: 'about_main',    label: 'Where it began 配图（建议 800×1000px，竖向）' },
        { key: 'about_craft',   label: '工艺展示横幅图（建议 1600×686px，横向）' },
        { key: 'about_colour',  label: 'A World of Colour 配图（建议 1000×800px）' },
        { key: 'about_wedding', label: 'Made For · Weddings 配图（建议 800×600px）' },
        { key: 'about_gifting', label: 'Made For · Gifting 配图（建议 800×600px）' },
        { key: 'about_making',  label: 'Made For · Making 配图（建议 800×600px）' },
      ],
    },
  ],

  journalCategories: [],

  subscriberSources: [
    { value: 'welcome_popup',   label: '欢迎弹窗' },
    { value: 'home_newsletter', label: '首页订阅区块' },
  ],

  // 手动发邮件的模板，占位符的用法见 One Silk Ribbon 的 admin.config.js
  emailTemplates: [
    {
      label: '订单跟进',
      subject: 'Following Up — Your Order {订单号}',
      body: `Dear {姓名},

I wanted to personally follow up on your recent order ({订单号}).

{在这里写内容}

Thank you for your support.

Warm regards,
One Glass Object`,
    },
    {
      label: '致歉 + 优惠码',
      subject: 'Our Apologies — Your Order {订单号}',
      body: `Dear {姓名},

I'm so sorry about {在这里写原因}.

As a token of apology, please enjoy {折扣} off your next order with code: {优惠码}

Thank you for your patience.

Warm regards,
One Glass Object`,
    },
    {
      label: '感谢邮件',
      subject: 'Thank You for Your Order — One Glass Object',
      body: `Dear {姓名},

Thank you so much for your order — it truly means the world to us.

Every piece is made by hand, and we hope it brings a little quiet beauty to your everyday rituals.

If you have any questions or need anything at all, please don't hesitate to reach out.

With warmth,
One Glass Object`,
    },
  ],

  // 本站没有文章和邮件记录表
  features: { journal: false, emailLog: false, maintenance: true },
}
