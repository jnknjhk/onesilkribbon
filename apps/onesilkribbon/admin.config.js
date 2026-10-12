// One Silk Ribbon 的后台配置：共用后台（packages/core/admin）里所有和本站有关的差异都在这里。
// 纯数据，不能放函数——它要从服务端 layout 传给浏览器端组件。

export const adminConfig = {
  brand: 'One Silk Ribbon',
  siteUrl: 'https://onesilkribbon.com',
  ownerEmail: 'song@onesilkribbon.com',

  // 商品系列：value 是数据库 products.collection 存的值，不能改；label 只影响后台显示
  collections: [
    { value: 'fine-silk-ribbons',        label: '精品丝带 Fine Silk Ribbons' },
    { value: 'hand-frayed-silk-ribbons', label: '手工磨边 Hand-Frayed' },
    { value: 'handcrafted-adornments',   label: '手工饰品 Adornments' },
    { value: 'patterned-ribbons',        label: '图案丝带 Patterned' },
    { value: 'studio-tools',             label: '工作室工具 Studio Tools' },
    { value: 'vintage-inspired-ribbons', label: '复古系列 Vintage-Inspired' },
  ],

  // 网站图片位置。key 是前台读取 site_images 用的键，不能改
  imageSlots: [
    {
      label: '首页轮播图',
      desc: '首页全屏背景轮播，上传几张就轮播几张，一张都没有则显示纯色背景。建议 1920×1080px 以上，横向构图',
      keys: [
        { key: 'home_hero_1', label: '轮播图 1' },
        { key: 'home_hero_2', label: '轮播图 2' },
        { key: 'home_hero_3', label: '轮播图 3' },
        { key: 'home_hero_4', label: '轮播图 4' },
        { key: 'home_hero_5', label: '轮播图 5' },
      ],
    },
    {
      label: '首页系列图',
      desc: '首页 "Our Collections" 每个系列的展示图，建议 800×600px。没有上传时自动使用该系列的商品图片',
      keys: [
        { key: 'home_col_fine-silk-ribbons',        label: 'Fine Silk Ribbons' },
        { key: 'home_col_hand-frayed-silk-ribbons', label: 'Hand-Frayed Silk Ribbons' },
        { key: 'home_col_handcrafted-adornments',   label: 'Handcrafted Adornments' },
        { key: 'home_col_patterned-ribbons',        label: 'Patterned Ribbons' },
        { key: 'home_col_studio-tools',             label: 'Studio Tools' },
        { key: 'home_col_vintage-inspired-ribbons', label: 'Vintage-Inspired Ribbons' },
      ],
    },
    {
      label: '首页品牌故事图',
      desc: '首页 "Our Story" 区块左侧的图片，建议 800×900px，竖向构图',
      keys: [{ key: 'home_story', label: '品牌故事图' }],
    },
    {
      label: '系列封面图',
      desc: '每个系列页顶部的大图，建议 1600×900px 以上，横向构图',
      keys: [
        { key: 'hero_fine-silk-ribbons',        label: 'Fine Silk Ribbons' },
        { key: 'hero_hand-frayed-silk-ribbons', label: 'Hand-Frayed Silk Ribbons' },
        { key: 'hero_handcrafted-adornments',   label: 'Handcrafted Adornments' },
        { key: 'hero_patterned-ribbons',        label: 'Patterned Ribbons' },
        { key: 'hero_studio-tools',             label: 'Studio Tools' },
        { key: 'hero_vintage-inspired-ribbons', label: 'Vintage-Inspired Ribbons' },
      ],
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

  journalCategories: ['Guide', 'Behind the Scenes', 'Inspiration', 'News', 'Care & Tips'],

  subscriberSources: [
    { value: 'welcome_popup',   label: '欢迎弹窗' },
    { value: 'home_newsletter', label: '首页订阅区块' },
  ],

  // 手动发邮件的模板。{姓名} {订单号} {快递单号} {快递公司} 从订单/客户页点"发邮件"时会自动填好；
  // 发送前如果还有没替换的 {…}，会提醒你。
  // （原来的"发货通知"模板去掉了——标记发货时系统已经自动发送发货邮件，手动再发一封会重复）
  emailTemplates: [
    {
      label: '订单跟进',
      subject: 'Following Up — Your Order {订单号}',
      body: `Dear {姓名},

I wanted to personally follow up on your recent order ({订单号}).

{在这里写内容}

Thank you for your support.

Warm regards,
Song
One Silk Ribbon`,
    },
    {
      label: '致歉 + 优惠码',
      subject: 'Our Apologies — Your Order {订单号}',
      body: `Dear {姓名},

I'm so sorry about {在这里写原因}.

As a token of apology, please enjoy {折扣} off your next order with code: {优惠码}

Thank you for your patience.

Warm regards,
Song
One Silk Ribbon`,
    },
    {
      label: '感谢邮件',
      subject: 'Thank You for Your Order — One Silk Ribbon',
      body: `Dear {姓名},

Thank you so much for your order — it truly means the world to us.

Every ribbon is handcrafted with care, and we hope it brings a touch of beauty to whatever occasion you have in mind.

If you have any questions or need anything at all, please don't hesitate to reach out.

With warmth,
Song
One Silk Ribbon`,
    },
  ],

  // 本站有的后台功能。玻璃站没有文章、邮件记录表和数据维护接口，在它自己的配置里关掉
  features: { journal: true, emailLog: true, maintenance: true },
}
